import { and, eq, gt, gte, ilike, isNull, lte, sql } from 'drizzle-orm'
import type { AnyPgColumn, AnyPgTable, SelectedFields } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import {
  clients, clientServices, clientServiceTeamMembers, financialTransactions, freelancerFees, invoices,
  leaveRequests, leaveTypes, payrollPeriods, reimbursementRequests, salaryRateHistory, serviceTypes,
  teamMembers, timeEntries,
} from '../db/schema.js'
import { invoicePaymentExcluded, paidInvoiceConditions } from '../lib/invoiceIncome.js'
import { salaryPeriodView } from '../services/payroll.js'

export type Page = { afterId?: number; limit?: number }
export type DateRange = { from?: string; to?: string }

function dateConditions(column: AnyPgColumn, { from, to }: DateRange) {
  return [from === undefined ? undefined : gte(column, from), to === undefined ? undefined : lte(column, to)]
}

function nameCondition(column: AnyPgColumn, name?: string) {
  if (!name) return undefined
  // Treat user-supplied wildcard characters as literals.
  return ilike(column, `%${name.replace(/[\\%_]/g, '\\$&')}%`)
}

export async function pageRows<T extends SelectedFields>(
  fields: T, table: AnyPgTable & { id: AnyPgColumn }, page: Page,
  ...conditions: Parameters<typeof and>
) {
  const limit = page.limit ?? 25
  const rows = await db.select({ ...fields, id: table.id }).from(table)
    .where(and(gt(table.id, page.afterId ?? 0), ...conditions))
    .orderBy(table.id)
    .limit(limit + 1)
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()
  return { rows, nextAfterId: hasMore ? rows.at(-1)!.id : null }
}

export function readClients(filters: Page & { name?: string; status?: string }) {
  const { name, status, industry, contactPerson, email, contractType, contractStart, contractEnd, billingRate, billingCycle } = clients
  return pageRows({ name, status, industry, contactPerson, email, contractType, contractStart, contractEnd, billingRate, billingCycle }, clients, filters,
    nameCondition(name, filters.name), filters.status ? eq(status, filters.status) : undefined)
}

export function readTeam(filters: Page & { name?: string; status?: string; employmentType?: string }) {
  const { name, position, email, status, employmentType, isBillable, startDate, clientId, timezone, skills } = teamMembers
  return pageRows({ name, position, email, status, employmentType, isBillable, startDate, clientId, timezone, skills }, teamMembers, filters,
    nameCondition(name, filters.name), filters.status ? eq(status, filters.status) : undefined,
    filters.employmentType ? eq(employmentType, filters.employmentType) : undefined)
}

export function readProjects(filters: Page & { clientId?: number; active?: boolean; name?: string }) {
  const { clientId, serviceTypeId, serviceTitle, rate, serviceLevelPrice, startDate, endDate, isActive } = clientServices
  const serviceName = db.select({ name: serviceTypes.name }).from(serviceTypes).where(eq(serviceTypes.id, serviceTypeId))
  return pageRows({ clientId, serviceTypeId, serviceName: sql<string>`(${serviceName})`, serviceTitle, rate, serviceLevelPrice, startDate, endDate, isActive },
    clientServices, filters, filters.clientId ? eq(clientId, filters.clientId) : undefined,
    filters.active === undefined ? undefined : eq(isActive, filters.active), nameCondition(serviceTitle, filters.name))
}

export function readAssignments(filters: Page & { projectId?: number; teamMemberId?: number; active?: boolean }) {
  const { clientServiceId, teamMemberId, employmentType, hourlyRate, fixedPrice, startDate, endDate, isActive, workSchedule } = clientServiceTeamMembers
  return pageRows({ projectId: clientServiceId, teamMemberId, employmentType, hourlyRate, fixedPrice, startDate, endDate, isActive, workSchedule },
    clientServiceTeamMembers, filters, filters.projectId ? eq(clientServiceId, filters.projectId) : undefined,
    filters.teamMemberId ? eq(teamMemberId, filters.teamMemberId) : undefined,
    filters.active === undefined ? undefined : eq(isActive, filters.active))
}

export function readLedger(filters: Page & DateRange & { type?: string; clientId?: number; teamMemberId?: number }) {
  const { type, category, amount, description, transactionDate, teamMemberId, clientId, invoiceId, payrollPeriodId, payrollData, voidedAt } = financialTransactions
  return pageRows({ type, category, amount, description, transactionDate, teamMemberId, clientId, invoiceId, payrollPeriodId, payrollData },
    financialTransactions, filters, isNull(voidedAt), ...dateConditions(transactionDate, filters),
    filters.type ? eq(type, filters.type) : undefined, filters.clientId ? eq(clientId, filters.clientId) : undefined,
    filters.teamMemberId ? eq(teamMemberId, filters.teamMemberId) : undefined)
}

export async function readFinanceOverview(filters: DateRange) {
  const { type, amount, transactionDate, voidedAt } = financialTransactions
  const ledgerMonth = sql<string>`to_char(${transactionDate}, 'YYYY-MM')`
  const invoiceMonth = sql<string>`to_char(${invoices.paidAt}, 'YYYY-MM')`
  const [ledger, payments] = await Promise.all([
    db.select({ month: ledgerMonth, type, amount: sql<string>`sum(${amount})::text` })
      .from(financialTransactions).where(and(isNull(voidedAt), ...dateConditions(transactionDate, filters)))
      .groupBy(ledgerMonth, type),
    db.select({ month: invoiceMonth, amount: sql<string>`sum(${invoices.amount})::text` })
      .from(invoices).where(paidInvoiceConditions(filters.from, filters.to)).groupBy(invoiceMonth),
  ])

  const emptyTotals = () => ({ income: 0, expense: 0, salary: 0, extra_payment: 0, client_payments: 0 })
  const monthTotals = new Map<string, ReturnType<typeof emptyTotals>>()
  const overall = emptyTotals()
  for (const row of [...ledger, ...payments.map((payment) => ({ ...payment, type: 'client_payments' }))]) {
    if (!Object.hasOwn(overall, row.type)) continue
    const type = row.type as keyof typeof overall
    const cents = Math.round(Number(row.amount) * 100)
    const month = monthTotals.get(row.month) ?? emptyTotals()
    overall[type] += cents
    month[type] += cents
    monthTotals.set(row.month, month)
  }

  function summarize(totals: ReturnType<typeof emptyTotals>) {
    const income = totals.income + totals.client_payments
    const expenses = totals.expense + totals.salary + totals.extra_payment
    return {
      totalIncome: income / 100,
      totalExpenses: expenses / 100,
      totalSalaries: totals.salary / 100,
      totalExtraPayments: totals.extra_payment / 100,
      clientPayments: totals.client_payments / 100,
      manualIncome: totals.income / 100,
      manualExpenses: totals.expense / 100,
      netProfitLoss: (income - expenses) / 100,
    }
  }

  return {
    ...filters,
    currency: 'USD',
    ...summarize(overall),
    monthlyBreakdown: [...monthTotals].sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totals]) => ({ month, ...summarize(totals) })),
  }
}

export async function readLedgerTotals(filters: DateRange) {
  const { type, category, amount, transactionDate, voidedAt } = financialTransactions
  const totals = await db.select({
    type, category, count: sql<number>`count(*)::int`,
    amount: sql<string>`sum(${amount})::text`,
  }).from(financialTransactions).where(and(isNull(voidedAt), ...dateConditions(transactionDate, filters)))
    .groupBy(type, category).orderBy(type, category)
  return { ...filters, currency: 'USD', totals }
}

export function readInvoices(filters: Page & DateRange & { clientId?: number; status?: string; paidFrom?: string; paidTo?: string }) {
  const { clientId, invoiceNumber, amount, invoiceDate, periodStart, periodEnd, description, status, dueDate, paidAt } = invoices
  const currentStatus = sql<string>`case
    when ${status} in ('sent', 'overdue') and ${dueDate} is not null
      then case when ${dueDate} < (now() at time zone 'UTC')::date then 'overdue' else 'sent' end
    else ${status} end`
  return pageRows({ clientId, invoiceNumber, amount, invoiceDate, periodStart, periodEnd, description, status: currentStatus, dueDate, paidAt, excludedFromFinanceIncome: invoicePaymentExcluded },
    invoices, filters, ...dateConditions(invoiceDate, filters), filters.clientId ? eq(clientId, filters.clientId) : undefined,
    filters.status ? eq(currentStatus, filters.status) : undefined,
    filters.paidFrom ? sql`${paidAt} >= ${filters.paidFrom}::date` : undefined,
    filters.paidTo ? sql`${paidAt} < (${filters.paidTo}::date + interval '1 day')` : undefined)
}

export function readPayrollPeriods(filters: Page & DateRange & { teamMemberId?: number }) {
  const { teamMemberId, salaryMonth, employmentType, currency, baseSalary, defaultExtras, status } = payrollPeriods
  return pageRows({ teamMemberId, salaryMonth, employmentType, currency, baseSalary, defaultExtras, status },
    payrollPeriods, filters, ...dateConditions(salaryMonth, filters),
    filters.teamMemberId ? eq(teamMemberId, filters.teamMemberId) : undefined)
}

export async function readSalaryPeriod(teamMemberId: number, month: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(teamMembers).where(eq(teamMembers.id, teamMemberId))
    if (!member) return { found: false }
    return { found: true, teamMemberId, name: member.name, period: await salaryPeriodView(tx, member, month) }
  }, { accessMode: 'read only', isolationLevel: 'repeatable read' })
}

export function readSalaryRates(filters: Page & DateRange & { teamMemberId: number }) {
  const { teamMemberId, monthlyRate, monthlyExtras, effectiveDate, employmentType } = salaryRateHistory
  return pageRows({ teamMemberId, monthlyRate, monthlyExtras, effectiveDate, employmentType },
    salaryRateHistory, filters, eq(teamMemberId, filters.teamMemberId), ...dateConditions(effectiveDate, filters))
}

export function readFreelancerFees(filters: Page & DateRange & { teamMemberId?: number; projectId?: number; status?: string }) {
  const { teamMemberId, clientServiceId, description, amount, accruedDate, status, paymentTransactionId } = freelancerFees
  return pageRows({ teamMemberId, projectId: clientServiceId, description, amount, accruedDate, status, paymentTransactionId },
    freelancerFees, filters, ...dateConditions(accruedDate, filters),
    filters.teamMemberId ? eq(teamMemberId, filters.teamMemberId) : undefined,
    filters.projectId ? eq(clientServiceId, filters.projectId) : undefined, filters.status ? eq(status, filters.status) : undefined)
}

export function readLeave(filters: Page & DateRange & { teamMemberId?: number; status?: string }) {
  const { employeeId, leaveTypeId, status, startDate, endDate, daysCount, halfDayStart, halfDayEnd, archivedAt } = leaveRequests
  const type = db.select({ name: leaveTypes.name }).from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId))
  return pageRows({ teamMemberId: employeeId, leaveTypeId, leaveType: sql<string>`(${type})`, status, startDate, endDate, daysCount, halfDayStart, halfDayEnd },
    leaveRequests, filters, isNull(archivedAt), filters.from ? gte(endDate, filters.from) : undefined,
    filters.to ? lte(startDate, filters.to) : undefined,
    filters.teamMemberId ? eq(employeeId, filters.teamMemberId) : undefined, filters.status ? eq(status, filters.status) : undefined)
}

export function readTime(filters: Page & DateRange & { teamMemberId?: number; approved?: boolean }) {
  const { teamMemberId, taskName, date, hours, approved, billable } = timeEntries
  return pageRows({ teamMemberId, taskName, date, hours, approved, billable }, timeEntries, filters,
    ...dateConditions(date, filters), filters.teamMemberId ? eq(teamMemberId, filters.teamMemberId) : undefined,
    filters.approved === undefined ? undefined : eq(approved, filters.approved))
}

export function readReimbursements(filters: Page & { teamMemberId?: number; status?: string; year?: number }) {
  const { employeeId, status, year, category, expenseAmount, reimbursementAmount, requestedAt, paidAt, paymentTransactionId } = reimbursementRequests
  return pageRows({ teamMemberId: employeeId, status, year, category, expenseAmount, reimbursementAmount, requestedAt, paidAt, paymentTransactionId },
    reimbursementRequests, filters, filters.teamMemberId ? eq(employeeId, filters.teamMemberId) : undefined,
    filters.status ? eq(status, filters.status) : undefined, filters.year ? eq(year, filters.year) : undefined)
}
