import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'

const url=process.env.TEST_DATABASE_URL
if(url&&!/(?:audit|test|fresh_)/.test(new URL(url).pathname))throw new Error('An explicitly named test database is required')
test('HTTP financial workflows: permissions, exact invoices, payroll retries, reimbursement reservations and settlement',{skip:!url},async(t)=>{
  // These fixtures exercise September as the current payroll month, and August as historical.
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-20T12:00:00Z')})
  process.env.DATABASE_URL=url!
  for(const key of ['INVITE_EMAIL_WEBHOOK_URL','EMAIL_WEBHOOK_URL','RESEND_WEBHOOK_URL','SENDGRID_API_KEY','SENDGRID_FROM_EMAIL','SLACK_BOT_TOKEN','SLACK_CHANNEL_ID'])delete process.env[key]
  process.env.SLACK_NOTIFICATIONS_ENABLED='false'
  delete process.env.WORKFLOW_OWNER_USER_IDS
  delete process.env.WORKFLOW_DEPUTY_USER_IDS
  const uploadDir=await mkdtemp(join(tmpdir(),'vestov-finance-test-'));process.env.UPLOADS_DIR=uploadDir
  const {db,pool}=await import('../db/index.js')
  const {financesRouter:finance}=await import('../routes/finances.js'),{invoiceRouter:invoice}=await import('../routes/invoice.js'),{default:reimbursement}=await import('../routes/reimbursements.js')
  const { adminRouter } = await import('../routes/admin.js')
  const actors=new Map<string,any>(),tag=`http_${randomUUID()}`,userIds:number[]=[],memberIds:number[]=[],clientIds:number[]=[],serviceIds:number[]=[],typeIds:number[]=[]
  const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.user=actors.get(String(req.headers['x-test-actor']));req.isAuthenticated=()=>Boolean(req.user);next()});app.use('/finances',finance);app.use('/invoices',invoice);app.use('/reimbursements',reimbursement)
  app.use('/admin', adminRouter)
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const port=(server.address() as any).port
  const request=async(method:string,path:string,actor='admin',body?:any)=>{const response=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'x-test-actor':actor,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const text=await response.text();return {status:response.status,body:response.headers.get('content-type')?.includes('json')?JSON.parse(text):text}}
  const expect=async(method:string,path:string,actor:string,body:any,status:number)=>{const result=await request(method,path,actor,body);assert.equal(result.status,status,`${method} ${path}: ${JSON.stringify(result.body)}`);return result.body}
  try{
    for(const [name,role] of [['admin','admin'],['deputy','admin'],['outsider','admin'],['employee','team_member'],['other','team_member'],['client','client']] as const){const [user]=await db.insert(schema.users).values({username:`${tag}_${name}`,email:`${tag}_${name}@example.test`,password:'not-a-login',fullName:name,role,isActive:true}).returning();userIds.push(user.id);actors.set(name,user)}
    await db.insert(schema.workflowAssignments).values([
      { userId: actors.get('admin').id, role: 'owner', displayName: 'Owner fixture' },
      { userId: actors.get('deputy').id, role: 'deputy', displayName: 'Finance fixture' },
    ])
    for(const name of ['employee','other']){const [member]=await db.insert(schema.teamMembers).values({name,email:actors.get(name).email,position:'Test',startDate:'2026-01-01',monthlyRate:'1000',monthlySalaryExtras:[],status:'active'}).returning();memberIds.push(member.id);actors.get(name).teamMemberId=member.id}
    actors.set('preview',{...actors.get('employee'),originalUserId:actors.get('outsider').id})
    actors.set('owner_preview',{...actors.get('admin'),originalUserId:actors.get('outsider').id})
    for(let i=0;i<2;i++){const [client]=await db.insert(schema.clients).values({name:`${tag}_${i}`}).returning();clientIds.push(client.id)}
    await db.insert(schema.clientUsers).values({clientId:clientIds[0],userId:actors.get('client').id,assignedBy:actors.get('admin').id,isActive:true})
    const [type]=await db.insert(schema.serviceTypes).values({name:tag,category:'outstaffing',billingModel:'monthly'}).returning();typeIds.push(type.id)
    const [service]=await db.insert(schema.clientServices).values({clientId:clientIds[0],serviceTypeId:type.id,startDate:'2026-01-01'}).returning();serviceIds.push(service.id)
    const [assignment]=await db.insert(schema.clientServiceTeamMembers).values({clientServiceId:service.id,teamMemberId:memberIds[0],startDate:'2026-01-01',employmentType:'fulltime',hourlyRate:'25',fixedPrice:'4000'}).returning()
    await expect('GET','/finances/logs','admin',undefined,200)
    await expect('GET','/finances/my-salary','client',undefined,403)
    await expect('GET','/finances/my-salary','employee',undefined,200)
    const currentMonth=new Date().toISOString().slice(0,7)
    const accrual=await expect('POST',`/finances/salaries/${memberIds[1]}/period/${currentMonth}/initialize`,'admin',{},200)
    assert.equal(accrual.remainingTotal,'1000.00')
    const accrualRetry=await expect('POST',`/finances/salaries/${memberIds[1]}/period/${currentMonth}/initialize`,'admin',{},200);assert.equal(accrual.id,accrualRetry.id)
    await expect('GET','/invoices','anonymous',undefined,401)
    await expect('GET',`/invoices/client/${clientIds[1]}`,'client',undefined,403)
    const calculated=await expect('POST',`/invoices/calculate-pricing/${clientIds[0]}`,'admin',{serviceIds:[service.id],periodStart:'2026-09-01',periodEnd:'2026-09-30',developerRates:{[assignment.id]:{hourlyRate:25,hoursWorked:10}}},200)
    assert.equal(calculated.totalAmount,250)
    const payload={clientId:clientIds[0],invoiceDate:'2026-09-01',periodStart:'2026-09-01',periodEnd:'2026-09-30',dueDate:'2026-09-06',status:'draft',useServicePricing:true,serviceIds:[service.id],developerRates:{[assignment.id]:{hourlyRate:25,hoursWorked:10}},amount:999}
    const created=await expect('POST','/invoices','admin',payload,200);assert.equal(Number(created.amount),250)
    const batch = await expect('GET', `/invoices/totals?clientIds=${clientIds[1]},${clientIds[0]}`, 'admin', undefined, 200)
    assert.deepEqual(batch.map((row: any) => [row.clientId, row.totalInvoiced]), [[clientIds[1], 0], [clientIds[0], 250]])
    const clientBatch = await expect('GET', '/invoices/totals', 'client', undefined, 200)
    assert.deepEqual(clientBatch, [{ clientId: clientIds[0], totalInvoiced: 0, totalPaid: 0, pendingAmount: 0, overdueAmount: 0 }])
    await expect('GET', `/invoices/totals?clientIds=${clientIds.join(',')}`, 'client', undefined, 403)
    await expect('GET',`/invoices/${created.id}`,'client',undefined,404)
    const detail=await expect('GET',`/invoices/${created.id}`,'admin',undefined,200);assert.equal(detail.services[0].developers[0].developerId,assignment.id);assert.equal(Number(detail.services[0].calculatedAmount),250)
    await expect('PUT',`/invoices/${created.id}`,'admin',{amount:300},400)
    await expect('PUT',`/invoices/${created.id}`,'admin',{status:'paid'},400)
    await expect('PUT',`/invoices/${created.id}`,'admin',{status:'paid',paidAt:'2026-02-30'},400)
    await expect('PUT',`/invoices/${created.id}`,'admin',{useServicePricing:'false'},400)
    await expect('PUT',`/invoices/${created.id}`,'admin',{status:'paid',paidAt:'2026-09-06T12:00:00Z'},200)
    const reportRange = 'startDate=2026-09-06&endDate=2026-09-06'
    const reportPath = `/finances/overview?${reportRange}`
    const paymentsPath = `/finances/client-payments?${reportRange}`
    const invoicePayment = (await expect('GET', paymentsPath, 'deputy', undefined, 200)).find((row: any) => row.id === created.id)
    assert.equal(invoicePayment.excluded, false)
    const exclusionPath = `/finances/client-payments/${created.id}`
    const excludeIncome = { excluded: true, paidAt: invoicePayment.paidAt }
    const reportBefore = await expect('GET', reportPath, 'deputy', undefined, 200)
    const dashboardBefore = await expect('GET', '/admin/dashboard/summary', 'deputy', undefined, 200)
    await expect('PATCH', exclusionPath, 'client', excludeIncome, 403)
    await expect('PATCH', exclusionPath, 'deputy', { ...excludeIncome, paidAt: '2025-12-01T12:00:00Z' }, 409)
    await expect('PATCH', exclusionPath, 'deputy', excludeIncome, 200)
    await expect('PATCH', exclusionPath, 'deputy', excludeIncome, 200)
    const reportAfter = await expect('GET', reportPath, 'deputy', undefined, 200)
    assert.equal(reportAfter.totalIncome, reportBefore.totalIncome - 250)
    assert.equal(reportAfter.netProfitLoss, reportBefore.netProfitLoss - 250)
    assert.equal(reportAfter.monthlyBreakdown[0]?.client_payments ?? 0, reportBefore.monthlyBreakdown[0].client_payments - 250)
    const dashboardAfter = await expect('GET', '/admin/dashboard/summary', 'deputy', undefined, 200)
    assert.equal(dashboardAfter.financesOverview.totals.client_payments, dashboardBefore.financesOverview.totals.client_payments - 250)
    assert.equal(dashboardAfter.invoices.find((row: any) => row.id === created.id).financePaymentExcluded, true)
    const reportInvoices = await expect('GET', '/invoices', 'deputy', undefined, 200)
    assert.equal(reportInvoices.find((row: any) => row.id === created.id).financePaymentExcluded, true)
    const visiblePayments = await expect('GET', paymentsPath, 'deputy', undefined, 200)
    assert(!visiblePayments.some((row: any) => row.id === created.id))
    const allPayments = await expect('GET', `${paymentsPath}&includeExcluded=true`, 'deputy', undefined, 200)
    assert.equal(allPayments.find((row: any) => row.id === created.id).excluded, true)
    const exclusionLogs = await expect('GET', `/finances/logs?action=invoice_income_excluded&entityId=${created.id}`, 'admin', undefined, 200)
    assert.equal(exclusionLogs.length, 1)
    const totals=await expect('GET',`/invoices/client/${clientIds[0]}/totals`,'client',undefined,200);assert.equal(totals.totalPaid,250)
    await expect('PATCH', exclusionPath, 'deputy', { ...excludeIncome, excluded: false }, 200)
    const restoredReport = await expect('GET', reportPath, 'deputy', undefined, 200)
    assert.equal(restoredReport.totalIncome, reportBefore.totalIncome)
    await expect('DELETE',`/invoices/${created.id}`,'admin',undefined,409)
    await expect('PUT',`/invoices/${created.id}`,'admin',{status:'sent',paidAt:null},200)
    await expect('DELETE',`/invoices/${created.id}`,'admin',undefined,200)
    const cancelled=await expect('GET',`/invoices/${created.id}`,'admin',undefined,200);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.services.length,1)
    const salary={teamMemberId:memberIds[0],salaryMonth:'2026-09',transactionDate:'2026-09-06',baseSalary:'1000',salaryPaidNow:'1000',extras:[],amount:'1000',idempotencyKey:randomUUID()}
    await expect('POST','/finances/salaries/record','outsider',salary,403)
    await expect('POST','/finances/salaries/record','owner_preview',salary,403)
    const paid=await expect('POST','/finances/salaries/record','admin',salary,201)
    await expect('PUT',`/finances/salaries/payments/${paid.id}`,'outsider',salary,403)
    await expect('PUT',`/finances/salaries/payments/${paid.id}`,'owner_preview',salary,403)
    await expect('DELETE',`/finances/transactions/${paid.id}`,'outsider',undefined,403)
    await expect('DELETE',`/finances/transactions/${paid.id}`,'owner_preview',undefined,403)
    const retry=await expect('POST','/finances/salaries/record','admin',salary,200);assert.equal(paid.id,retry.id)
    await expect('PUT',`/finances/transactions/${paid.id}`,'admin',{amount:1},409)
    const self=await expect('GET','/finances/my-salary','employee',undefined,200),other=await expect('GET','/finances/my-salary','other',undefined,200);assert.equal(self.payments.length,1);assert.equal(other.payments.length,0)
    const januaryPath = `/finances/salaries/${memberIds[0]}/period/2026-01`
    const january = await expect('GET', januaryPath, 'deputy', undefined, 200)
    assert.equal(january.requiresTermsReview, true)
    const historical = { ...salary, salaryMonth: '2026-01', transactionDate: '2026-02-03', idempotencyKey: randomUUID() }
    await expect('POST', '/finances/salaries/record', 'deputy', historical, 409)
    const original = await expect('POST', '/finances/salaries/record', 'deputy', {
      ...historical, historicalTermsConfirmed: true, note: 'Confirmed against January payroll',
    }, 201)
    assert.equal(original.email.skipped, true)
    await expect('DELETE', `/finances/transactions/${original.id}`, 'deputy', undefined, 200)
    const reopenedJanuary = await expect('GET', januaryPath, 'deputy', undefined, 200)
    assert.equal(reopenedJanuary.remainingBase, '1000.00')
    const corrected = await expect('POST', '/finances/salaries/record', 'deputy', {
      ...historical, idempotencyKey: randomUUID(), amount: '1040', note: 'Added omitted bonus',
      extras: [{ label: 'Bonus', amount: '40' }],
    }, 201)
    assert.equal(corrected.amount, '1040.00')
    assert.equal(corrected.payrollData.salaryMonth, '2026-01')
    assert.equal(corrected.transactionDate, '2026-02-03')
    await expect('DELETE', `/finances/transactions/${corrected.id}`, 'deputy', undefined, 200)
    const requests=await Promise.all([request('POST','/reimbursements','employee',{expenseAmount:600,description:'Desk',idempotencyKey:randomUUID()}),request('POST','/reimbursements','employee',{expenseAmount:600,description:'Chair',idempotencyKey:randomUUID()})]);assert.deepEqual(requests.map(r=>r.status).sort(),[201,409])
    const reservation=requests.find(r=>r.status===201)!.body
    await expect('POST','/reimbursements','preview',{expenseAmount:10,description:'Preview request',idempotencyKey:randomUUID()},403)
    await expect('PUT',`/reimbursements/${reservation.id}/approve`,'owner_preview',{},403)
    await expect('POST',`/reimbursements/${reservation.id}/pay`,'owner_preview',{transactionDate:'2026-09-06',idempotencyKey:randomUUID()},403)
    const newNotifications=await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.eventKey,`purchase-${reservation.id}-created`));assert.deepEqual(newNotifications.map(row=>row.userId).sort(),[actors.get('admin').id,actors.get('deputy').id].sort())
    const limits=await expect('GET','/reimbursements/limits/2026','employee',undefined,200);assert.equal(limits.availableAmount,0);assert.equal(limits.reservedAmount,300);assert.equal(limits.paidAmount,0)
    await expect('POST',`/reimbursements/${reservation.id}/pay`,'admin',{transactionDate:'2026-09-06',idempotencyKey:randomUUID()},409)
    for(const actor of ['deputy','outsider','employee']){
      await expect('PUT',`/reimbursements/${reservation.id}/approve`,actor,{},403)
      await expect('PUT',`/reimbursements/${reservation.id}/reject`,actor,{note:'Not approved'},403)
    }
    await expect('PUT',`/reimbursements/${reservation.id}/approve`,'admin',{},200)
    await expect('PUT',`/reimbursements/${reservation.id}/approve`,'admin',{},409)
    const unauthorized=new FormData();unauthorized.set('evidence',new Blob(['%PDF-test'],{type:'application/pdf'}),'receipt.pdf');await expect('POST',`/reimbursements/${reservation.id}/upload`,'other',unauthorized,403)
    await expect('POST',`/reimbursements/${reservation.id}/upload`,'preview',unauthorized,403)
    const form=new FormData();form.set('evidence',new Blob(['%PDF-test'],{type:'application/pdf'}),'receipt.pdf');const confirmed=await expect('POST',`/reimbursements/${reservation.id}/upload`,'employee',form,200);assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.paidAt,null)
    await expect('GET',`/reimbursements/evidence/${confirmed.evidenceUrl.split('/').pop()}`,'other',undefined,403)
    const payment={transactionDate:'2026-09-06',idempotencyKey:randomUUID()}
    await expect('POST',`/reimbursements/${reservation.id}/pay`,'outsider',payment,403)
    const settled=await expect('POST',`/reimbursements/${reservation.id}/pay`,'deputy',payment,200),again=await expect('POST',`/reimbursements/${reservation.id}/pay`,'deputy',payment,200);assert.equal(settled.paymentTransactionId,again.paymentTransactionId)
    const paidNotifications=await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.eventKey,`purchase-${reservation.id}-paid`));assert.equal(paidNotifications.length,1);assert.equal(paidNotifications[0].userId,actors.get('employee').id)
    await expect('DELETE',`/finances/transactions/${settled.paymentTransactionId}`,'admin',undefined,409)
    const after=await expect('GET','/reimbursements/limits/2026','employee',undefined,200);assert.equal(after.paidAmount,300);assert.equal(after.reservedAmount,0)
    // The alternate linked-extra path must have the same finance authorization and durable notification.
    const secondRequest=await expect('POST','/reimbursements','other',{expenseAmount:120,description:'Monitor fixture',idempotencyKey:randomUUID()},201)
    await expect('PUT',`/reimbursements/${secondRequest.id}/approve`,'admin',{},200)
    const receipt=new FormData();receipt.set('evidence',new Blob(['%PDF-test'],{type:'application/pdf'}),'monitor.pdf')
    await expect('POST',`/reimbursements/${secondRequest.id}/upload`,'other',receipt,200)
    const linkedPayroll={...salary,teamMemberId:memberIds[1],salaryPaidNow:'0',amount:'60',extras:[{label:'Monitor',amount:'60',reimbursementId:secondRequest.id}],idempotencyKey:randomUUID()}
    await expect('POST','/finances/salaries/record','outsider',linkedPayroll,403)
    await expect('POST','/finances/salaries/record','owner_preview',linkedPayroll,403)
    const {recordPayroll}=await import('./payroll.js')
    await assert.rejects(()=>db.transaction(tx=>recordPayroll(tx,actors.get('outsider').id,linkedPayroll)),(error:any)=>error.status===403)
    const linkedPayment=await expect('POST','/finances/salaries/record','deputy',linkedPayroll,201)
    const linkedRetry=await expect('POST','/finances/salaries/record','deputy',linkedPayroll,200);assert.equal(linkedRetry.id,linkedPayment.id)
    const [linkedRequest]=await db.select().from(schema.reimbursementRequests).where(eq(schema.reimbursementRequests.id,secondRequest.id));assert.equal(linkedRequest.status,'paid');assert.equal(linkedRequest.paymentTransactionId,linkedPayment.id)
    const linkedNotices=await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.eventKey,`purchase-${secondRequest.id}-paid`));assert.equal(linkedNotices.length,1);assert.equal(linkedNotices[0].userId,actors.get('other').id)
    await expect('PUT',`/finances/salaries/payments/${linkedPayment.id}`,'deputy',linkedPayroll,409)
    await expect('DELETE',`/finances/transactions/${linkedPayment.id}`,'deputy',undefined,409)
    await expect('DELETE',`/finances/transactions/${paid.id}`,'admin',undefined,200)
    const reopened=await expect('GET',`/finances/salaries/${memberIds[0]}/period/2026-09`,'admin',undefined,200);assert.equal(reopened.remainingTotal,'1000.00')
    const [latePayment] = await db.insert(schema.financialTransactions).values({
      type: 'salary', teamMemberId: memberIds[0], createdBy: actors.get('admin').id,
      transactionDate: '2027-01-05', amount: '250.00',
      payrollData: { version: 1, salaryMonth: '2026-09', baseSalary: '1000.00', paidBase: '250.00', extras: [], note: '' },
    }).returning()
    const overview = await expect('GET', '/finances/salaries?year=2026&paymentScope=year', 'admin', undefined, 200)
    const employee = overview.members.find((member: any) => member.id === memberIds[0])
    assert.equal(employee.totalPaidThisYear, 0)
    assert.equal(employee.currentPeriod.remainingBase, '750.00')
    assert.deepEqual(employee.periods.find((period: any) => period.salaryMonth === currentMonth), employee.currentPeriod)
    assert(!overview.payments.some((payment: any) => payment.id === paid.id || payment.id === latePayment.id))
    assert.equal(overview.allPayments, undefined)
    const details = await expect('GET', `/finances/salaries/${memberIds[0]}/period/2026-09`, 'admin', undefined, 200)
    assert.deepEqual(details.payments, [{ id: latePayment.id, baseSalary: '1000.00', paidBase: '250.00' }])
    assert.equal(details.remainingBase, '750.00')
    const laterYear = await expect('GET', '/finances/salaries?year=2027&paymentScope=year', 'admin', undefined, 200)
    assert(laterYear.payments.some((payment: any) => payment.id === latePayment.id))
    const historyPath = `/finances/salaries/${memberIds[0]}/history`
    const history = await expect('GET', historyPath, 'admin', undefined, 200)
    assert.deepEqual(history.payments.map((payment: any) => payment.id), [latePayment.id])
    await expect('GET', historyPath, 'client', undefined, 403)
    await expect('GET', '/finances/salaries?year=2026&paymentScope=year', 'client', undefined, 403)
    await expect('GET','/finances/logs','admin',undefined,200)
  }finally{
    await new Promise<void>(resolve=>server.close(()=>resolve()))
    if(userIds.length)await db.delete(schema.financeActivityLogs).where(inArray(schema.financeActivityLogs.actorId,userIds))
    if(memberIds.length){await db.delete(schema.reimbursementRequests).where(inArray(schema.reimbursementRequests.employeeId,memberIds));await db.delete(schema.financialTransactions).where(inArray(schema.financialTransactions.teamMemberId,memberIds));await db.delete(schema.payrollPeriods).where(inArray(schema.payrollPeriods.teamMemberId,memberIds));await db.delete(schema.salaryRateHistory).where(inArray(schema.salaryRateHistory.teamMemberId,memberIds))}
    if(clientIds.length){const inv=await db.select({id:schema.invoices.id}).from(schema.invoices).where(inArray(schema.invoices.clientId,clientIds));if(inv.length){const lines=await db.select({id:schema.invoiceServices.id}).from(schema.invoiceServices).where(inArray(schema.invoiceServices.invoiceId,inv.map(row=>row.id)));if(lines.length)await db.delete(schema.invoiceDevelopers).where(inArray(schema.invoiceDevelopers.invoiceServiceId,lines.map(row=>row.id)));await db.delete(schema.invoiceServices).where(inArray(schema.invoiceServices.invoiceId,inv.map(row=>row.id)));await db.delete(schema.invoices).where(inArray(schema.invoices.id,inv.map(row=>row.id)))}await db.delete(schema.clientUsers).where(inArray(schema.clientUsers.clientId,clientIds))}
    if(serviceIds.length){await db.delete(schema.clientServiceTeamMembers).where(inArray(schema.clientServiceTeamMembers.clientServiceId,serviceIds));await db.delete(schema.clientServices).where(inArray(schema.clientServices.id,serviceIds))}
    if(typeIds.length)await db.delete(schema.serviceTypes).where(inArray(schema.serviceTypes.id,typeIds))
    if(clientIds.length)await db.delete(schema.clients).where(inArray(schema.clients.id,clientIds))
    if(memberIds.length)await db.delete(schema.teamMembers).where(inArray(schema.teamMembers.id,memberIds))
    if(userIds.length)await db.delete(schema.users).where(inArray(schema.users.id,userIds))
    await pool.end();await rm(uploadDir,{recursive:true,force:true})
  }
})
