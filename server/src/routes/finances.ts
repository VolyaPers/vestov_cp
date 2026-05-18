import { Router } from 'express'
import { eq, desc, and, sql, gte, lte, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  financialTransactions,
  financeCategories,
  financeActivityLogs,
  integrationSettings,
  invoices,
  clients,
  teamMembers,
  users,
  salaryRateHistory,
} from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'
import {
  diffRecord,
  logFinanceActivity,
  pickInvoiceSnapshot,
  pickTransactionSnapshot,
} from '../lib/financeAudit.js'
import { buildSalaryPaymentEmail, sendEmail } from '../services/email.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

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
    const txConditions: any[] = []
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
    const invConditions: any[] = [
      sql`${invoices.status} = 'paid'`,
      sql`${invoices.paidAt} IS NOT NULL`,
    ]
    if (startDate) invConditions.push(gte(invoices.invoiceDate, startDate))
    if (endDate) invConditions.push(lte(invoices.invoiceDate, endDate))

    const [invSum] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(and(...invConditions))

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
        month: sql<number>`EXTRACT(MONTH FROM ${invoices.invoiceDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${invoices.invoiceDate})::int`,
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(and(...invConditions))
      .groupBy(
        sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
        sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
        sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`
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

    const conditions: any[] = []
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
    res.status(500).json({ error: 'Failed to create transaction' })
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
    res.status(500).json({ error: 'Failed to update transaction' })
  }
})

// DELETE /transactions/:id
router.delete('/transactions/:id', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const id = parseInt(req.params.id)

    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(financialTransactions)
        .where(eq(financialTransactions.id, id))
        .limit(1)

      if (!existing) {
        return null
      }

      const [row] = await tx
        .delete(financialTransactions)
        .where(eq(financialTransactions.id, id))
        .returning()

      if (!row) return null

      const snapshot = pickTransactionSnapshot(existing)
      await logFinanceActivity(tx, {
        action: 'transaction_deleted',
        entityType: 'transaction',
        entityId: existing.id,
        transactionId: existing.id,
        teamMemberId: existing.teamMemberId,
        clientId: existing.clientId,
        invoiceId: existing.invoiceId,
        actorId: req.user!.id,
        summary: `Deleted ${existing.type} transaction #${existing.id}`,
        beforeData: snapshot,
      })

      return row
    })

    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    res.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    console.error('Delete transaction error:', error)
    res.status(500).json({ error: 'Failed to delete transaction' })
  }
})

// GET /client-payments - Auto-pulled paid invoices
router.get('/client-payments', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }

    const conditions: any[] = [
      sql`${invoices.status} = 'paid'`,
      sql`${invoices.paidAt} IS NOT NULL`,
    ]
    if (startDate) conditions.push(gte(invoices.invoiceDate, startDate))
    if (endDate) conditions.push(lte(invoices.invoiceDate, endDate))

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
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.paidAt))

    res.json(results)
  } catch (error) {
    console.error('Client payments error:', error)
    res.status(500).json({ error: 'Failed to fetch client payments' })
  }
})

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
      })
      .from(teamMembers)
      .orderBy(teamMembers.name)

    // Get salary payments for this year
    const salaryPayments = await db
      .select({
        teamMemberId: financialTransactions.teamMemberId,
        totalPaid: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
        lastPaymentDate: sql<string>`MAX(${financialTransactions.transactionDate})`,
        paymentCount: sql<number>`COUNT(*)::int`,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.type, 'salary'),
          gte(financialTransactions.transactionDate, `${targetYear}-01-01`),
          lte(financialTransactions.transactionDate, `${targetYear}-12-31`)
        )
      )
      .groupBy(financialTransactions.teamMemberId)

    // Get recent salary payment history
    const recentPayments = await db
      .select({
        id: financialTransactions.id,
        teamMemberId: financialTransactions.teamMemberId,
        teamMemberName: teamMembers.name,
        amount: financialTransactions.amount,
        description: financialTransactions.description,
        transactionDate: financialTransactions.transactionDate,
        createdAt: financialTransactions.createdAt,
      })
      .from(financialTransactions)
      .leftJoin(teamMembers, eq(financialTransactions.teamMemberId, teamMembers.id))
      .where(eq(financialTransactions.type, 'salary'))
      .orderBy(desc(financialTransactions.transactionDate))
      .limit(50)

    const allPayments = await db
      .select({
        id: financialTransactions.id,
        teamMemberId: financialTransactions.teamMemberId,
        teamMemberName: teamMembers.name,
        amount: financialTransactions.amount,
        description: financialTransactions.description,
        transactionDate: financialTransactions.transactionDate,
        createdAt: financialTransactions.createdAt,
      })
      .from(financialTransactions)
      .leftJoin(teamMembers, eq(financialTransactions.teamMemberId, teamMembers.id))
      .where(eq(financialTransactions.type, 'salary'))
      .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id))

    // Merge payment summaries into members
    const paymentMap = new Map(
      salaryPayments.map((p) => [p.teamMemberId, p])
    )

    const membersWithPayments = members.map((m) => {
      const payments = paymentMap.get(m.id)
      return {
        ...m,
        totalPaidThisYear: payments ? parseFloat(payments.totalPaid) : 0,
        lastPaymentDate: payments?.lastPaymentDate || null,
        paymentCount: payments?.paymentCount || 0,
        monthlySalaryExtras: normalizeSalaryExtras(m.monthlySalaryExtras),
      }
    })

    res.json({
      members: membersWithPayments,
      recentPayments,
      allPayments,
      year: targetYear,
    })
  } catch (error) {
    console.error('Salaries error:', error)
    res.status(500).json({ error: 'Failed to fetch salaries' })
  }
})

// POST /salaries/record - Record salary payment
router.post('/salaries/record', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const { teamMemberId, amount, transactionDate, description } = req.body
    const salaryMonth = typeof req.body?.salaryMonth === 'string' ? req.body.salaryMonth : ''
    const baseSalary = Number(req.body?.baseSalary)
    const salaryPaidNow = Number(req.body?.salaryPaidNow)
    const remainingSalary = Number(req.body?.remainingSalary)
    const note = typeof req.body?.note === 'string' ? req.body.note : ''
    const extras = normalizeSalaryExtras(req.body?.extras)

    if (!teamMemberId || !amount || !transactionDate) {
      return res.status(400).json({ error: 'teamMemberId, amount, and transactionDate are required' })
    }

    const [member] = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId))
      .limit(1)

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(financialTransactions)
        .values({
          type: 'salary',
          category: 'monthly_salary',
          amount: amount.toString(),
          description: description || null,
          transactionDate,
          teamMemberId,
          createdBy: req.user!.id,
        })
        .returning()

      await logFinanceActivity(tx, {
        action: 'salary_payment_created',
        entityType: 'salary_payment',
        entityId: row.id,
        transactionId: row.id,
        teamMemberId: row.teamMemberId,
        actorId: req.user!.id,
        summary: `Recorded salary payment #${row.id} for team member ${row.teamMemberId}`,
        afterData: pickTransactionSnapshot(row),
        metadata: { description: row.description },
      })

      return [row]
    })

    let email: SalaryPaymentEmailStatus = {
      delivered: false,
      skipped: true,
      provider: 'none',
    }

    const totalAmount = Number(amount)
    if (member.email && salaryMonth && Number.isFinite(baseSalary) && Number.isFinite(salaryPaidNow) && Number.isFinite(remainingSalary) && Number.isFinite(totalAmount)) {
      try {
        const payload = buildSalaryPaymentEmail({
          to: member.email,
          employeeName: member.name,
          salaryMonth,
          paymentDate: transactionDate,
          baseSalary,
          salaryPaidNow,
          remainingSalary,
          extras,
          totalPayout: totalAmount,
          note,
        })
        email = await sendEmail(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Salary payment email error:', message)
        email = {
          delivered: false,
          provider: 'sendgrid',
          error: message,
        }
      }
    } else if (!member.email) {
      email = {
        delivered: false,
        skipped: true,
        provider: 'none',
        error: 'Team member has no email address configured.',
      }
    }

    res.status(201).json({ ...created, email })
  } catch (error) {
    console.error('Record salary error:', error)
    res.status(500).json({ error: 'Failed to record salary payment' })
  }
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
router.put('/salaries/:teamMemberId/rate', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const teamMemberId = parseInt(req.params.teamMemberId)
    const { monthlyRate, effectiveDate, note } = req.body

    if (!monthlyRate || parseFloat(monthlyRate) < 0) {
      return res.status(400).json({ error: 'Valid monthlyRate is required' })
    }

    const rate = String(parseFloat(monthlyRate).toFixed(2))
    const effDate = effectiveDate || new Date().toISOString().split('T')[0]

    const [existing] = await db
      .select({
        id: teamMembers.id,
        monthlyRate: teamMembers.monthlyRate,
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId))
      .limit(1)

    if (!existing) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    await db.transaction(async (tx) => {
      await tx
        .update(teamMembers)
        .set({ monthlyRate: rate, updatedAt: new Date() })
        .where(eq(teamMembers.id, teamMemberId))

      await tx.insert(salaryRateHistory).values({
        teamMemberId,
        monthlyRate: rate,
        effectiveDate: effDate,
        note: note || null,
        createdBy: req.user!.id,
      })

      const beforeData = { monthlyRate: existing.monthlyRate, effectiveDate: effDate, note: null }
      const afterData = {
        monthlyRate: rate,
        effectiveDate: effDate,
        note: note || null,
      }

      await logFinanceActivity(tx, {
        action: 'salary_rate_updated',
        entityType: 'salary_rate',
        entityId: teamMemberId,
        teamMemberId,
        actorId: req.user!.id,
        summary: `Updated monthly salary rate for team member #${teamMemberId}`,
        beforeData,
        afterData,
        metadata: { changes: diffRecord(beforeData, afterData) },
      })
    })

    res.json({ success: true, monthlyRate: rate })
  } catch (error) {
    console.error('Update salary rate error:', error)
    res.status(500).json({ error: 'Failed to update salary rate' })
  }
})

router.put('/salaries/:teamMemberId/monthly-extras', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const teamMemberId = parseInt(req.params.teamMemberId)
    const monthlyExtras = normalizeSalaryExtras(req.body?.monthlyExtras)

    const [updated] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: teamMembers.id,
          monthlySalaryExtras: teamMembers.monthlySalaryExtras,
        })
        .from(teamMembers)
        .where(eq(teamMembers.id, teamMemberId))
        .limit(1)

      if (!existing) {
        return [null]
      }

      const [row] = await tx
        .update(teamMembers)
        .set({
          monthlySalaryExtras: monthlyExtras,
          updatedAt: new Date(),
        })
        .where(eq(teamMembers.id, teamMemberId))
        .returning({
          id: teamMembers.id,
          monthlySalaryExtras: teamMembers.monthlySalaryExtras,
        })

      if (!row) {
        return [null]
      }

      const beforeData = {
        monthlySalaryExtras: normalizeSalaryExtras(existing.monthlySalaryExtras),
      }
      const afterData = {
        monthlySalaryExtras: monthlyExtras,
      }

      await logFinanceActivity(tx, {
        action: 'salary_extras_updated',
        entityType: 'salary_extras',
        entityId: teamMemberId,
        teamMemberId,
        actorId: req.user!.id,
        summary: `Updated default salary extras for team member #${teamMemberId}`,
        beforeData,
        afterData,
        metadata: { changes: diffRecord(beforeData, afterData) },
      })

      return [row]
    })

    if (!updated) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    res.json({
      success: true,
      monthlyExtras: normalizeSalaryExtras(updated.monthlySalaryExtras),
    })
  } catch (error) {
    console.error('Update monthly salary extras error:', error)
    res.status(500).json({ error: 'Failed to update monthly salary extras' })
  }
})

// GET /salaries/:teamMemberId/rate-history - Get salary rate change history
router.get('/salaries/:teamMemberId/rate-history', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const teamMemberId = parseInt(req.params.teamMemberId)

    const history = await db
      .select({
        id: salaryRateHistory.id,
        monthlyRate: salaryRateHistory.monthlyRate,
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
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId))
      .limit(1)

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    const logEntries = await db
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
      .limit(100)

    const rateRows = await db
      .select({
        id: salaryRateHistory.id,
        monthlyRate: salaryRateHistory.monthlyRate,
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
      .limit(100)

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
    })
  } catch (error) {
    console.error('Salary history error:', error)
    res.status(500).json({ error: 'Failed to fetch salary history' })
  }
})

export { router as financesRouter }
