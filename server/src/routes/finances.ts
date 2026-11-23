import freelancerFeesRouter from './freelancerFees.js'
import { assertEmployeeBenefits } from '../services/employmentPolicy.js'
import { Router } from 'express'
import { eq, desc, and, sql, gte, lte, asc, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  financialTransactions,
  financeCategories,
  financeActivityLogs,
  integrationSettings,
  invoices,
  clients,
  clientServices,
  serviceTypes,
  teamMembers,
  users,
  salaryRateHistory,
  freelancerFees,
  payrollPeriods,
  reimbursementRequests,
} from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'
import { invoicePaymentExcluded, paidInvoiceConditions } from '../lib/invoiceIncome.js'
import {
  diffRecord,
  logFinanceActivity,
  pickInvoiceSnapshot,
  pickTransactionSnapshot,
} from '../lib/financeAudit.js'
import { buildSalaryPaymentEmail, sendEmail } from '../services/email.js'
import { requireAuth } from '../middleware/auth.js'
import { resolveEmployeeId } from '../services/access.js'
import { requireWorkflowCapability } from '../services/workflow.js'

import { cents, money, salaryExtras, validDate, validMonth, positiveId, financeError, FinanceValidationError } from '../lib/money.js'
import { recordPayroll, initializePayrollPeriod, salaryPeriodView, salaryPeriodDetails, salaryOverviewPeriods, payrollLock, readPayrollData, summarizePeriod } from '../services/payroll.js'

const router = Router()
router.use(requireAuth)
router.use('/freelancer-fees', freelancerFeesRouter)

// Admin check helper
function isAdmin(req: any, res: any): boolean {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return false
  }
  return true
}

type FinanceCategoryKind = 'income' | 'expense'

function normalizeCategoryKind(value?: string | null): FinanceCategoryKind | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'income') return 'income'
  if (normalized === 'expense' || normalized === 'cost') return 'expense'
  return null
}

async function ensureCategoryExists(kind: FinanceCategoryKind, rawName: string, userId?: number) {
  const name = rawName.trim()
  if (!name) return null

  const [existing] = await db
    .select({
      id: financeCategories.id,
      kind: financeCategories.kind,
      name: financeCategories.name,
    })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.kind, kind),
        sql`lower(${financeCategories.name}) = lower(${name})`
      )
    )
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(financeCategories)
    .values({
      kind,
      name,
      createdBy: userId || null,
    })
    .returning({
      id: financeCategories.id,
      kind: financeCategories.kind,
      name: financeCategories.name,
    })

  return created
}

type SalaryExtraPayload = {
  label: string
  amount: number
}

type SalaryPaymentEmailStatus = {
  delivered: boolean
  skipped?: boolean
  provider?: string
  error?: string
}

function normalizeSalaryExtras(value: unknown): SalaryExtraPayload[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const rawLabel = 'label' in item ? item.label : ''
    const rawAmount = 'amount' in item ? item.amount : ''
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount ?? ''))

    if (!label || !Number.isFinite(amount) || amount <= 0) {
      return []
    }

    return [{
      label,
      amount: Number(amount.toFixed(2)),
    }]
  })
}

// GET /logs - Finance audit trail
router.get('/logs', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { teamMemberId, entityType, action, entityId, startDate, endDate, q, limit } = req.query as {
      teamMemberId?: string
      entityType?: string
      action?: string
      entityId?: string
      startDate?: string
      endDate?: string
      q?: string
      limit?: string
    }

    const conditions: any[] = []
    const parsedTeamMemberId = teamMemberId ? parseInt(teamMemberId) : NaN
    if (Number.isFinite(parsedTeamMemberId)) conditions.push(eq(financeActivityLogs.teamMemberId, parsedTeamMemberId))
    const parsedEntityId = entityId ? parseInt(entityId) : NaN
    if (Number.isFinite(parsedEntityId)) conditions.push(eq(financeActivityLogs.entityId, parsedEntityId))
    if (entityType) conditions.push(eq(financeActivityLogs.entityType, entityType))
    if (action) conditions.push(eq(financeActivityLogs.action, action))
    if (startDate) conditions.push(gte(financeActivityLogs.createdAt, new Date(`${startDate}T00:00:00.000Z`)))
    if (endDate) conditions.push(lte(financeActivityLogs.createdAt, new Date(`${endDate}T23:59:59.999Z`)))
    if (q) {
      conditions.push(sql`(
        ${financeActivityLogs.summary} ILIKE ${`%${q}%`} OR
        CAST(${financeActivityLogs.metadata} AS TEXT) ILIKE ${`%${q}%`} OR
        CAST(${financeActivityLogs.beforeData} AS TEXT) ILIKE ${`%${q}%`} OR
        CAST(${financeActivityLogs.afterData} AS TEXT) ILIKE ${`%${q}%`}
      )`)
    }

    const parsedLimit = limit ? parseInt(limit) : 100
    const maxLimit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 250)

    const rows = await db
      .select({
        id: financeActivityLogs.id,
        action: financeActivityLogs.action,
        entityType: financeActivityLogs.entityType,
        entityId: financeActivityLogs.entityId,
        teamMemberId: financeActivityLogs.teamMemberId,
        clientId: financeActivityLogs.clientId,
        invoiceId: financeActivityLogs.invoiceId,
        transactionId: financeActivityLogs.transactionId,
        summary: financeActivityLogs.summary,
        beforeData: financeActivityLogs.beforeData,
        afterData: financeActivityLogs.afterData,
        metadata: financeActivityLogs.metadata,
        createdAt: financeActivityLogs.createdAt,
        actorName: users.fullName,
        actorAvatarUrl: users.avatarUrl,
      })
      .from(financeActivityLogs)
      .leftJoin(users, eq(financeActivityLogs.actorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(financeActivityLogs.createdAt), desc(financeActivityLogs.id))
      .limit(maxLimit)

    res.json(rows)
  } catch (error) {
    console.error('Finance logs error:', error)
    res.status(500).json({ error: 'Failed to fetch finance logs' })
  }
})

// GET /overview - Dashboard summary
router.get('/overview', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }

    // Build date conditions for transactions
    const txConditions: any[] = [isNull(financialTransactions.voidedAt)]
    if (startDate) txConditions.push(gte(financialTransactions.transactionDate, startDate))
    if (endDate) txConditions.push(lte(financialTransactions.transactionDate, endDate))

    // Sum by type from financial_transactions
    const txSums = await db
      .select({
        type: financialTransactions.type,
        total: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
      })
      .from(financialTransactions)
      .where(txConditions.length > 0 ? and(...txConditions) : undefined)
      .groupBy(financialTransactions.type)

    // Sum paid invoices (auto-pulled client payments)
    const invoiceFilter = paidInvoiceConditions(startDate, endDate)

    const [invSum] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(invoiceFilter)

    // Monthly breakdown from transactions
    const monthlyTx = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})::int`,
        type: financialTransactions.type,
        total: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
      })
      .from(financialTransactions)
      .where(txConditions.length > 0 ? and(...txConditions) : undefined)
      .groupBy(
        sql`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})`,
        sql`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})`,
        financialTransactions.type
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})`,
        sql`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})`
      )

    // Monthly client payments
    const monthlyInv = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${invoices.paidAt})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${invoices.paidAt})::int`,
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(invoiceFilter)
      .groupBy(
        sql`EXTRACT(MONTH FROM ${invoices.paidAt})`,
        sql`EXTRACT(YEAR FROM ${invoices.paidAt})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${invoices.paidAt})`,
        sql`EXTRACT(MONTH FROM ${invoices.paidAt})`
      )

    // Build totals
    const totals: Record<string, number> = {
      income: 0,
      expense: 0,
      salary: 0,
      extra_payment: 0,
      client_payments: parseFloat(invSum?.total || '0'),
    }
    for (const row of txSums) {
      totals[row.type] = parseFloat(row.total)
    }

    const totalIncome = totals.income + totals.client_payments
    const totalExpenses = totals.expense + totals.salary + totals.extra_payment
    const netProfitLoss = totalIncome - totalExpenses

    // Merge monthly data
    const monthlyMap = new Map<string, any>()
    for (const row of monthlyTx) {
      const key = `${row.year}-${row.month}`
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: row.month, year: row.year, income: 0, expense: 0, salary: 0, extra_payment: 0, client_payments: 0 })
      }
      monthlyMap.get(key)[row.type] = parseFloat(row.total)
    }
    for (const row of monthlyInv) {
      const key = `${row.year}-${row.month}`
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: row.month, year: row.year, income: 0, expense: 0, salary: 0, extra_payment: 0, client_payments: 0 })
      }
      monthlyMap.get(key).client_payments = parseFloat(row.total)
    }

    const monthlyBreakdown = Array.from(monthlyMap.values()).sort(
      (a, b) => a.year - b.year || a.month - b.month
    )

    res.json({
      totalIncome,
      totalExpenses,
      totalSalaries: totals.salary,
      totalExtraPayments: totals.extra_payment,
      clientPayments: totals.client_payments,
      manualIncome: totals.income,
      manualExpenses: totals.expense,
      netProfitLoss,
      monthlyBreakdown,
    })
  } catch (error) {
    console.error('Finances overview error:', error)
    res.status(500).json({ error: 'Failed to fetch finances overview' })
  }
})

// GET /transactions - List with filters
router.get('/transactions', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { type, startDate, endDate, teamMemberId, category } = req.query as {
      type?: string; startDate?: string; endDate?: string;
      teamMemberId?: string; category?: string;
    }

    const conditions: any[] = [isNull(financialTransactions.voidedAt)]
    if (type) conditions.push(eq(financialTransactions.type, type))
    if (startDate) conditions.push(gte(financialTransactions.transactionDate, startDate))
    if (endDate) conditions.push(lte(financialTransactions.transactionDate, endDate))
    if (teamMemberId) conditions.push(eq(financialTransactions.teamMemberId, parseInt(teamMemberId)))
    if (category) conditions.push(eq(financialTransactions.category, category))

    const results = await db
      .select({
        id: financialTransactions.id,
        type: financialTransactions.type,
        category: financialTransactions.category,
        amount: financialTransactions.amount,
        description: financialTransactions.description,
        transactionDate: financialTransactions.transactionDate,
        teamMemberId: financialTransactions.teamMemberId,
        teamMemberName: teamMembers.name,
        clientId: financialTransactions.clientId,
        clientName: clients.name,
        invoiceId: financialTransactions.invoiceId,
        isRecurring: financialTransactions.isRecurring,
        createdBy: financialTransactions.createdBy,
        createdAt: financialTransactions.createdAt,
        payrollData: financialTransactions.payrollData,
        payrollPeriodId: financialTransactions.payrollPeriodId,
        updatedAt: financialTransactions.updatedAt,
      })
      .from(financialTransactions)
      .leftJoin(teamMembers, eq(financialTransactions.teamMemberId, teamMembers.id))
      .leftJoin(clients, eq(financialTransactions.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id))

    res.json(results)
  } catch (error) {
    console.error('Finances transactions error:', error)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

// POST /transactions - Create
router.post('/transactions', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { type, category, amount, description, transactionDate, teamMemberId, clientId, invoiceId, isRecurring } = req.body

    if (!type || !amount || !transactionDate) {
      return res.status(400).json({ error: 'type, amount, and transactionDate are required' })
    }

    if (!['income', 'expense', 'extra_payment'].includes(type)) throw new FinanceValidationError('Use the salary payment workflow for payroll transactions')
    if(type==='extra_payment' && teamMemberId) throw new FinanceValidationError('Record employee bonuses in payroll or freelancer project fees in the Team profile so employment rules apply')
    cents(amount, 'Amount', false)
    validDate(transactionDate, 'Transaction date')
    if (invoiceId) throw new FinanceValidationError('Invoice payments are recorded through the invoice payment workflow')
    const categoryKind = normalizeCategoryKind(type)
    let categoryValue = typeof category === 'string' ? category.trim() : ''

    if (categoryKind && categoryValue) {
      const ensuredCategory = await ensureCategoryExists(categoryKind, categoryValue, req.user?.id)
      categoryValue = ensuredCategory?.name || categoryValue
    }

    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(financialTransactions)
        .values({
          type,
          category: categoryValue || null,
          amount: amount.toString(),
          description: description || null,
          transactionDate,
          teamMemberId: teamMemberId || null,
          clientId: clientId || null,
          invoiceId: invoiceId || null,
          isRecurring: isRecurring || false,
          createdBy: req.user!.id,
        })
        .returning()

      const snapshot = pickTransactionSnapshot(row)
      await logFinanceActivity(tx, {
        action: 'transaction_created',
        entityType: 'transaction',
        entityId: row.id,
        transactionId: row.id,
        teamMemberId: row.teamMemberId,
        clientId: row.clientId,
        invoiceId: row.invoiceId,
        actorId: req.user!.id,
        summary: `Created ${row.type} transaction for $${Number(row.amount).toFixed(2)}`,
        afterData: snapshot,
        metadata: { category: row.category, isRecurring: row.isRecurring },
      })

      return [row]
    })

    res.status(201).json(created)
  } catch (error) {
    console.error('Create transaction error:', error)
    financeError(res, error, 'Failed to create transaction')
  }
})

// PUT /transactions/:id - Update
router.put('/transactions/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id = parseInt(req.params.id)
    const { type, category, amount, description, transactionDate, teamMemberId, clientId, isRecurring } = req.body

    const [updated] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(financialTransactions)
        .where(eq(financialTransactions.id, id))
        .limit(1)

      if (!existing) {
        return [null]
      }

      if ((await tx.select({id:freelancerFees.id}).from(freelancerFees).where(eq(freelancerFees.paymentTransactionId,id))).length) throw new FinanceValidationError('Project fee payments cannot be edited independently of the accrual',409)
      if (existing.type === 'salary' || existing.payrollPeriodId) throw new FinanceValidationError('Use the salary payment workflow to edit payroll', 409)
      if (existing.voidedAt) throw new FinanceValidationError('Voided transactions cannot be edited', 409)
      const linked = await tx.select({id:reimbursementRequests.id}).from(reimbursementRequests).where(eq(reimbursementRequests.paymentTransactionId,id))
      if (linked.length) throw new FinanceValidationError('Reimbursement payments require reconciliation and cannot be edited here',409)
      if((type ?? existing.type)==='extra_payment' && (teamMemberId ?? existing.teamMemberId)) throw new FinanceValidationError('Record bonuses through payroll so employment rules apply')
      if (type !== undefined && !['income','expense','extra_payment'].includes(type)) throw new FinanceValidationError('Invalid transaction type')
      if (amount !== undefined) cents(amount, 'Amount', false)
      if (transactionDate !== undefined) validDate(transactionDate, 'Transaction date')
      const updateData: any = { updatedAt: new Date() }
      if (type !== undefined) updateData.type = type
      if (amount !== undefined) updateData.amount = amount.toString()
      if (description !== undefined) updateData.description = description
      if (transactionDate !== undefined) updateData.transactionDate = transactionDate
      if (teamMemberId !== undefined) updateData.teamMemberId = teamMemberId || null
      if (clientId !== undefined) updateData.clientId = clientId || null
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring

      if (category !== undefined) {
        let txType = (type as string | undefined) || existing.type
        const categoryKind = normalizeCategoryKind(txType)
        const categoryValue = typeof category === 'string' ? category.trim() : category

        if (categoryKind && typeof categoryValue === 'string' && categoryValue) {
          const ensuredCategory = await ensureCategoryExists(categoryKind, categoryValue, req.user?.id)
          updateData.category = ensuredCategory?.name || categoryValue
        } else if (categoryValue === '' || categoryValue === null) {
          updateData.category = null
        } else {
          updateData.category = categoryValue
        }
      }

      const [row] = await tx
        .update(financialTransactions)
        .set(updateData)
        .where(eq(financialTransactions.id, id))
        .returning()

      if (!row) {
        return [null]
      }

      const beforeData = pickTransactionSnapshot(existing)
      const afterData = pickTransactionSnapshot(row)
      await logFinanceActivity(tx, {
        action: 'transaction_updated',
        entityType: 'transaction',
        entityId: row.id,
        transactionId: row.id,
        teamMemberId: row.teamMemberId,
        clientId: row.clientId,
        invoiceId: row.invoiceId,
        actorId: req.user!.id,
        summary: `Updated ${row.type} transaction #${row.id}`,
        beforeData,
        afterData,
        metadata: { changes: diffRecord(beforeData, afterData) },
      })

      return [row]
    })

    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    res.json(updated)
  } catch (error) {
    console.error('Update transaction error:', error)
    financeError(res, error, 'Failed to update transaction')
  }
})

// DELETE /transactions/:id
router.delete('/transactions/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id=positiveId(req.params.id)
    await db.transaction(async(tx)=>{
      let [existing]=await tx.select().from(financialTransactions).where(eq(financialTransactions.id,id))
      if(!existing) throw new FinanceValidationError('Transaction not found',404)
      if (existing.type === 'salary' || existing.payrollPeriodId) await requireWorkflowCapability(req.user!, 'canRecordPayment')
      if(existing.teamMemberId) await payrollLock(tx,existing.teamMemberId)
      ;[existing]=await tx.select().from(financialTransactions).where(eq(financialTransactions.id,id)).for('update')
      if(existing.voidedAt) return
      if ((await tx.select({id:freelancerFees.id}).from(freelancerFees).where(eq(freelancerFees.paymentTransactionId,id))).length) throw new FinanceValidationError('Project fee payments require reconciliation before voiding',409)
      const linked=await tx.select({id:reimbursementRequests.id}).from(reimbursementRequests).where(eq(reimbursementRequests.paymentTransactionId,id))
      if(linked.length) throw new FinanceValidationError('This payment settles a reimbursement. It cannot be voided without reconciling that reimbursement.',409)
      await tx.update(financialTransactions).set({voidedAt:new Date(),voidReason:'Voided by administrator',updatedAt:new Date()}).where(eq(financialTransactions.id,id))
      if(existing.payrollPeriodId) await tx.update(payrollPeriods).set({status:'open',updatedAt:new Date()}).where(eq(payrollPeriods.id,existing.payrollPeriodId))
      await logFinanceActivity(tx,{action:existing.type==='salary'?'salary_payment_deleted':'transaction_deleted',entityType:existing.type==='salary'?'salary_payment':'transaction',entityId:id,transactionId:id,teamMemberId:existing.teamMemberId,actorId:req.user!.id,summary:`Voided ${existing.type} transaction #${id}`,beforeData:{...pickTransactionSnapshot(existing),payrollData:existing.payrollData}})
    })
    res.json({message:'Transaction voided; its audit history is preserved'})
  } catch(error){ financeError(res,error,'Failed to void transaction') }
})

// GET /client-payments - Auto-pulled paid invoices
router.get('/client-payments', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const includeExcluded = req.query.includeExcluded === 'true'

    const results = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        invoiceDate: invoices.invoiceDate,
        paidAt: invoices.paidAt,
        clientId: invoices.clientId,
        clientName: clients.name,
        description: invoices.description,
        excluded: invoicePaymentExcluded,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(paidInvoiceConditions(startDate, endDate, includeExcluded))
      .orderBy(desc(invoices.paidAt))

    res.json(results)
  } catch (error) {
    console.error('Client payments error:', error)
    res.status(500).json({ error: 'Failed to fetch client payments' })
  }
})

// PATCH /client-payments/:id - Change whether a paid invoice is included in finance reports
router.patch('/client-payments/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id = positiveId(req.params.id)
    const { excluded, paidAt } = req.body ?? {}
    if (typeof excluded !== 'boolean' || typeof paidAt !== 'string' || !Number.isFinite(Date.parse(paidAt))) {
      throw new FinanceValidationError('A payment date and exclusion status are required')
    }

    await db.transaction(async (tx) => {
      const [invoice] = await tx.select({
        clientId: invoices.clientId,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        paidAt: invoices.paidAt,
        excluded: invoicePaymentExcluded,
      }).from(invoices)
        .where(and(eq(invoices.id, id), paidInvoiceConditions(undefined, undefined, true)))
        .for('update')

      if (!invoice) throw new FinanceValidationError('Paid invoice not found', 404)
      if (invoice.paidAt?.getTime() !== Date.parse(paidAt)) {
        throw new FinanceValidationError('This payment date has changed. Refresh the transactions and try again.', 409)
      }
      if (invoice.excluded === excluded) return

      await tx.update(invoices)
        .set({ financeExcludedPaidAt: excluded ? sql`${invoices.paidAt}` : null })
        .where(eq(invoices.id, id))
      await logFinanceActivity(tx, {
        action: excluded ? 'invoice_income_excluded' : 'invoice_income_restored',
        entityType: 'invoice',
        entityId: id,
        invoiceId: id,
        clientId: invoice.clientId,
        actorId: req.user!.id,
        summary: `${excluded ? 'Excluded' : 'Restored'} income from invoice #${invoice.invoiceNumber}`,
        beforeData: invoice,
        afterData: { ...invoice, excluded },
      })
    })
    res.json({ excluded })
  } catch (error) {
    financeError(res, error, 'Failed to update invoice income')
  }
})

function selectSalaryPayments() {
  return db.select({
    id: financialTransactions.id,
    teamMemberId: financialTransactions.teamMemberId,
    teamMemberName: teamMembers.name,
    amount: financialTransactions.amount,
    description: financialTransactions.description,
    transactionDate: financialTransactions.transactionDate,
    createdAt: financialTransactions.createdAt,
    payrollData: financialTransactions.payrollData,
    payrollPeriodId: financialTransactions.payrollPeriodId,
  })
    .from(financialTransactions)
    .leftJoin(teamMembers, eq(financialTransactions.teamMemberId, teamMembers.id))
}

// GET /salaries - Team members with rates + payment history
router.get('/salaries', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { year } = req.query as { year?: string }
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Get all team members
    const members = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        position: teamMembers.position,
        startDate: teamMembers.startDate,
        monthlyRate: teamMembers.monthlyRate,
        hourlyRate: teamMembers.hourlyRate,
        isBillable: teamMembers.isBillable,
        avatarUrl: teamMembers.avatarUrl,
        status: teamMembers.status,
        monthlySalaryExtras: teamMembers.monthlySalaryExtras,
        employmentType: teamMembers.employmentType,
      })
      .from(teamMembers)
      .orderBy(teamMembers.name)

    const employees = members.filter(member => member.employmentType !== 'freelancer')
    const today = new Date().toISOString().slice(0, 10)
    const salaryFilter = and(eq(financialTransactions.type, 'salary'), isNull(financialTransactions.voidedAt))
    const yearFilter = and(
      salaryFilter,
      gte(financialTransactions.transactionDate, `${targetYear}-01-01`),
      lte(financialTransactions.transactionDate, `${targetYear}-12-31`),
    )
    const yearOnly = req.query.paymentScope === 'year'

    const [salaryPayments, payments, employeePeriods] = await Promise.all([
      db.select({
        teamMemberId: financialTransactions.teamMemberId,
        totalPaid: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
        lastPaymentDate: sql<string>`MAX(${financialTransactions.transactionDate})`,
        paymentCount: sql<number>`COUNT(*)::int`,
      }).from(financialTransactions).where(yearFilter).groupBy(financialTransactions.teamMemberId),
      selectSalaryPayments()
        .where(yearOnly ? yearFilter : salaryFilter)
        .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id)),
      salaryOverviewPeriods(db, employees, targetYear, today),
    ])

    const paymentMap = new Map(salaryPayments.map(payment => [payment.teamMemberId, payment]))
    const membersWithPayments = employeePeriods.map(({ member, activeTerms, currentPeriod, periods }) => {
      const summary = paymentMap.get(member.id)
      return {
        ...member,
        monthlyRate: activeTerms?.monthlyRate ?? member.monthlyRate,
        totalPaidThisYear: summary ? parseFloat(summary.totalPaid) : 0,
        lastPaymentDate: summary?.lastPaymentDate || null,
        paymentCount: summary?.paymentCount || 0,
        monthlySalaryExtras: normalizeSalaryExtras(activeTerms?.monthlyExtras ?? member.monthlySalaryExtras),
        currentPeriod,
        periods,
      }
    })

    res.json({
      members: membersWithPayments,
      ...(yearOnly ? { payments } : { recentPayments: payments.slice(0, 1000), allPayments: payments }),
      year: targetYear,
    })
  } catch (error) {
    console.error('Salaries error:', error)
    res.status(500).json({ error: 'Failed to fetch salaries' })
  }
})

// POST /salaries/record - Record salary payment
router.get('/salaries/:teamMemberId/period/:month', async(req,res)=>{
  if(!isAdmin(req,res)) return
  try { const [member]=await db.select().from(teamMembers).where(eq(teamMembers.id,positiveId(req.params.teamMemberId))); if(!member) throw new FinanceValidationError('Team member not found',404); res.json(await salaryPeriodDetails(db,member,validMonth(req.params.month))) } catch(error){financeError(res,error,'Failed to load salary period')}
})
router.post('/salaries/:teamMemberId/period/:month/initialize',async(req,res)=>{
  if(!isAdmin(req,res))return
  try{res.json(await db.transaction(tx=>initializePayrollPeriod(tx,positiveId(req.params.teamMemberId),validMonth(req.params.month),req.user!.id)))}catch(error){financeError(res,error,'Failed to initialize salary period')}
})
router.post('/salaries/record', async (req,res)=>{
  if(!isAdmin(req,res)) return
  try {
    await requireWorkflowCapability(req.user!, 'canRecordPayment')
    const result=await db.transaction(tx=>recordPayroll(tx,req.user!.id,req.body))
    let email:SalaryPaymentEmailStatus={delivered:false,skipped:true,provider:'none'}
    const data = readPayrollData(result.payment.payrollData)!
    const currentMonth = new Date().toISOString().slice(0, 7)
    const isBackfill = data.salaryMonth < currentMonth && result.payment.transactionDate.slice(0, 7) < currentMonth
    if (!result.duplicate && !isBackfill) {
      try {
        email = await sendEmail(buildSalaryPaymentEmail({
          to: result.member.email,
          employeeName: result.member.name,
          salaryMonth: data.salaryMonth,
          paymentDate: result.payment.transactionDate,
          baseSalary: Number(data.baseSalary),
          salaryPaidNow: Number(data.paidBase),
          remainingSalary: Number(result.summary.remainingBase),
          extras: data.extras.map(e => ({ label: e.label, amount: Number(e.amount) })),
          totalPayout: Number(result.payment.amount),
          note: data.note,
        }))
      } catch (error) {
        email = { delivered: false, error: error instanceof Error ? error.message : 'Email failed' }
      }
    }
    res.status(result.duplicate?200:201).json({...result.payment,email,duplicate:result.duplicate})
  } catch(error){ financeError(res,error,'Failed to record salary payment') }
})
router.put('/salaries/payments/:id',async(req,res)=>{
  if(!isAdmin(req,res)) return
  try { await requireWorkflowCapability(req.user!, 'canRecordPayment'); const result=await db.transaction(tx=>recordPayroll(tx,req.user!.id,req.body,positiveId(req.params.id))); res.json(result.payment) }catch(error){financeError(res,error,'Failed to update salary payment')}
})
// Employees receive their own payslips only; the linked team member is resolved on the server.
router.get('/my-salary',async(req,res)=>{
  try {
    const employeeId=await resolveEmployeeId(req.user)
    if(!employeeId) throw new FinanceValidationError('Employee profile required',403)
    const [member]=await db.select().from(teamMembers).where(eq(teamMembers.id,employeeId))
    if(!member) throw new FinanceValidationError('Employee profile not found',404)
    const [payments,periods,projectPayments]=await Promise.all([
      db.select({id:financialTransactions.id,amount:financialTransactions.amount,transactionDate:financialTransactions.transactionDate,payrollData:financialTransactions.payrollData,description:financialTransactions.description}).from(financialTransactions).where(and(eq(financialTransactions.teamMemberId,member.id),eq(financialTransactions.type,'salary'),isNull(financialTransactions.voidedAt))).orderBy(desc(financialTransactions.transactionDate)),
      db.select().from(payrollPeriods).where(eq(payrollPeriods.teamMemberId,member.id)),
      db.select({id:freelancerFees.id,description:freelancerFees.description,amount:freelancerFees.amount,accruedDate:freelancerFees.accruedDate,paymentDate:financialTransactions.transactionDate,projectName:clientServices.serviceTitle,serviceName:serviceTypes.name,clientName:clients.name,transactionId:freelancerFees.paymentTransactionId})
        .from(freelancerFees)
        .innerJoin(clientServices,eq(clientServices.id,freelancerFees.clientServiceId))
        .innerJoin(serviceTypes,eq(serviceTypes.id,clientServices.serviceTypeId))
        .innerJoin(clients,eq(clients.id,clientServices.clientId))
        .innerJoin(financialTransactions,eq(financialTransactions.id,freelancerFees.paymentTransactionId))
        .where(and(eq(freelancerFees.teamMemberId,member.id),eq(freelancerFees.status,'paid'),isNull(financialTransactions.voidedAt)))
        .orderBy(desc(financialTransactions.transactionDate),desc(freelancerFees.id)),
    ])
    res.json({currency:'USD',payments,projectPayments,periods:await Promise.all(periods.map(p=>salaryPeriodView(db,member,p.salaryMonth)))})
  }catch(error){financeError(res,error,'Failed to load payslips')}
})

// GET /categories
router.get('/categories', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const rawKind = typeof req.query.kind === 'string' ? req.query.kind : undefined
    const categoryKind = normalizeCategoryKind(rawKind)

    if (rawKind && !categoryKind) {
      return res.status(400).json({ error: 'kind must be income or expense' })
    }

    const results = await db
      .select({
        id: financeCategories.id,
        kind: financeCategories.kind,
        name: financeCategories.name,
        createdAt: financeCategories.createdAt,
        updatedAt: financeCategories.updatedAt,
      })
      .from(financeCategories)
      .where(categoryKind ? eq(financeCategories.kind, categoryKind) : undefined)
      .orderBy(asc(financeCategories.kind), asc(financeCategories.name))

    if (categoryKind) {
      return res.json(results)
    }

    res.json({
      income: results.filter((category) => category.kind === 'income'),
      expense: results.filter((category) => category.kind === 'expense'),
    })
  } catch (error) {
    console.error('Categories error:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

// POST /categories
router.post('/categories', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const categoryKind = normalizeCategoryKind(req.body?.kind)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

    if (!categoryKind) {
      return res.status(400).json({ error: 'kind must be income or expense' })
    }

    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }

    const [existing] = await db
      .select({ id: financeCategories.id })
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.kind, categoryKind),
          sql`lower(${financeCategories.name}) = lower(${name})`
        )
      )
      .limit(1)

    if (existing) {
      return res.status(409).json({ error: 'Category already exists for this list' })
    }

    const [created] = await db
      .insert(financeCategories)
      .values({
        kind: categoryKind,
        name,
        createdBy: req.user?.id || null,
      })
      .returning({
        id: financeCategories.id,
        kind: financeCategories.kind,
        name: financeCategories.name,
        createdAt: financeCategories.createdAt,
        updatedAt: financeCategories.updatedAt,
      })

    res.status(201).json(created)
  } catch (error) {
    console.error('Create category error:', error)
    res.status(500).json({ error: 'Failed to create category' })
  }
})

// PUT /categories/:id
router.put('/categories/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category id' })
    }

    const [current] = await db
      .select({
        id: financeCategories.id,
        kind: financeCategories.kind,
        name: financeCategories.name,
      })
      .from(financeCategories)
      .where(eq(financeCategories.id, id))
      .limit(1)

    if (!current) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const normalizedKind = req.body?.kind !== undefined
      ? normalizeCategoryKind(req.body.kind)
      : null

    if (req.body?.kind !== undefined && !normalizedKind) {
      return res.status(400).json({ error: 'kind must be income or expense' })
    }

    const normalizedName = req.body?.name !== undefined
      ? (typeof req.body.name === 'string' ? req.body.name.trim() : '')
      : undefined

    if (normalizedName !== undefined && !normalizedName) {
      return res.status(400).json({ error: 'name cannot be empty' })
    }

    const nextKind = normalizedKind || current.kind
    const nextName = normalizedName || current.name

    const [duplicate] = await db
      .select({ id: financeCategories.id })
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.kind, nextKind),
          sql`lower(${financeCategories.name}) = lower(${nextName})`,
          sql`${financeCategories.id} <> ${id}`
        )
      )
      .limit(1)

    if (duplicate) {
      return res.status(409).json({ error: 'Category already exists for this list' })
    }

    const updateData: any = { updatedAt: new Date() }
    if (normalizedKind) updateData.kind = normalizedKind
    if (normalizedName !== undefined) updateData.name = normalizedName

    const [updated] = await db
      .update(financeCategories)
      .set(updateData)
      .where(eq(financeCategories.id, id))
      .returning({
        id: financeCategories.id,
        kind: financeCategories.kind,
        name: financeCategories.name,
        createdAt: financeCategories.createdAt,
        updatedAt: financeCategories.updatedAt,
      })

    res.json(updated)
  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({ error: 'Failed to update category' })
  }
})

// DELETE /categories/:id
router.delete('/categories/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category id' })
    }

    const [deleted] = await db
      .delete(financeCategories)
      .where(eq(financeCategories.id, id))
      .returning({ id: financeCategories.id })

    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' })
    }

    res.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

// GET /balances - External payment gateway balances (reads credentials from DB)
router.get('/balances', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    let stripeBalance: { available: number; pending: number; currency: string } | null = null
    let payoneerBalance: { available: number; currency: string } | null = null

    // Load integration settings from DB
    const integrations = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.isActive, true))

    // Stripe balance
    const stripeRow = integrations.find((r) => r.provider === 'stripe')
    if (stripeRow?.credentials) {
      try {
        const creds = JSON.parse(decrypt(stripeRow.credentials)) as { secretKey: string }
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(creds.secretKey)
        const balance = await stripe.balance.retrieve()
        const available = balance.available[0]
        const pending = balance.pending[0]
        stripeBalance = {
          available: (available?.amount || 0) / 100,
          pending: (pending?.amount || 0) / 100,
          currency: (available?.currency || 'usd').toUpperCase(),
        }
        // Update lastSyncAt
        await db.update(integrationSettings).set({ lastSyncAt: new Date() }).where(eq(integrationSettings.provider, 'stripe'))
      } catch (err) {
        console.error('Stripe balance error:', err)
      }
    }

    // Payoneer balance
    const payoneerRow = integrations.find((r) => r.provider === 'payoneer')
    if (payoneerRow?.credentials) {
      try {
        const creds = JSON.parse(decrypt(payoneerRow.credentials)) as {
          clientId: string
          clientSecret: string
          programId: string
          environment?: string
        }
        const env = creds.environment === 'production' ? '' : 'sandbox.'
        const tokenUrl = `https://${env}api.payoneer.com/v2/oauth2/token`

        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64'),
          },
          body: 'grant_type=client_credentials',
        })

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json() as { access_token: string }
          const balanceUrl = `https://${env}api.payoneer.com/v4/programs/${creds.programId}/balance`
          const balanceRes = await fetch(balanceUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
          })

          if (balanceRes.ok) {
            const balanceData = await balanceRes.json() as {
              result?: Array<{ balance: number; currency: string }>
              balance?: number
              currency?: string
            }
            if (balanceData.result && balanceData.result.length > 0) {
              payoneerBalance = {
                available: balanceData.result[0].balance,
                currency: balanceData.result[0].currency.toUpperCase(),
              }
            } else if (balanceData.balance !== undefined) {
              payoneerBalance = {
                available: balanceData.balance,
                currency: (balanceData.currency || 'USD').toUpperCase(),
              }
            }
          }
          // Update lastSyncAt
          await db.update(integrationSettings).set({ lastSyncAt: new Date() }).where(eq(integrationSettings.provider, 'payoneer'))
        }
      } catch (err) {
        console.error('Payoneer balance error:', err)
      }
    }

    res.json({
      stripe: stripeBalance,
      payoneer: payoneerBalance,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Balances error:', error)
    res.status(500).json({ error: 'Failed to fetch balances' })
  }
})

// PUT /salaries/:teamMemberId/rate - Update monthly base salary and log history
async function updateSalaryTerms(req:any,res:any,extrasOnly=false){
  if(!isAdmin(req,res)) return
  try {
    const memberId=positiveId(req.params.teamMemberId), effectiveDate=validDate(req.body.effectiveDate || new Date().toISOString().slice(0,10))
    if(!extrasOnly) cents(req.body.monthlyRate,'Monthly salary')
    if(extrasOnly || req.body.monthlyExtras!==undefined) salaryExtras(req.body.monthlyExtras)
    const row=await db.transaction(async(tx)=>{
      await payrollLock(tx,memberId)
      const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
      if(!member) throw new FinanceValidationError('Team member not found',404)
      assertEmployeeBenefits(member)
      if(effectiveDate<member.startDate) throw new FinanceValidationError('Salary terms cannot predate employment')
      const history=await tx.select().from(salaryRateHistory).where(eq(salaryRateHistory.teamMemberId,memberId)).orderBy(desc(salaryRateHistory.effectiveDate),desc(salaryRateHistory.id))
      const baselineDate=member.startDate>`${new Date().toISOString().slice(0,7)}-01`?member.startDate:`${new Date().toISOString().slice(0,7)}-01`
      if(!history.length&&effectiveDate>=baselineDate) await tx.insert(salaryRateHistory).values({teamMemberId:memberId,employmentType:member.employmentType,monthlyRate:member.monthlyRate || '0',monthlyExtras:salaryExtras(member.monthlySalaryExtras || []),effectiveDate:baselineDate,createdBy:req.user!.id,note:'Current-month profile baseline before terms change; earlier terms remain unverified'})
      // Find the conditions at the effective date, not a future change.
      const applicable=history.find(h=>h.effectiveDate<=effectiveDate)
      const monthlyRate=extrasOnly?(applicable?.monthlyRate || member.monthlyRate || '0'):money(cents(req.body.monthlyRate))
      const monthlyExtras=(extrasOnly||req.body.monthlyExtras!==undefined)?salaryExtras(req.body.monthlyExtras):salaryExtras(applicable?.monthlyExtras ?? member.monthlySalaryExtras ?? [])
      const [next]=await tx.insert(salaryRateHistory).values({teamMemberId:memberId,employmentType:member.employmentType,monthlyRate,monthlyExtras,effectiveDate,note:req.body.note || null,createdBy:req.user!.id}).returning()
      if(effectiveDate<=new Date().toISOString().slice(0,10)) await tx.update(teamMembers).set({monthlyRate,monthlySalaryExtras:monthlyExtras,updatedAt:new Date()}).where(eq(teamMembers.id,memberId))
      await logFinanceActivity(tx,{action:extrasOnly?'salary_extras_updated':'salary_rate_updated',entityType:extrasOnly?'salary_extras':'salary_rate',entityId:memberId,teamMemberId:memberId,actorId:req.user!.id,summary:`Scheduled salary terms from ${effectiveDate}`,beforeData:{monthlyRate:member.monthlyRate,monthlyExtras:member.monthlySalaryExtras},afterData:{monthlyRate,monthlyExtras,effectiveDate}})
      return next
    })
    res.json({success:true,monthlyRate:row.monthlyRate,monthlyExtras:row.monthlyExtras,effectiveDate:row.effectiveDate})
  }catch(error){financeError(res,error,'Failed to update salary terms')}
}
router.put('/salaries/:teamMemberId/rate',(req,res)=>updateSalaryTerms(req,res))
router.put('/salaries/:teamMemberId/monthly-extras',(req,res)=>updateSalaryTerms(req,res,true))

// GET /salaries/:teamMemberId/rate-history - Get salary rate change history
router.get('/salaries/:teamMemberId/rate-history', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const teamMemberId = parseInt(req.params.teamMemberId)

    const history = await db
      .select({
        id: salaryRateHistory.id,
        monthlyRate: salaryRateHistory.monthlyRate,
        monthlyExtras: salaryRateHistory.monthlyExtras,
        effectiveDate: salaryRateHistory.effectiveDate,
        note: salaryRateHistory.note,
        createdBy: users.fullName,
        createdAt: salaryRateHistory.createdAt,
      })
      .from(salaryRateHistory)
      .leftJoin(users, eq(salaryRateHistory.createdBy, users.id))
      .where(eq(salaryRateHistory.teamMemberId, teamMemberId))
      .orderBy(desc(salaryRateHistory.effectiveDate))

    res.json(history)
  } catch (error) {
    console.error('Salary rate history error:', error)
    res.status(500).json({ error: 'Failed to fetch salary rate history' })
  }
})

// GET /salaries/:teamMemberId/history - Combined salary history for the card popup
router.get('/salaries/:teamMemberId/history', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const teamMemberId = parseInt(req.params.teamMemberId)

    const [member] = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        monthlyRate: teamMembers.monthlyRate,
        monthlySalaryExtras: teamMembers.monthlySalaryExtras,
        employmentType: teamMembers.employmentType,
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId))
      .limit(1)

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    const [logEntries, rateRows, payments] = await Promise.all([
      db
        .select({
          id: financeActivityLogs.id,
          action: financeActivityLogs.action,
          entityType: financeActivityLogs.entityType,
          entityId: financeActivityLogs.entityId,
          summary: financeActivityLogs.summary,
          beforeData: financeActivityLogs.beforeData,
          afterData: financeActivityLogs.afterData,
          metadata: financeActivityLogs.metadata,
          createdAt: financeActivityLogs.createdAt,
          actorName: users.fullName,
          actorAvatarUrl: users.avatarUrl,
        })
        .from(financeActivityLogs)
        .leftJoin(users, eq(financeActivityLogs.actorId, users.id))
        .where(eq(financeActivityLogs.teamMemberId, teamMemberId))
        .orderBy(desc(financeActivityLogs.createdAt), desc(financeActivityLogs.id))
        .limit(100),
      db
        .select({
          id: salaryRateHistory.id,
          monthlyRate: salaryRateHistory.monthlyRate,
          monthlyExtras: salaryRateHistory.monthlyExtras,
          effectiveDate: salaryRateHistory.effectiveDate,
          note: salaryRateHistory.note,
          createdAt: salaryRateHistory.createdAt,
          actorName: users.fullName,
          actorAvatarUrl: users.avatarUrl,
        })
        .from(salaryRateHistory)
        .leftJoin(users, eq(salaryRateHistory.createdBy, users.id))
        .where(eq(salaryRateHistory.teamMemberId, teamMemberId))
        .orderBy(desc(salaryRateHistory.createdAt), desc(salaryRateHistory.id))
        .limit(100),
      selectSalaryPayments()
        .where(and(eq(financialTransactions.teamMemberId, teamMemberId), eq(financialTransactions.type, 'salary'), isNull(financialTransactions.voidedAt)))
        .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id)),
    ])

    const normalizedLogs = logEntries.map((entry) => ({
      id: `log-${entry.id}`,
      kind: 'log' as const,
      title: entry.summary,
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt,
      actorName: entry.actorName || 'Unknown',
      actorAvatarUrl: entry.actorAvatarUrl || null,
      effectiveDate: null,
      note: null,
      beforeData: entry.beforeData || null,
      afterData: entry.afterData || null,
      metadata: entry.metadata || null,
    }))

    const normalizedRates = rateRows.map((entry) => ({
      id: `rate-${entry.id}`,
      kind: 'rate' as const,
      title: `Monthly rate updated to $${Number(entry.monthlyRate).toFixed(2)}`,
      action: 'salary_rate_updated',
      entityType: 'salary_rate',
      createdAt: entry.createdAt,
      actorName: entry.actorName || 'Unknown',
      actorAvatarUrl: entry.actorAvatarUrl || null,
      effectiveDate: entry.effectiveDate,
      note: entry.note,
      beforeData: null,
      afterData: { monthlyRate: entry.monthlyRate },
      metadata: null,
    }))

    const history = [...normalizedLogs, ...normalizedRates].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return timeB - timeA
    })

    res.json({
      member: {
        id: member.id,
        name: member.name,
        monthlyRate: member.monthlyRate,
        monthlySalaryExtras: normalizeSalaryExtras(member.monthlySalaryExtras),
      },
      history,
      payments,
    })
  } catch (error) {
    console.error('Salary history error:', error)
    res.status(500).json({ error: 'Failed to fetch salary history' })
  }
})

export { router as financesRouter }
