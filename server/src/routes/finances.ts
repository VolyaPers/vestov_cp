import { Router } from 'express'
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  financialTransactions,
  integrationSettings,
  invoices,
  clients,
  teamMembers,
  users,
} from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'
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

    const [created] = await db
      .insert(financialTransactions)
      .values({
        type,
        category: category || null,
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

    const updateData: any = { updatedAt: new Date() }
    if (type !== undefined) updateData.type = type
    if (category !== undefined) updateData.category = category
    if (amount !== undefined) updateData.amount = amount.toString()
    if (description !== undefined) updateData.description = description
    if (transactionDate !== undefined) updateData.transactionDate = transactionDate
    if (teamMemberId !== undefined) updateData.teamMemberId = teamMemberId || null
    if (clientId !== undefined) updateData.clientId = clientId || null
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring

    const [updated] = await db
      .update(financialTransactions)
      .set(updateData)
      .where(eq(financialTransactions.id, id))
      .returning()

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
    const [deleted] = await db
      .delete(financialTransactions)
      .where(eq(financialTransactions.id, id))
      .returning()

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
        role: teamMembers.role,
        monthlyRate: teamMembers.monthlyRate,
        hourlyRate: teamMembers.hourlyRate,
        isBillable: teamMembers.isBillable,
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
      }
    })

    res.json({
      members: membersWithPayments,
      recentPayments,
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

    if (!teamMemberId || !amount || !transactionDate) {
      return res.status(400).json({ error: 'teamMemberId, amount, and transactionDate are required' })
    }

    const [created] = await db
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

    res.status(201).json(created)
  } catch (error) {
    console.error('Record salary error:', error)
    res.status(500).json({ error: 'Failed to record salary payment' })
  }
})

// GET /categories - Distinct categories
router.get('/categories', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const results = await db
      .select({
        category: financialTransactions.category,
      })
      .from(financialTransactions)
      .where(sql`${financialTransactions.category} IS NOT NULL`)
      .groupBy(financialTransactions.category)
      .orderBy(financialTransactions.category)

    res.json(results.map((r) => r.category))
  } catch (error) {
    console.error('Categories error:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
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

export { router as financesRouter }
