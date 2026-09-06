import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { recordPayroll, salaryPeriodView, assertPayrollDatesOpen } from './payroll.js'
import { calculateInvoice } from './invoiceCalculator.js'

const url=process.env.TEST_DATABASE_URL
if(url&&!/(?:audit|test|fresh_)/.test(new URL(url).pathname))throw new Error('Finance integration tests require an explicitly named test/audit/fresh database')
test('real PostgreSQL payroll transactions protect balances, retries, snapshots, and invoice assignment selection',{skip:!url},async()=>{
  process.env.DATABASE_URL=url!
  delete process.env.WORKFLOW_OWNER_USER_IDS
  delete process.env.WORKFLOW_DEPUTY_USER_IDS
  const pool=new Pool({connectionString:url}),db=drizzle(pool,{schema}),tag=`finance_${randomUUID()}`
  let userId:number|undefined,memberId:number|undefined,clientId:number|undefined,typeId:number|undefined,serviceId:number|undefined,assignmentId:number|undefined
  try{
    const [user]=await db.insert(schema.users).values({username:tag,email:`${tag}@example.test`,password:'test-fixture-not-a-login',fullName:'Finance test',role:'admin',isActive:true}).returning();userId=user.id
    await db.insert(schema.workflowAssignments).values({ userId: user.id, role: 'owner', displayName: 'Finance test' })
    const [member]=await db.insert(schema.teamMembers).values({name:'Finance fixture',email:`${tag}_employee@example.test`,position:'Tester',startDate:'2026-01-01',monthlyRate:'1000.00',monthlySalaryExtras:[],status:'active'}).returning();memberId=member.id
    const base={teamMemberId:member.id,salaryMonth:'2026-09',transactionDate:'2026-09-20',baseSalary:'1000.00',salaryPaidNow:'1000.00',amount:'1000.00',extras:[],note:''}
    const key=randomUUID(),key2=randomUUID()
    const runs=await Promise.allSettled([db.transaction(tx=>recordPayroll(tx,user.id,{...base,idempotencyKey:key})),db.transaction(tx=>recordPayroll(tx,user.id,{...base,idempotencyKey:key2}))])
    assert.equal(runs.filter(r=>r.status==='fulfilled').length,1,'parallel full payouts must settle only once')
    assert.equal(runs.filter(r=>r.status==='rejected').length,1)
    const accepted=runs.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>
    const retry=await db.transaction(tx=>recordPayroll(tx,user.id,{...base,idempotencyKey:accepted.value.payment.idempotencyKey}))
    assert.equal(retry.duplicate,true);assert.equal(retry.payment.id,accepted.value.payment.id)
    await assert.rejects(()=>db.transaction(tx=>recordPayroll(tx,user.id,{...base,amount:'999.99',idempotencyKey:randomUUID()})),/must equal/)
    await db.insert(schema.salaryRateHistory).values({teamMemberId:member.id,monthlyRate:'2000.00',monthlyExtras:[{label:'Health + Dental',amount:'50.00'}],effectiveDate:'2026-10-01',createdBy:user.id})
    const september=await salaryPeriodView(db,member,'2026-09'),october=await salaryPeriodView(db,member,'2026-10')
    assert.equal(september.baseSalary,'1000.00');assert.equal(september.status,'closed');assert.equal(september.remainingTotal,'0.00')
    await assert.rejects(()=>db.transaction(tx=>assertPayrollDatesOpen(tx,member.id,'2026-09-15','2026-09-16')),/settled payroll/)
    assert.equal(october.baseSalary,'2000.00');assert.equal(october.remainingTotal,'2050.00')
    const unknown=await salaryPeriodView(db,member,'2026-08')
    assert.equal(unknown.requiresTermsReview,true);assert.equal(unknown.termsEvidence.rateSource,'current_profile');assert.deepEqual(unknown.defaultExtras,[])
    const historic={...base,salaryMonth:'2026-08',salaryPaidNow:'100.00',amount:'100.00',idempotencyKey:randomUUID()}
    await assert.rejects(()=>db.transaction(tx=>recordPayroll(tx,user.id,historic)),/Confirm the historical/)
    await db.transaction(tx=>recordPayroll(tx,user.id,{...historic,historicalTermsConfirmed:true,note:'Confirmed August contract and bank statement'}))
    const legacyRows=await db.insert(schema.financialTransactions).values([{type:'salary',teamMemberId:member.id,amount:'500.00',transactionDate:'2026-08-02',description:'arbitrary legacy salary + Health',createdBy:user.id},{type:'salary',teamMemberId:member.id,amount:'250.00',transactionDate:'2026-08-04',description:'second legacy partial',createdBy:user.id}]).returning()
    await assert.rejects(()=>db.transaction(tx=>recordPayroll(tx,user.id,{...base,idempotencyKey:randomUUID()})),/Reconcile/)
    for(const legacy of legacyRows){
      const reconcile={teamMemberId:member.id,salaryMonth:'2026-07',transactionDate:legacy.transactionDate,baseSalary:'1000.00',salaryPaidNow:legacy.amount,amount:legacy.amount,extras:[],note:'Verified July bank statement and salary contract',historicalTermsConfirmed:true}
      await assert.rejects(()=>db.transaction(tx=>recordPayroll(tx,user.id,{...reconcile,historicalTermsConfirmed:false},legacy.id)),/Confirm the historical/)
      await db.transaction(tx=>recordPayroll(tx,user.id,reconcile,legacy.id))
    }
    const reconciled=await salaryPeriodView(db,member,'2026-07');assert.equal(reconciled.remainingBase,'250.00');assert.equal(reconciled.legacyPaymentIds.length,0)
    const [client]=await db.insert(schema.clients).values({name:tag}).returning();clientId=client.id
    const [type]=await db.insert(schema.serviceTypes).values({name:tag,category:'outstaffing',billingModel:'monthly'}).returning();typeId=type.id
    const [service]=await db.insert(schema.clientServices).values({clientId:client.id,serviceTypeId:type.id,startDate:'2026-01-01',isActive:true}).returning();serviceId=service.id
    const [assignment]=await db.insert(schema.clientServiceTeamMembers).values({clientServiceId:service.id,teamMemberId:member.id,employmentType:'fulltime',startDate:'2026-01-01',hourlyRate:'25',fixedPrice:'4000'}).returning();assignmentId=assignment.id
    const input={periodStart:'2026-09-01',periodEnd:'2026-09-30',serviceIds:[service.id],developerRates:{[assignment.id]:{hourlyRate:25,hoursWorked:10}}}
    const hourly=await calculateInvoice(db,client.id,input);assert.equal(hourly.totalAmount,250);assert.equal(hourly.services[0].developers[0].fixedPrice,null)
    const empty=await calculateInvoice(db,client.id,{...input,developerRates:{}});assert.equal(empty.services[0].developers.length,0);assert.equal(empty.totalAmount,0)
    const zero=await calculateInvoice(db,client.id,{...input,developerRates:{[assignment.id]:{fixedPrice:0}}});assert.equal(zero.totalAmount,0)
    await assert.rejects(()=>calculateInvoice(db,client.id,{...input,developerRates:{[assignment.id+999999]:{fixedPrice:1}}}),/not assigned/)
  }finally{
    if(userId)await db.delete(schema.financeActivityLogs).where(eq(schema.financeActivityLogs.actorId,userId))
    if(memberId){await db.delete(schema.reimbursementRequests).where(eq(schema.reimbursementRequests.employeeId,memberId));await db.delete(schema.financialTransactions).where(eq(schema.financialTransactions.teamMemberId,memberId));await db.delete(schema.payrollPeriods).where(eq(schema.payrollPeriods.teamMemberId,memberId));await db.delete(schema.salaryRateHistory).where(eq(schema.salaryRateHistory.teamMemberId,memberId))}
    if(assignmentId)await db.delete(schema.clientServiceTeamMembers).where(eq(schema.clientServiceTeamMembers.id,assignmentId))
    if(serviceId)await db.delete(schema.clientServices).where(eq(schema.clientServices.id,serviceId))
    if(typeId)await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id,typeId))
    if(clientId)await db.delete(schema.clients).where(eq(schema.clients.id,clientId))
    if(memberId)await db.delete(schema.teamMembers).where(eq(schema.teamMembers.id,memberId))
    if(userId)await db.delete(schema.users).where(eq(schema.users.id,userId))
    await pool.end()
  }
})
