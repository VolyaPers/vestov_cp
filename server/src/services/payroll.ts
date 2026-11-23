import { assertEmployeeBenefits, payableExtras } from './employmentPolicy.js'
import { and, eq, gte, lte, desc, inArray, isNull, or, sql } from 'drizzle-orm'
import { teamMembers, salaryRateHistory, payrollPeriods, financialTransactions, reimbursementRequests, users } from '../db/schema.js'
import type { db } from '../db/index.js'
import { cents, money, salaryExtras, validDate, validMonth, positiveId, idempotencyKey, FinanceValidationError, type MoneyExtra } from '../lib/money.js'
import { logFinanceActivity, pickTransactionSnapshot } from '../lib/financeAudit.js'

export type PayrollData = { version: 1; salaryMonth: string; baseSalary: string; paidBase: string; extras: MoneyExtra[]; fullTimeExtras?: MoneyExtra[]; employmentType?: string; note: string; termsEvidence?: {rateSource:string;extrasSource:string;rateHistoryId?:number|null;reviewed:boolean;reviewNote?:string} }
export function readPayrollData(value: unknown): PayrollData | null {
  if (!value || typeof value !== 'object' || (value as any).version !== 1) return null
  const data = value as PayrollData
  try { validMonth(data.salaryMonth); cents(data.baseSalary); cents(data.paidBase); salaryExtras(data.extras); return data } catch { return null }
}
export function summarizePeriod(base: string | number, defaultExtras: unknown, payments: Array<{ payrollData: unknown }>) {
  const normalized = payments.map(p => readPayrollData(p.payrollData))
  const paidBaseCents = normalized.reduce((sum, p) => sum + (p ? cents(p.paidBase) : 0), 0)
  const paidExtras = new Map<string, number>()
  for (const payment of normalized) for (const extra of payment?.extras || []) paidExtras.set(extra.label.toLowerCase(), (paidExtras.get(extra.label.toLowerCase()) || 0) + cents(extra.amount))
  const defaults = salaryExtras(defaultExtras || [])
  const defaultMap = new Map<string, MoneyExtra>()
  for (const extra of defaults) { const old = defaultMap.get(extra.label.toLowerCase()); defaultMap.set(extra.label.toLowerCase(), { label: extra.label, amount: money(cents(extra.amount) + (old ? cents(old.amount) : 0)) }) }
  const remainingExtras = [...defaultMap.values()].map(e => ({...e, amount: money(Math.max(cents(e.amount) - (paidExtras.get(e.label.toLowerCase()) || 0), 0))})).filter(e => cents(e.amount) > 0)
  const baseCents = cents(base)
  return { paidBase: money(paidBaseCents), remainingBase: money(Math.max(baseCents-paidBaseCents,0)), remainingExtras, remainingTotal: money(Math.max(baseCents-paidBaseCents,0)+remainingExtras.reduce((s,e)=>s+cents(e.amount),0)), needsReview: normalized.some(p=>!p) }
}
export async function payrollLock(tx: any, memberId: number) { await tx.execute(sql`SELECT pg_advisory_xact_lock(71420, ${memberId})`) }
export async function assertPayrollDatesOpen(tx: any, memberId: number, startDate: string, endDate: string) {
  await payrollLock(tx,memberId)
  const rows = await tx.select({id:payrollPeriods.id}).from(payrollPeriods).where(and(eq(payrollPeriods.teamMemberId,memberId),gte(payrollPeriods.salaryMonth,startDate.slice(0,7)),lte(payrollPeriods.salaryMonth,endDate.slice(0,7)),eq(payrollPeriods.status,'closed')))
  if(rows.length) throw new FinanceValidationError('This date range contains a settled payroll period. Review payroll before changing its underlying records.',409)
}
type SalaryMember = Pick<typeof teamMembers.$inferSelect, 'id' | 'startDate' | 'monthlyRate' | 'monthlySalaryExtras' | 'employmentType'>
type RateRow = typeof salaryRateHistory.$inferSelect
type PeriodRow = typeof payrollPeriods.$inferSelect
type PaymentRow = Pick<typeof financialTransactions.$inferSelect, 'id' | 'payrollData'>

function termsDate(member: SalaryMember, month: string) {
  const firstOfMonth = `${validMonth(month)}-01`
  return member.startDate?.slice(0, 7) === month ? member.startDate : firstOfMonth
}

function salaryTermsFromHistory(member: SalaryMember, month: string, history: RateRow[]) {
  const rate = history[0]
  const knownExtras = history.find(row => row.monthlyExtras !== null)
  const past=month<new Date().toISOString().slice(0,7)
  const requiresTermsReview=past&&(!rate||!knownExtras)
  const employmentType=rate?.employmentType ?? member.employmentType ?? 'fulltime'
  const defaultExtras=payableExtras(knownExtras?.monthlyExtras ?? (past?[]:member.monthlySalaryExtras) ?? [],employmentType)
  return { employmentType, baseSalary: money(cents(rate?.monthlyRate ?? member.monthlyRate ?? '0')), defaultExtras, effectiveDate:rate?.effectiveDate ?? null,
    requiresTermsReview,
    termsEvidence:{rateSource:rate?'effective_history':'current_profile',extrasSource:knownExtras?'effective_history':past?'unknown_no_automatic_extras':'current_profile',rateHistoryId:rate?.id ?? null},
    calculationNote:(employmentType==='part_time'?'Part-time: actual base salary; bonuses and benefits at 50%. ':'')+'Fixed monthly salary in USD. Rates apply to periods beginning on or after their effective date. Attendance and leave are shown separately; no automatic hourly, tax, or absence deductions. A monthly adjustment requires an explicit reason.'+(requiresTermsReview?' Historical terms are not fully evidenced. The base is a suggestion from the current profile when rate history is absent; unknown past monthly extras are not accrued automatically. Confirm the period, base and extras against payroll records.':'') }
}

export async function salaryTerms(tx: any, member: SalaryMember, month: string) {
  const history = await tx.select().from(salaryRateHistory)
    .where(and(eq(salaryRateHistory.teamMemberId, member.id), lte(salaryRateHistory.effectiveDate, termsDate(member, month))))
    .orderBy(desc(salaryRateHistory.effectiveDate), desc(salaryRateHistory.id))
  return salaryTermsFromHistory(member, month, history)
}

function groupPayrollPayments(payments: PaymentRow[]) {
  // Never guess legacy money or dates from a free-text description. Explicit reconciliation is required.
  const legacyPaymentIds: number[] = []
  const byMonth = new Map<string, { id: number; payrollData: PayrollData }[]>()
  for (const { id, payrollData } of payments) {
    const data = readPayrollData(payrollData)
    if (!data) {
      legacyPaymentIds.push(id)
      continue
    }
    const matching = byMonth.get(data.salaryMonth) ?? []
    matching.push({ id, payrollData: data })
    byMonth.set(data.salaryMonth, matching)
  }
  return { legacyPaymentIds, byMonth }
}

function buildSalaryPeriod(
  terms: PeriodRow | Awaited<ReturnType<typeof salaryTerms>>,
  month: string,
  payments: ReturnType<typeof groupPayrollPayments>,
) {
  const { legacyPaymentIds, byMonth } = payments
  const summary = summarizePeriod(terms.baseSalary, terms.defaultExtras, byMonth.get(month) ?? [])
  const status = 'status' in terms ? terms.status : 'draft'
  return { ...terms, salaryMonth: month, ...summary, status: legacyPaymentIds.length ? 'needs_review' : status, legacyPaymentIds, currency: 'USD' }
}

export async function salaryPeriodDetails(tx: any, member: SalaryMember, month: string) {
  const [period]: PeriodRow[] = await tx.select().from(payrollPeriods)
    .where(and(eq(payrollPeriods.teamMemberId, member.id), eq(payrollPeriods.salaryMonth, month)))
  const rows: PaymentRow[] = await tx.select({ id: financialTransactions.id, payrollData: financialTransactions.payrollData })
    .from(financialTransactions)
    .where(and(eq(financialTransactions.teamMemberId, member.id), eq(financialTransactions.type, 'salary'), isNull(financialTransactions.voidedAt)))
    .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id))
  const payments = groupPayrollPayments(rows)
  const terms = period ?? await salaryTerms(tx, member, month)
  return {
    ...buildSalaryPeriod(terms, month, payments),
    payments: (payments.byMonth.get(month) ?? []).map(({ id, payrollData }) => ({
      id,
      baseSalary: payrollData.baseSalary,
      paidBase: payrollData.paidBase,
    })),
  }
}

export async function salaryPeriodView(tx: any, member: SalaryMember, month: string) {
  const { payments: _payments, ...period } = await salaryPeriodDetails(tx, member, month)
  return period
}

function groupByMember<T extends { teamMemberId: number | null }>(rows: T[]) {
  const grouped = new Map<number, T[]>()
  for (const row of rows) {
    if (row.teamMemberId === null) continue
    const entries = grouped.get(row.teamMemberId) ?? []
    entries.push(row)
    grouped.set(row.teamMemberId, entries)
  }
  return grouped
}

export async function salaryOverviewPeriods(database: typeof db, members: SalaryMember[], year: number, today: string) {
  if (!members.length) return []
  const ids = members.map(member => member.id)
  const month = today.slice(0, 7)
  const firstMonth = `${year}-01`
  const lastMonth = `${year}-12`
  const lastTermsDate = members.reduce((latest, member) => {
    const date = termsDate(member, month)
    return date > latest ? date : latest
  }, today)
  const [periodRows, rateRows, paymentRows] = await Promise.all([
    database.select().from(payrollPeriods).where(and(
      inArray(payrollPeriods.teamMemberId, ids),
      or(eq(payrollPeriods.salaryMonth, month), and(gte(payrollPeriods.salaryMonth, firstMonth), lte(payrollPeriods.salaryMonth, lastMonth))),
    )).orderBy(payrollPeriods.salaryMonth),
    database.select().from(salaryRateHistory).where(and(
      inArray(salaryRateHistory.teamMemberId, ids), lte(salaryRateHistory.effectiveDate, lastTermsDate),
    )).orderBy(desc(salaryRateHistory.effectiveDate), desc(salaryRateHistory.id)),
    database.select({ id: financialTransactions.id, teamMemberId: financialTransactions.teamMemberId, payrollData: financialTransactions.payrollData })
      .from(financialTransactions).where(and(
        inArray(financialTransactions.teamMemberId, ids), eq(financialTransactions.type, 'salary'), isNull(financialTransactions.voidedAt),
      )),
  ])

  const periodsByMember = groupByMember(periodRows)
  const ratesByMember = groupByMember(rateRows)
  const paymentsByMember = groupByMember(paymentRows)
  return members.map(member => {
    const storedPeriods = periodsByMember.get(member.id) ?? []
    const rates = ratesByMember.get(member.id) ?? []
    const payments = groupPayrollPayments(paymentsByMember.get(member.id) ?? [])
    const current = storedPeriods.find(period => period.salaryMonth === month)
    const effectiveDate = termsDate(member, month)
    const currentTerms = current ?? salaryTermsFromHistory(member, month, rates.filter(rate => rate.effectiveDate <= effectiveDate))
    const currentPeriod = buildSalaryPeriod(currentTerms, month, payments)
    const periods = storedPeriods
      .filter(period => period.salaryMonth >= firstMonth && period.salaryMonth <= lastMonth)
      .map(period => period === current ? currentPeriod : buildSalaryPeriod(period, period.salaryMonth, payments))
    return {
      member,
      activeTerms: rates.find(rate => rate.effectiveDate <= today),
      currentPeriod,
      periods,
    }
  })
}
/** Establish an accrual explicitly without pretending that a cash payment occurred. */
export async function initializePayrollPeriod(tx:any,memberId:number,month:string,userId:number){
  validMonth(month)
  await payrollLock(tx,memberId)
  const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
  if(!member)throw new FinanceValidationError('Employee not found',404)
  assertEmployeeBenefits(member)
  if(month<member.startDate.slice(0,7))throw new FinanceValidationError('Salary period predates employment')
  if(month!==new Date().toISOString().slice(0,7))throw new FinanceValidationError('Open the current month here. Historical periods require payment reconciliation and an explicit adjustment reason.')
  const view=await salaryPeriodView(tx,member,month)
  if(view.legacyPaymentIds.length)throw new FinanceValidationError('Reconcile legacy payments before opening a salary period',409)
  if ('id' in view) return view
  if(cents(view.baseSalary)===0&&!view.defaultExtras.length)throw new FinanceValidationError('Configure monthly salary terms before opening a salary period')
  const [period]=await tx.insert(payrollPeriods).values({teamMemberId:memberId,salaryMonth:month,currency:'USD',employmentType:view.employmentType,baseSalary:view.baseSalary,defaultExtras:view.defaultExtras,calculationNote:view.calculationNote,status:'open',createdBy:userId}).returning()
  await logFinanceActivity(tx,{action:'salary_period_opened',entityType:'salary_period',entityId:period.id,teamMemberId:memberId,actorId:userId,summary:`Opened salary accrual for ${month}`,afterData:{salaryMonth:month,baseSalary:period.baseSalary,defaultExtras:period.defaultExtras}})
  return salaryPeriodView(tx,member,month)
}
export async function recordPayroll(tx:any, userId:number, input:any, editingId?:number) {
  // Enforce the payment role at the service boundary as well as the HTTP route.
  // Use the caller's transaction so direct callers cannot bypass authorization.
  const { workflowRecipients, queueWorkflowNotification } = await import('./workflow.js')
  const [[actor], recipients] = await Promise.all([
    tx.select({ role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, userId)),
    workflowRecipients(tx),
  ])
  if (!actor || actor.role !== 'admin' || actor.isActive === false || !recipients.allIds.includes(userId)) {
    throw new FinanceValidationError('Salary payments require the workflow owner or authorized finance deputy.', 403)
  }
  const memberId = positiveId(input.teamMemberId,'Team member'), month=validMonth(input.salaryMonth), date=validDate(input.transactionDate,'Payment date')
  const key = editingId ? null : idempotencyKey(input.idempotencyKey)
  const paidBase = cents(input.salaryPaidNow,'Base salary paid')
  const note=typeof input.note==='string'?input.note.trim():''
  await payrollLock(tx,memberId)
  const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
  if(!member) throw new FinanceValidationError('Team member not found',404)
  assertEmployeeBenefits(member)
  const [savedPeriod]=await tx.select().from(payrollPeriods).where(and(eq(payrollPeriods.teamMemberId,memberId),eq(payrollPeriods.salaryMonth,month)))
  const paymentTerms=savedPeriod || await salaryTerms(tx,member,month)
  const extras=payableExtras(input.extras,paymentTerms.employmentType),total=paidBase+extras.reduce((sum,e)=>sum+cents(e.amount),0)
  if(total<=0) throw new FinanceValidationError('Payment total must be greater than zero')
  if(input.amount!==undefined && cents(input.amount)!==total) throw new FinanceValidationError('Payment total must equal base salary plus employment-adjusted extras')
  if(month < member.startDate.slice(0,7)) throw new FinanceValidationError('Salary period predates employment')
  if(key){ const [existing]=await tx.select().from(financialTransactions).where(eq(financialTransactions.idempotencyKey,key)); if(existing){ const old=readPayrollData(existing.payrollData); if(existing.teamMemberId!==memberId || old?.salaryMonth!==month || cents(existing.amount)!==total || existing.transactionDate!==date || JSON.stringify(old.extras)!==JSON.stringify(extras) || cents(old.paidBase)!==paidBase || old.note!==note || existing.voidedAt) throw new FinanceValidationError('Idempotency key was already used for another payment',409); return {payment:existing,duplicate:true} } }
  const payments=await tx.select().from(financialTransactions).where(and(eq(financialTransactions.teamMemberId,memberId),eq(financialTransactions.type,'salary'),isNull(financialTransactions.voidedAt)))
  const existing=editingId ? payments.find((p:any)=>p.id===editingId) : null
  if(editingId&&!existing) throw new FinanceValidationError('Salary payment not found',404)
  if(existing?.payrollPeriodId && readPayrollData(existing.payrollData)?.salaryMonth!==month) throw new FinanceValidationError('A recorded payment cannot be moved to another salary month. Void it and record a corrected payment.')
  if(!editingId && payments.some((p:any)=>!readPayrollData(p.payrollData))) throw new FinanceValidationError('Reconcile this employee’s legacy salary payments before recording another payment.',409)
  let [period]=await tx.select().from(payrollPeriods).where(and(eq(payrollPeriods.teamMemberId,memberId),eq(payrollPeriods.salaryMonth,month)))
  const terms=period || await salaryTerms(tx,member,month)
  const needsHistoricalConfirmation=Boolean(terms.requiresTermsReview || (existing&&!readPayrollData(existing.payrollData)))
  if(needsHistoricalConfirmation&&(input.historicalTermsConfirmed!==true||!note))throw new FinanceValidationError('Confirm the historical month, base and extras against payroll records, and provide a reconciliation note',409)
  const requestedBase=input.baseSalary===undefined ? cents(terms.baseSalary) : cents(input.baseSalary,'Full salary')
  if(period&&requestedBase!==cents(period.baseSalary)) throw new FinanceValidationError('The salary period has a saved base salary. Its amount cannot be changed by a payment.',409)
  if(!period&&requestedBase!==cents(terms.baseSalary)&&!note) throw new FinanceValidationError('Provide a reason for an adjusted monthly salary')
  if(!period){ [period]=await tx.insert(payrollPeriods).values({teamMemberId:memberId,salaryMonth:month,employmentType:terms.employmentType,baseSalary:money(requestedBase),defaultExtras:terms.defaultExtras,currency:'USD',calculationNote:terms.calculationNote+(needsHistoricalConfirmation?` Historical terms reviewed: ${note}`:'')+(requestedBase!==cents(terms.baseSalary)?` Adjustment: ${note}`:''),createdBy:userId,status:'open'}).returning() }
  const prior=payments.filter((p:any)=>p.id!==editingId&&readPayrollData(p.payrollData)?.salaryMonth===month)
  const summary=summarizePeriod(period.baseSalary,period.defaultExtras,prior)
  if(paidBase>cents(summary.remainingBase)) throw new FinanceValidationError(`Payment exceeds the remaining salary balance (${summary.remainingBase} USD)`,409)
  const defaultLabels=new Set(salaryExtras(period.defaultExtras || []).map(extra=>extra.label.toLowerCase()))
  const requestedExtras=new Map<string,number>()
  for(const extra of extras)if(!extra.reimbursementId)requestedExtras.set(extra.label.toLowerCase(),(requestedExtras.get(extra.label.toLowerCase()) || 0)+cents(extra.amount))
  for(const [label,amount] of requestedExtras){const remaining=summary.remainingExtras.find(extra=>extra.label.toLowerCase()===label);if(defaultLabels.has(label)&&amount>cents(remaining?.amount || '0')&&!note)throw new FinanceValidationError('This payment exceeds a remaining monthly extra. Provide an explicit adjustment reason.',409)}
  // Paid reimbursements must be allocated using the request ID, not an untraceable text label.
  const reimbursementIds=extras.filter(e=>e.reimbursementId).map(e=>e.reimbursementId!)
  if(reimbursementIds.length>1) throw new FinanceValidationError('Record each reimbursement separately so every request has its own payment reference')
  if(new Set(reimbursementIds).size!==reimbursementIds.length) throw new FinanceValidationError('A reimbursement may appear only once')
  if(existing){ const linked=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.paymentTransactionId,existing.id)); if(linked.length) throw new FinanceValidationError('This payment settles reimbursements and cannot be edited. Contact the finance administrator for reconciliation.',409) }
  for(const extra of extras.filter(e=>e.reimbursementId)){const [request]=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.id,extra.reimbursementId!)).for('update'); if(!request||request.employeeId!==memberId||request.status!=='confirmed'||request.paymentTransactionId||cents(request.reimbursementAmount)!==cents(extra.amount)) throw new FinanceValidationError('Reimbursement is not eligible for this payment',409)}
  const data:PayrollData={version:1,salaryMonth:month,baseSalary:period.baseSalary,paidBase:money(paidBase),extras,fullTimeExtras:salaryExtras(input.extras),employmentType:paymentTerms.employmentType,note,termsEvidence:readPayrollData(existing?.payrollData)?.termsEvidence || {...(terms.termsEvidence || {rateSource:'saved_period',extrasSource:'saved_period'}),reviewed:needsHistoricalConfirmation,reviewNote:needsHistoricalConfirmation?note:undefined}}
  const values={amount:money(total),transactionDate:date,description:`Salary ${month}${note?` — ${note}`:''}`,payrollPeriodId:period.id,payrollData:data,updatedAt:new Date()}
  const [payment]=editingId ? await tx.update(financialTransactions).set(values).where(eq(financialTransactions.id,editingId)).returning() : await tx.insert(financialTransactions).values({...values,type:'salary',category:'monthly_salary',teamMemberId:memberId,createdBy:userId,idempotencyKey:key}).returning()
  for(const id of reimbursementIds) {
    const [request] = await tx.update(reimbursementRequests).set({status:'paid',paymentTransactionId:payment.id,paidAt:new Date(`${date}T12:00:00Z`),updatedAt:new Date()}).where(eq(reimbursementRequests.id,id)).returning()
    await queueWorkflowNotification(tx, { eventKey: `purchase-${id}-paid`, recipientIds: [request.requestedBy], title: 'Reimbursement payment recorded', body: `${request.reimbursementAmount} USD for ${request.description}. Payment date: ${date}.`, href: '/employee/reimbursements' })
  }
  const afterSummary=summarizePeriod(period.baseSalary,period.defaultExtras,[...prior,payment])
  await tx.update(payrollPeriods).set({status:cents(afterSummary.remainingTotal)===0?'closed':'open',updatedAt:new Date()}).where(eq(payrollPeriods.id,period.id))
  await logFinanceActivity(tx,{action:editingId?'salary_payment_updated':'salary_payment_created',entityType:'salary_payment',entityId:payment.id,transactionId:payment.id,teamMemberId:memberId,actorId:userId,summary:`${editingId?'Updated':'Recorded'} salary payment for ${month}`,beforeData:existing?{...pickTransactionSnapshot(existing),payrollData:existing.payrollData}:null,afterData:{...pickTransactionSnapshot(payment),payrollData:data}})
  return {payment,duplicate:false,summary:afterSummary,member}
}

/** Shared path for profile edits: preserve the previous contract and audit the change. */
export async function updateMonthlySalaryFromProfile(tx:any,memberId:number,monthlyRate:unknown,actorId:number){
  const nextRate=money(cents(monthlyRate,'Monthly salary'))
  await payrollLock(tx,memberId)
  const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
  if(!member)throw new FinanceValidationError('Team member not found',404)
  if(cents(member.monthlyRate || '0')===cents(nextRate))return
  assertEmployeeBenefits(member)
  const history=await tx.select().from(salaryRateHistory).where(eq(salaryRateHistory.teamMemberId,memberId))
  if(!history.length)await tx.insert(salaryRateHistory).values({teamMemberId:memberId,employmentType:member.employmentType,monthlyRate:member.monthlyRate || '0',monthlyExtras:salaryExtras(member.monthlySalaryExtras || []),effectiveDate:member.startDate>`${new Date().toISOString().slice(0,7)}-01`?member.startDate:`${new Date().toISOString().slice(0,7)}-01`,createdBy:actorId,note:'Current-month profile baseline before salary change; earlier terms remain unverified'})
  const effectiveDate=new Date().toISOString().slice(0,10)
  await tx.insert(salaryRateHistory).values({teamMemberId:memberId,employmentType:member.employmentType,monthlyRate:nextRate,monthlyExtras:salaryExtras(member.monthlySalaryExtras || []),effectiveDate,createdBy:actorId,note:'Salary changed through employee profile'})
  await tx.update(teamMembers).set({monthlyRate:nextRate,updatedAt:new Date()}).where(eq(teamMembers.id,memberId))
  await logFinanceActivity(tx,{action:'salary_rate_updated',entityType:'salary_rate',entityId:memberId,teamMemberId:memberId,actorId,summary:`Monthly salary updated from ${effectiveDate}`,beforeData:{monthlyRate:member.monthlyRate},afterData:{monthlyRate:nextRate,effectiveDate}})
}
