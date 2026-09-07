import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import * as s from '../db/schema.js'
const url=process.env.TEST_DATABASE_URL
if(url&&(!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!new URL(url).pathname.startsWith('/vestov_test_')))throw new Error('Use a disposable local test database')
test('employment types: real routes, benefits, portal denial and project accrual/payment integrity',{skip:!url},async t=>{
  process.env.DATABASE_URL=url!
  const {db,pool}=await import('../db/index.js')
  const {default:express}=await import('express')
  const {adminRouter}=await import('./admin.js'),{financesRouter}=await import('./finances.js'),{default:reimbursements}=await import('./reimbursements.js'),{default:vacation}=await import('./vacation.js'),{default:roadmap}=await import('./roadmap.js'),{default:shifts}=await import('./shifts.js'),{authRouter,syncLocalUserWithClerk}=await import('./auth.js'),{default:usersRouter}=await import('./users.js')
  const {createUserAccount}=await import('../services/userService.js')
  const {assertLeaveRequestAllowed}=await import('../utils/vacationBalanceCalculator.js')
  const tag=randomUUID().slice(0,10),ids:number[]=[],members:number[]=[],transactionIds:number[]=[],feeIds:number[]=[]
  let clientId:number|undefined,projectId:number|undefined,typeId:number|undefined
  const app=express();app.use(express.json());app.use(async(req:any,_res,next)=>{const id=Number(req.get('x-test-user'));if(ids.includes(id))[req.user]=await db.select().from(s.users).where(eq(s.users.id,id));req.isAuthenticated=()=>Boolean(req.user?.isActive);next()})
  app.use('/api',authRouter);app.use('/api/admin',adminRouter);app.use('/api/finances',financesRouter);app.use('/api/reimbursements',reimbursements);app.use('/api/vacation',vacation);app.use('/api/roadmap',roadmap);app.use('/api/shifts',shifts);app.use('/api/users',usersRouter)
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r))
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`
  async function request(path:string,userId:number,body?:object,method=body?'POST':'GET') {const res=await fetch(base+path,{method,headers:{'x-test-user':String(userId),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()}}
  async function user(role:string,suffix:string,extra={}){const [row]=await db.insert(s.users).values({username:tag+suffix,email:`${tag}${suffix}@example.test`,fullName:suffix,role,...extra}).returning();ids.push(row.id);return row}
  try{
    const admin=await user('admin','owner'),otherAdmin=await user('admin','other'),employee=await user('team_member','part')
    await db.insert(s.workflowAssignments).values({userId:admin.id,role:'owner',displayName:'Test owner'})
    const month=new Date().toISOString().slice(0,7),today=new Date().toISOString().slice(0,10)
    const [part]=await db.insert(s.teamMembers).values({name:'Part-time',email:employee.email,position:'Engineer',employmentType:'part_time',startDate:month+'-01',monthlyRate:'1000',monthlySalaryExtras:[{label:'Monthly bonus',amount:'100'}]}).returning();members.push(part.id)
    await db.update(s.users).set({teamMemberId:part.id}).where(eq(s.users.id,employee.id))
    let freelancer:any
    await t.test('create freelancer without an account; validate type and prevent duplicate contacts',async()=>{
      const result=await request('/admin/team-members',admin.id,{employmentType:'freelancer',name:'Freelance Designer',email:`${tag}freelancer@example.test`,position:'Designer',startDate:month+'-01'})
      assert.equal(result.status,200,JSON.stringify(result.body));freelancer=result.body;members.push(freelancer.id)
      assert.equal(freelancer.showOnCalendar,false)
      assert.equal((await request(`/admin/team-members/${freelancer.id}`,admin.id,{email:admin.email},'PUT')).status,409)
      assert.equal((await db.select().from(s.users).where(eq(s.users.email,freelancer.email))).length,0)
      assert.equal((await request('/admin/team-members',admin.id,{employmentType:'invalid'})).status,400)
      assert.equal((await request(`/admin/team-members/${part.id}`,admin.id,{employmentType:'invalid'},'PUT')).status,400)
      await assert.rejects(()=>createUserAccount({email:freelancer.email,fullName:'Blocked',role:'team_member'}),/Freelancers/)
    })
    await t.test('part-time payroll: actual base, half monthly and ad hoc bonuses, no repeated halving',async()=>{
      let result=await request(`/finances/salaries/${part.id}/period/${month}`,admin.id)
      assert.equal(result.status,200);assert.equal(result.body.baseSalary,'1000.00');assert.equal(result.body.defaultExtras[0].amount,'50.00');assert.equal(result.body.employmentType,'part_time')
      const input={teamMemberId:part.id,salaryMonth:month,transactionDate:today,salaryPaidNow:'400',extras:[{label:'Monthly bonus',amount:'100'},{label:'Project bonus',amount:'81'}],amount:'490.50',idempotencyKey:randomUUID()}
      result=await request('/finances/salaries/record',admin.id,input);assert.equal(result.status,201,JSON.stringify(result.body))
      const payments=await db.select().from(s.financialTransactions).where(eq(s.financialTransactions.teamMemberId,part.id));transactionIds.push(...payments.map(p=>p.id));assert.equal(payments[0].amount,'490.50')
      assert.equal((payments[0].payrollData as any).extras[1].amount,'40.50')
      const duplicate=await request('/finances/salaries/record',admin.id,input);assert.equal(duplicate.status,200)
      result=await request(`/finances/salaries/${part.id}/period/${month}`,admin.id);assert.equal(result.body.remainingBase,'600.00');assert.deepEqual(result.body.remainingExtras,[])
      // A later employment change cannot rewrite an accrued salary period.
      await request(`/admin/team-members/${part.id}`,admin.id,{employmentType:'fulltime'},'PUT')
      result=await request(`/finances/salaries/${part.id}/period/${month}`,admin.id);assert.equal(result.body.employmentType,'part_time');assert.equal(result.body.defaultExtras[0].amount,'50.00')
      await request(`/admin/team-members/${part.id}`,admin.id,{employmentType:'part_time'},'PUT')
    })
    await t.test('part-time reimbursements and roadmap share half limits and 25% expense coverage',async()=>{
      let result=await request('/reimbursements/limits/2026',employee.id);assert.equal(result.status,200);assert.equal(result.body.yearlyLimit,150);assert.equal(result.body.reimbursementRate,.25)
      result=await request('/reimbursements',employee.id,{expenseAmount:'400',description:'Workspace',idempotencyKey:randomUUID()});assert.equal(result.status,201);assert.equal(result.body.reimbursementAmount,'100.00')
      result=await request('/reimbursements',employee.id,{expenseAmount:'400',description:'Second purchase',idempotencyKey:randomUUID()});assert.equal(result.body.reimbursementAmount,'50.00')
      result=await request('/roadmap',employee.id);assert.equal(result.body.currentReimbursementLimit,150);assert.equal(result.body.milestones[0].vacationDays,8)
    })
    await t.test('freelancer legacy sessions, Clerk sync, invitations, salary and leave are blocked',async()=>{
      const legacy=await user('team_member','legacy',{teamMemberId:freelancer.id,email:freelancer.email})
      for(const path of ['/user','/roadmap','/finances/my-salary','/shifts/services','/reimbursements/my-requests'])assert.equal((await request(path,legacy.id)).status,403,path)
      assert.equal((await request(`/users/${legacy.id}/invitation`,admin.id,{})).status,403)
      await assert.rejects(()=>syncLocalUserWithClerk({id:'clerk-test',primaryEmailAddressId:'email',emailAddresses:[{id:'email',emailAddress:legacy.email,verification:{status:'verified'}}]} as any),/Freelancers/)
      assert.equal((await request(`/finances/salaries/${freelancer.id}/period/${month}/initialize`,admin.id,{})).status,409)
      const [leaveType]=await db.select().from(s.leaveTypes)
      await assert.rejects(()=>assertLeaveRequestAllowed(db,freelancer.id,leaveType.id,{startDate:today,endDate:today}),/Freelancers/)
      const listing=await request('/finances/salaries',admin.id);assert.ok(!listing.body.members.some((m:any)=>m.id===freelancer.id))
    })
    await t.test('project accrual is not cash; authorized idempotent payment is locked to its project and fee',async()=>{
      const [client]=await db.insert(s.clients).values({name:tag+' Client'}).returning();clientId=client.id
      const [type]=await db.insert(s.serviceTypes).values({name:tag+' Service',category:'outsourcing',billingModel:'fixed'}).returning();typeId=type.id
      const [project]=await db.insert(s.clientServices).values({clientId,serviceTypeId:typeId,serviceTitle:'Design',startDate:today}).returning();projectId=project.id
      const input={clientServiceId:projectId,description:'Landing page',amount:'737.19',accruedDate:today,idempotencyKey:randomUUID()}
      assert.equal((await request(`/finances/freelancer-fees/${freelancer.id}`,admin.id,input)).status,409)
      await db.insert(s.clientServiceTeamMembers).values({clientServiceId:projectId,teamMemberId:freelancer.id,employmentType:'freelancer',startDate:today})
      let result=await request(`/finances/freelancer-fees/${freelancer.id}`,admin.id,input);assert.equal(result.status,201,JSON.stringify(result.body));const fee=result.body;feeIds.push(fee.id)
      assert.equal((await db.select().from(s.financialTransactions).where(eq(s.financialTransactions.teamMemberId,freelancer.id))).length,0)
      result=await request(`/finances/freelancer-fees/${freelancer.id}`,admin.id,input);assert.equal(result.body.id,fee.id)
      const payment={transactionDate:today,idempotencyKey:randomUUID()}
      assert.equal((await request(`/finances/freelancer-fees/${freelancer.id}/${fee.id}/pay`,otherAdmin.id,payment)).status,403)
      const parallel=await Promise.all([request(`/finances/freelancer-fees/${freelancer.id}/${fee.id}/pay`,admin.id,payment),request(`/finances/freelancer-fees/${freelancer.id}/${fee.id}/pay`,admin.id,payment)])
      assert.ok(parallel.every(r=>r.status===200),JSON.stringify(parallel));assert.equal(parallel[0].body.paymentTransactionId,parallel[1].body.paymentTransactionId)
      const transactionId=parallel[0].body.paymentTransactionId;transactionIds.push(transactionId)
      const [paid]=await db.select().from(s.financialTransactions).where(eq(s.financialTransactions.id,transactionId));assert.equal(paid.amount,'737.19');assert.equal(paid.clientId,clientId)
      assert.equal((await request(`/finances/freelancer-fees/${freelancer.id}/${fee.id}/pay`,admin.id,{...payment,idempotencyKey:randomUUID()})).status,409)
      assert.equal((await request(`/finances/transactions/${transactionId}`,admin.id,{amount:'1'},'PUT')).status,409)
      assert.equal((await request(`/finances/transactions/${transactionId}`,admin.id,undefined,'DELETE')).status,409)
      assert.equal((await request(`/finances/freelancer-fees/${freelancer.id}/${fee.id}/cancel`,admin.id,{})).status,409)
    })
    await t.test('conversion immediately disables employee account and prevents reactivation',async()=>{
      assert.equal((await request(`/admin/team-members/${part.id}`,admin.id,{employmentType:'freelancer'},'PUT')).status,409)
      const remaining=await request('/finances/salaries/record',admin.id,{teamMemberId:part.id,salaryMonth:month,transactionDate:today,salaryPaidNow:'600',extras:[],idempotencyKey:randomUUID()});assert.equal(remaining.status,201)
      const purchases=await db.select().from(s.reimbursementRequests).where(eq(s.reimbursementRequests.employeeId,part.id))
      for(const purchase of purchases)assert.equal((await request(`/reimbursements/${purchase.id}/reject`,admin.id,{note:'Fixture request cancelled'},'PUT')).status,200)
      const result=await request(`/admin/team-members/${part.id}`,admin.id,{employmentType:'freelancer',monthlyRate:'1000'},'PUT');assert.equal(result.status,200,JSON.stringify(result.body))
      const [account]=await db.select().from(s.users).where(eq(s.users.id,employee.id));assert.equal(account.isActive,false)
      assert.equal((await request(`/users/${employee.id}`,admin.id,{isActive:true},'PUT')).status,403)
      assert.equal((await request('/user',employee.id)).status,401)
    })
  }finally{
    server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))
    await db.delete(s.freelancerFees).where(inArray(s.freelancerFees.teamMemberId,members))
    await db.delete(s.reimbursementRequests).where(inArray(s.reimbursementRequests.employeeId,members))
    await db.delete(s.financeActivityLogs).where(inArray(s.financeActivityLogs.actorId,ids))
    await db.delete(s.workflowNotifications).where(inArray(s.workflowNotifications.userId,ids))
    await db.delete(s.financialTransactions).where(inArray(s.financialTransactions.teamMemberId,members))
    await db.delete(s.payrollPeriods).where(inArray(s.payrollPeriods.teamMemberId,members))
    await db.delete(s.salaryRateHistory).where(inArray(s.salaryRateHistory.teamMemberId,members))
    await db.delete(s.workflowAssignments).where(inArray(s.workflowAssignments.userId,ids))
    await db.delete(s.users).where(inArray(s.users.id,ids))
    await db.delete(s.clientServiceTeamMembers).where(inArray(s.clientServiceTeamMembers.teamMemberId,members))
    await db.delete(s.teamMembers).where(inArray(s.teamMembers.id,members))
    if(projectId)await db.delete(s.clientServices).where(eq(s.clientServices.id,projectId))
    if(typeId)await db.delete(s.serviceTypes).where(eq(s.serviceTypes.id,typeId))
    if(clientId)await db.delete(s.clients).where(eq(s.clients.id,clientId))
    await pool.end()
  }
})
