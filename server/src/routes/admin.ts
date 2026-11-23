import { employmentType, assertPortalAccount, benefitFactor } from '../services/employmentPolicy.js'
import { FinanceValidationError, positiveId, validDate, cents, salaryExtras } from '../lib/money.js'
import { revokeUserSockets } from '../socket.js'
import { logFinanceActivity } from '../lib/financeAudit.js'
import { invoicePaymentExcluded, paidInvoiceConditions } from '../lib/invoiceIncome.js'
import { payrollLock } from '../services/payroll.js'
import { Router } from 'express'
import { eq, desc, and, sql, isNull } from 'drizzle-orm'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import {
  clients,
  teamMembers,
  salaryRateHistory,
  payrollPeriods,
  leaveRequests,
  leaveBalances,
  leaveTypes,
  employmentCycles,
  leaveRequestEvents,
  users,
  serviceRequests,
  documents,
  timeEntries,
  feedback,
  reimbursementRequests,
  invoices,
  financialTransactions,
  clientServices,
  clientServiceTeamMembers,
} from '../db/schema.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import leaveLifecycleRouter from './leaveLifecycle.js'
import { updateMonthlySalaryFromProfile } from '../services/payroll.js'
import { effectiveProjectPredicate, resolveEmployeeId } from '../services/access.js'
import { uploadsDirectory } from '../utils/uploads.js'
import { calculateDays } from '../utils/dateUtils.js'

const router = Router()

router.get('/navigation-indicators', requireAdmin, async (req, res) => {
  try {
    const [pendingLeaveCount, openReimbursementCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, 'pending')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reimbursementRequests)
        .where(
          sql`${reimbursementRequests.status} = 'pending' OR (${reimbursementRequests.status} = 'approved' AND ${reimbursementRequests.evidenceUrl} IS NULL)`
        ),
    ])

    res.json({
      pendingLeaveRequests: pendingLeaveCount[0]?.count ?? 0,
      openReimbursements: openReimbursementCount[0]?.count ?? 0,
    })
  } catch (error) {
    console.error('Navigation indicators error:', error)
    res.status(500).json({ error: 'Failed to load navigation indicators' })
  }
})

// PUT /team-members/:id - Allow users to update their own profile OR admins to update any profile
router.put('/team-members/:id', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const memberId = parseInt(req.params.id)

    // Get the team member to check ownership
    const existingMembers = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))

    const existingMember = existingMembers[0]

    if (!existingMember) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    // Allow update if user is admin OR if user is updating their own profile (email matches)
    const isAdmin = req.user.role === 'admin'
    const isOwner = await resolveEmployeeId(req.user) === existingMember.id

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only update your own profile' })
    }

    // Prepare update data - restrict fields if not admin
    const updateData: any = { updatedAt: new Date() }

    if (isAdmin) {
      // Admins can update all fields - explicitly process each field to ensure proper handling
      const allowedFields = [
        'name', 'email', 'phone', 'skills', 'bio',
        'hourlyRate', 'monthlyRate', 'isBillable', 'status',
        'clientId', 'startDate', 'location', 'timezone', 'avatarUrl',
        'position', 'employmentType', 'showOnCalendar'
      ]

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          // Handle date fields
          if (field === 'startDate' && req.body[field]) {
            updateData[field] = req.body[field] // Date string will be converted by Drizzle
          }
          // Handle boolean fields
          else if (field === 'isBillable' || field === 'showOnCalendar') {
            updateData[field] = Boolean(req.body[field])
          }
          // Handle numeric fields
          else if (field === 'hourlyRate' || field === 'monthlyRate') {
            updateData[field] = req.body[field] !== null && req.body[field] !== ''
              ? req.body[field]
              : null
          }
          // Handle array fields
          else if (field === 'skills') {
            updateData[field] = Array.isArray(req.body[field]) ? req.body[field] : req.body[field]
          }
          // Handle other fields
          else {
            updateData[field] = req.body[field]
          }
        }
      }
    } else {
      // Non-admins can only update specific fields (phone, location, timezone, bio)
      const allowedFields = ['phone', 'location', 'timezone', 'bio']
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field]
        }
      }
    }

    if (updateData.employmentType !== undefined) employmentType(updateData.employmentType)
    const requestedMonthlyRate = updateData.monthlyRate
    delete updateData.monthlyRate
    if (updateData.timezone) {
      try { new Intl.DateTimeFormat('en-US',{timeZone:updateData.timezone}).format() }
      catch { return res.status(400).json({error:'Invalid timezone'}) }
    }
    const result = await db.transaction(async tx => {
      await payrollLock(tx, memberId)
      const [current] = await tx.select().from(teamMembers).where(eq(teamMembers.id, memberId)).for('update')
      const nextType = updateData.employmentType ?? current.employmentType
      let portalAccount: { userId: number; status: 'created' | 'reactivated' | 'existing'; needsInvitation: boolean } | null = null
      if (nextType === 'freelancer' && updateData.email !== undefined) {
        const email = typeof updateData.email === 'string' ? updateData.email.trim().toLowerCase() : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FinanceValidationError('A valid freelancer contact email is required')
        const accounts = await tx.select({id:users.id,teamMemberId:users.teamMemberId}).from(users).where(sql`lower(${users.email}) = ${email}`)
        if (email !== current.email.toLowerCase() && accounts.some(account=>account.teamMemberId!==memberId)) throw new FinanceValidationError('This contact email belongs to another portal account',409)
        updateData.email = email
      }
      if (nextType === 'freelancer' && current.employmentType !== 'freelancer') {
        const unsettled = await tx.select({id:payrollPeriods.id}).from(payrollPeriods).where(and(eq(payrollPeriods.teamMemberId,memberId),sql`${payrollPeriods.status} <> 'closed'`))
        const purchases = await tx.select({id:reimbursementRequests.id}).from(reimbursementRequests).where(and(eq(reimbursementRequests.employeeId,memberId),sql`${reimbursementRequests.status} IN ('pending','approved','confirmed')`))
        if (unsettled.length || purchases.length) throw new FinanceValidationError('Settle open salary periods and resolve outstanding reimbursements before switching to Freelancer. Existing obligations must stay accessible.',409)
      }
      if (nextType === 'freelancer') {
        if (requestedMonthlyRate != null && requestedMonthlyRate !== '' && cents(requestedMonthlyRate) > 0 && cents(requestedMonthlyRate) !== cents(current.monthlyRate || '0')) throw new FinanceValidationError('Freelancers use project fees instead of a monthly salary')
        updateData.monthlyRate = null
        updateData.monthlySalaryExtras = []
        updateData.showOnCalendar = false
      } else if (requestedMonthlyRate !== undefined && current.employmentType !== 'freelancer') await updateMonthlySalaryFromProfile(tx, memberId, requestedMonthlyRate ?? '0', req.user!.id)
      if (current.employmentType === 'freelancer' && nextType !== 'freelancer') {
        if (requestedMonthlyRate === undefined || cents(requestedMonthlyRate, 'Actual monthly salary') <= 0) throw new FinanceValidationError('Enter the actual monthly salary before converting a freelancer to an employee')
        const employeeEmail = typeof (updateData.email ?? current.email) === 'string' ? String(updateData.email ?? current.email).trim().toLowerCase() : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) throw new FinanceValidationError('A valid email is required to create employee portal access')
        updateData.email = employeeEmail
        updateData.monthlyRate = requestedMonthlyRate
      }
      if (nextType !== current.employmentType) {
        const effectiveDate = new Date().toISOString().slice(0,7)+'-01'
        if (nextType !== 'freelancer') await tx.insert(salaryRateHistory).values({teamMemberId:memberId,employmentType:nextType,monthlyRate:requestedMonthlyRate ?? current.monthlyRate ?? '0',monthlyExtras:salaryExtras(current.monthlySalaryExtras || []),effectiveDate:current.startDate > effectiveDate ? current.startDate : effectiveDate,createdBy:req.user!.id,note:'Employment type changed; saved payroll periods remain unchanged'})
        await tx.update(salaryRateHistory).set({employmentType:nextType}).where(and(eq(salaryRateHistory.teamMemberId,memberId),sql`${salaryRateHistory.effectiveDate} > ${effectiveDate}`))
        await logFinanceActivity(tx,{action:'employment_type_updated',entityType:'team_member',entityId:memberId,teamMemberId:memberId,actorId:req.user!.id,summary:`Employment type: ${current.employmentType} → ${nextType}`,beforeData:{employmentType:current.employmentType},afterData:{employmentType:nextType}})
      }
      if (nextType === 'freelancer') {
        const linked = await tx.select().from(users).where(sql`${users.teamMemberId} = ${memberId} OR lower(${users.email}) = ${current.email.toLowerCase()}`)
        if (linked.some(user=>user.role==='admin' && user.isActive)) throw new FinanceValidationError('Reassign and deactivate the administrator account in Users before converting its profile to Freelancer',409)
        const disabled = await tx.update(users).set({isActive:false,updatedAt:new Date()}).where(sql`${users.teamMemberId} = ${memberId} OR lower(${users.email}) = ${current.email.toLowerCase()}`).returning({id:users.id})
        for (const user of disabled) revokeUserSockets(user.id)
      }
      const [updated] = await tx.update(teamMembers).set(updateData).where(eq(teamMembers.id, memberId)).returning()
      if (current.employmentType === 'freelancer' && nextType !== 'freelancer') {
        const normalizedEmail = updated.email.trim().toLowerCase()
        const linked = await tx.select().from(users).where(sql`${users.teamMemberId} = ${memberId} OR lower(${users.email}) = ${normalizedEmail}`).for('update')
        const conflicting = linked.find(user => user.teamMemberId && user.teamMemberId !== memberId)
        if (conflicting) throw new FinanceValidationError('This email belongs to another employee portal account', 409)
        const account = linked.find(user => user.teamMemberId === memberId) || linked[0]
        if (account) {
          if (account.clerkUserId && account.email.toLowerCase() !== normalizedEmail) throw new FinanceValidationError('Change the verified Clerk email before converting this profile', 409)
          const [portalUser] = await tx.update(users).set({
            teamMemberId: memberId,
            email: normalizedEmail,
            fullName: updated.name,
            position: updated.position,
            role: 'team_member',
            isActive: true,
            updatedAt: new Date(),
          }).where(eq(users.id, account.id)).returning()
          portalAccount = { userId: portalUser.id, status: account.isActive ? 'existing' : 'reactivated', needsInvitation: !portalUser.clerkUserId }
        } else {
          const preferredUsername = `team-${memberId}`
          const [usernameOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.username, preferredUsername)).limit(1)
          const username = usernameOwner ? `team-${memberId}-employee` : preferredUsername
          const [portalUser] = await tx.insert(users).values({
            username,
            password: null,
            fullName: updated.name,
            email: normalizedEmail,
            role: 'team_member',
            position: updated.position,
            teamMemberId: memberId,
            isActive: true,
            authProvider: 'clerk',
          }).returning()
          portalAccount = { userId: portalUser.id, status: 'created', needsInvitation: true }
        }
      }
      return { member: updated, portalAccount }
    })

    if (!result.member) {
      return res.status(404).json({ error: 'Team member not found' })
    }
    res.json({ ...result.member, portalAccount: result.portalAccount })
  } catch (error) {
    if((error as any).status) return res.status((error as any).status).json({error:(error as Error).message})
    console.error('Error updating team member:', error)
    res.status(500).json({ error: 'Failed to update team member' })
  }
})

// Apply admin middleware to all routes
router.use(requireAdmin)

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadsDirectory, 'logos')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for logos
  },
  fileFilter: (req, file, cb) => {
    // Allow common image types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.'))
    }
  }
})

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      [clientCount],
      [teamMemberCount],
      [pendingLeaveRequests],
      [activeTeamMembers],
    ] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(clients),
      db.select({ count: sql`count(*)` }).from(teamMembers),
      db
        .select({ count: sql`count(*)` })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, 'pending')),
      db
        .select({ count: sql`count(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.status, 'active')),
    ])

    res.json({
      stats: {
        totalClients: clientCount.count,
        totalTeamMembers: teamMemberCount.count,
        activeTeamMembers: activeTeamMembers.count,
        pendingLeaveRequests: pendingLeaveRequests.count,
      }
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Failed to load dashboard data' })
  }
})

router.get('/dashboard/summary', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear()
    const startDate = `${currentYear}-01-01`
    const endDate = `${currentYear}-12-31`

    const txDateConditions = [
      sql`${financialTransactions.voidedAt} IS NULL`,
      sql`${financialTransactions.transactionDate} >= ${startDate}`,
      sql`${financialTransactions.transactionDate} <= ${endDate}`,
    ]
    const invoiceIncomeFilter = paidInvoiceConditions(startDate, endDate)

    const [
      [clientCount],
      [teamMemberCount],
      [pendingLeaveCount],
      [activeTeamMemberCount],
      clientRows,
      teamMemberRows,
      leaveRequestRows,
      invoiceRows,
      reimbursementRows,
      txSums,
      monthlyTx,
      [invSum],
      monthlyInv,
    ] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(clients),
      db.select({ count: sql`count(*)` }).from(teamMembers),
      db
        .select({ count: sql`count(*)` })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, 'pending')),
      db
        .select({ count: sql`count(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.status, 'active')),
      db
        .select({
          id: clients.id,
          name: clients.name,
          status: clients.status,
          createdAt: clients.createdAt,
          activeServicesCount: sql<number>`
            COUNT(${clientServices.id}) FILTER (
              WHERE ${clientServices.isActive} = true
                AND (${clientServices.endDate} IS NULL OR ${clientServices.endDate} >= CURRENT_DATE)
            )
          `,
        })
        .from(clients)
        .leftJoin(clientServices, eq(clients.id, clientServices.clientId))
        .groupBy(clients.id, clients.name, clients.status, clients.createdAt)
        .orderBy(desc(clients.createdAt)),
      db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          status: teamMembers.status,
          isBillable: teamMembers.isBillable,
        })
        .from(teamMembers),
      db
        .select({
          id: leaveRequests.id,
          status: leaveRequests.status,
        })
        .from(leaveRequests),
      db
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
          clientName: clients.name,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          status: invoices.status,
          invoiceDate: invoices.invoiceDate,
          dueDate: invoices.dueDate,
          paidAt: invoices.paidAt,
          financePaymentExcluded: invoicePaymentExcluded,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .orderBy(desc(invoices.createdAt)),
      db
        .select({
          id: reimbursementRequests.id,
          status: reimbursementRequests.status,
          evidenceUrl: reimbursementRequests.evidenceUrl,
        })
        .from(reimbursementRequests),
      db
        .select({
          type: financialTransactions.type,
          total: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
        })
        .from(financialTransactions)
        .where(and(...txDateConditions))
        .groupBy(financialTransactions.type),
      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})::int`,
          year: sql<number>`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})::int`,
          type: financialTransactions.type,
          total: sql<string>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL)), 0)`,
        })
        .from(financialTransactions)
        .where(and(...txDateConditions))
        .groupBy(
          sql`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})`,
          sql`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})`,
          financialTransactions.type,
        )
        .orderBy(
          sql`EXTRACT(YEAR FROM ${financialTransactions.transactionDate})`,
          sql`EXTRACT(MONTH FROM ${financialTransactions.transactionDate})`,
        ),
      db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(invoiceIncomeFilter),
      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${invoices.paidAt})::int`,
          year: sql<number>`EXTRACT(YEAR FROM ${invoices.paidAt})::int`,
          total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(invoiceIncomeFilter)
        .groupBy(
          sql`EXTRACT(MONTH FROM ${invoices.paidAt})`,
          sql`EXTRACT(YEAR FROM ${invoices.paidAt})`,
        )
        .orderBy(
          sql`EXTRACT(YEAR FROM ${invoices.paidAt})`,
          sql`EXTRACT(MONTH FROM ${invoices.paidAt})`,
        ),
    ])

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

    const monthlyMap = new Map<string, {
      month: number
      year: number
      income: number
      expense: number
      salary: number
      extra_payment: number
      client_payments: number
    }>()

    for (const row of monthlyTx) {
      const key = `${row.year}-${row.month}`
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          month: row.month,
          year: row.year,
          income: 0,
          expense: 0,
          salary: 0,
          extra_payment: 0,
          client_payments: 0,
        })
      }

      monthlyMap.get(key)![row.type as 'income' | 'expense' | 'salary' | 'extra_payment'] = parseFloat(row.total)
    }

    for (const row of monthlyInv) {
      const key = `${row.year}-${row.month}`
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          month: row.month,
          year: row.year,
          income: 0,
          expense: 0,
          salary: 0,
          extra_payment: 0,
          client_payments: 0,
        })
      }

      monthlyMap.get(key)!.client_payments = parseFloat(row.total)
    }

    res.json({
      stats: {
        totalClients: clientCount.count,
        totalTeamMembers: teamMemberCount.count,
        activeTeamMembers: activeTeamMemberCount.count,
        pendingLeaveRequests: pendingLeaveCount.count,
      },
      clients: clientRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.activeServicesCount > 0 ? 'active' : 'inactive',
        isActive: row.activeServicesCount > 0,
        createdAt: row.createdAt,
      })),
      teamMembers: teamMemberRows,
      leaveRequests: leaveRequestRows,
      invoices: invoiceRows,
      reimbursements: reimbursementRows,
      financesOverview: {
        totals,
        monthlyBreakdown: Array.from(monthlyMap.values()).sort((a, b) => (
          a.year === b.year ? a.month - b.month : a.year - b.year
        )),
      },
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    res.status(500).json({ error: 'Failed to load dashboard summary' })
  }
})

// Clients CRUD
router.get('/clients', async (req, res) => {
  try {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt))
    res.json(allClients)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

router.get('/clients/:id', async (req, res) => {
  console.log('[ROUTE HANDLER] GET /clients/:id START')
  console.log('[ROUTE HANDLER] req.params:', req.params)
  console.log('[ROUTE HANDLER] req.params.id:', req.params.id)

  try {
    const clientId = parseInt(req.params.id)
    console.log('[ROUTE HANDLER] Parsed clientId:', clientId, 'Type:', typeof clientId)

    if (isNaN(clientId)) {
      console.log('[ROUTE HANDLER] Invalid ID - not a number')
      return res.status(400).json({ error: 'Invalid client ID' })
    }

    console.log('[ROUTE HANDLER] About to query database...')
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId))
    console.log('[ROUTE HANDLER] Database query completed. Result:', client)

    if (!client) {
      console.log('[ROUTE HANDLER] Client not found in database')
      return res.status(404).json({ error: 'Client not found' })
    }

    console.log('[ROUTE HANDLER] Success! Returning client:', client.name)
    res.json(client)
  } catch (error) {
    console.error('[ROUTE HANDLER] CAUGHT ERROR:', error)
    console.error('[ROUTE HANDLER] Error stack:', error instanceof Error ? error.stack : 'No stack')
    res.status(500).json({ error: 'Failed to fetch client' })
  }
})

router.post('/clients', async (req, res) => {
  try {
    // Clean up empty strings for optional fields
    const cleanedData = { ...req.body }

    // Convert empty strings to null for date fields
    if (cleanedData.contractStart === '') cleanedData.contractStart = null
    if (cleanedData.contractEnd === '') cleanedData.contractEnd = null

    // Convert empty strings to null for optional text fields
    if (cleanedData.contractType === '') cleanedData.contractType = null
    if (cleanedData.industry === '') cleanedData.industry = null
    if (cleanedData.contactPerson === '') cleanedData.contactPerson = null
    if (cleanedData.email === '') cleanedData.email = null
    if (cleanedData.phone === '') cleanedData.phone = null
    if (cleanedData.address === '') cleanedData.address = null
    if (cleanedData.billingCycle === '') cleanedData.billingCycle = null

    const [client] = await db.insert(clients).values(cleanedData).returning()
    console.log('[POST /admin/clients] Client created successfully:', client.id)
    res.json(client)
  } catch (error) {
    console.error('[POST /admin/clients] Creation failed', { errorType: error instanceof Error ? error.name : 'UnknownError' })
    res.status(500).json({ error: 'Failed to create client' })
  }
})

router.put('/clients/:id', async (req, res) => {
  try {
    const [client] = await db
      .update(clients)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clients.id, parseInt(req.params.id)))
      .returning()

    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }
    res.json(client)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' })
  }
})

// Upload client logo
router.post('/clients/:id/logo', logoUpload.single('logo'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id)

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Verify client exists
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (!client) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Client not found' })
    }

    // Delete old logo if it exists
    if (client.logoUrl) {
      const oldLogoPath = path.join(uploadsDirectory, 'logos', path.basename(client.logoUrl))
      try {
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath)
        }
      } catch (error) {
        console.error('Error deleting old logo:', error)
      }
    }

    // Update client with new logo URL
    const logoUrl = `/api/uploads/logos/${req.file.filename}`
    const [updatedClient] = await db
      .update(clients)
      .set({
        logoUrl,
        updatedAt: new Date()
      })
      .where(eq(clients.id, clientId))
      .returning()

    res.json({
      ...updatedClient,
      message: 'Logo uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading logo:', error)

    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError)
      }
    }

    res.status(500).json({ error: 'Failed to upload logo' })
  }
})

// Team Members CRUD
router.get('/team-members', async (req, res) => {
  try {
    const { billable, email } = req.query

    let conditions = []

    // Add billable filter if provided
    if (billable === 'true') {
      conditions.push(eq(teamMembers.isBillable, true))
    } else if (billable === 'false') {
      conditions.push(eq(teamMembers.isBillable, false))
    }

    // Add email filter if provided
    if (email) {
      conditions.push(eq(teamMembers.email, email as string))
    }

    const members = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        position: teamMembers.position,
        email: teamMembers.email,
        phone: teamMembers.phone,
        skills: teamMembers.skills,
        bio: teamMembers.bio,
        hourlyRate: teamMembers.hourlyRate,
        monthlyRate: teamMembers.monthlyRate,
        isBillable: teamMembers.isBillable,
        status: teamMembers.status,
        startDate: teamMembers.startDate,
        location: teamMembers.location,
        timezone: teamMembers.timezone,
        avatarUrl: teamMembers.avatarUrl,
        employmentType: teamMembers.employmentType,
        showOnCalendar: teamMembers.showOnCalendar,
        clientId: teamMembers.clientId,
        clientName: clients.name,
      })
      .from(teamMembers)
      .leftJoin(clients, eq(teamMembers.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(teamMembers.createdAt))

    const assignments = await db.select({employeeId:clientServiceTeamMembers.teamMemberId,clientId:clientServices.clientId})
      .from(clientServiceTeamMembers).innerJoin(clientServices,eq(clientServices.id,clientServiceTeamMembers.clientServiceId))
      .where(and(eq(clientServiceTeamMembers.isActive,true),effectiveProjectPredicate(),
        sql`${clientServiceTeamMembers.startDate} <= CURRENT_DATE`,sql`(${clientServiceTeamMembers.endDate} IS NULL OR ${clientServiceTeamMembers.endDate} >= CURRENT_DATE)`))
    res.json(members.map(member=>({...member,clientIds:[...new Set(assignments.filter(row=>row.employeeId===member.id).map(row=>row.clientId))]})))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' })
  }
})

router.get('/team-members/:id', async (req, res) => {
  try {
    const [member] = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        position: teamMembers.position,
        email: teamMembers.email,
        phone: teamMembers.phone,
        skills: teamMembers.skills,
        bio: teamMembers.bio,
        hourlyRate: teamMembers.hourlyRate,
        monthlyRate: teamMembers.monthlyRate,
        isBillable: teamMembers.isBillable,
        status: teamMembers.status,
        startDate: teamMembers.startDate,
        location: teamMembers.location,
        timezone: teamMembers.timezone,
        avatarUrl: teamMembers.avatarUrl,
        employmentType: teamMembers.employmentType,
        showOnCalendar: teamMembers.showOnCalendar,
        clientId: teamMembers.clientId,
        clientName: clients.name,
      })
      .from(teamMembers)
      .leftJoin(clients, eq(teamMembers.clientId, clients.id))
      .where(eq(teamMembers.id, parseInt(req.params.id)))

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }
    res.json(member)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team member' })
  }
})

// Create team member and link to existing user
// This endpoint is restricted - team members should only be created via user creation
router.post('/team-members', async (req, res) => {
  try {
    const type = employmentType(req.body.employmentType)
    const member = await db.transaction(async tx => {
      if (type === 'freelancer') {
        if (req.body.userId) throw new FinanceValidationError('Freelancers are created without a user account')
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
        if (!name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FinanceValidationError('Name and a valid contact email are required')
        const [account] = await tx.select({id:users.id}).from(users).where(sql`lower(${users.email}) = ${email}`)
        if (account) throw new FinanceValidationError('This email has a user account. Change its linked Team profile to Freelancer instead.',409)
        const [created] = await tx.insert(teamMembers).values({name,email,position:typeof req.body.position==='string' && req.body.position.trim() ? req.body.position.trim() : 'Freelancer',employmentType:type,startDate:validDate(req.body.startDate || new Date().toISOString().slice(0,10)),status:'active',isBillable:true,showOnCalendar:false}).returning()
        return created
      }
      const userId = positiveId(req.body.userId, 'User')
      const [user] = await tx.select().from(users).where(eq(users.id,userId)).for('update')
      if (!user) throw new FinanceValidationError('User not found',404)
      await assertPortalAccount(user,tx)
      if (!['team_member','admin'].includes(user.role)) throw new FinanceValidationError('An employee or admin user is required')
      if (user.teamMemberId) throw new FinanceValidationError('User already has a team member linked',409)
      const [created] = await tx.insert(teamMembers).values({name:user.fullName,email:user.email,startDate:new Date().toISOString().slice(0,10),status:'active',isBillable:true,position:user.position || 'Team Member',employmentType:type}).returning()
      await tx.update(users).set({teamMemberId:created.id,updatedAt:new Date()}).where(eq(users.id,user.id))
      return created
    })

    res.json(member)
  } catch (error) {
    if ((error as any).status || (error as any).code === '23505') return res.status((error as any).status || 409).json({error:(error as any).code==='23505'?'This email already has a team profile':(error as Error).message})
    console.error('Error creating team member:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create team member'
    res.status(500).json({ error: errorMessage })
  }
})


router.delete('/team-members/:id', async (req, res) => {
  try {
    const memberId=Number(req.params.id)
    if(!Number.isSafeInteger(memberId)||memberId<=0) return res.status(400).json({error:'Invalid employee ID'})
    const deleted=await db.transaction(async tx=>{
      const linked=await tx.select({id:users.id}).from(users).where(eq(users.teamMemberId,memberId)).limit(1)
      if(linked.length) return null
      const [row]=await tx.delete(teamMembers).where(eq(teamMembers.id,memberId)).returning()
      return row
    })
    if(!deleted)return res.status(409).json({error:'This employee is linked to a user. Deactivate the account to preserve its history.'})
    res.json({message:'Employee deleted',id:memberId})
  } catch(error:any) {
    if(error.code==='23503'||error.cause?.code==='23503')return res.status(409).json({error:'This profile has employment or accounting history. Keep it and mark it unavailable to preserve that history.'})
    res.status(500).json({error:'Failed to delete employee'})
  }
})

router.get('/leave-requests', async (req, res) => {
  try {
    const requests = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: teamMembers.name,
        employeeRole: teamMembers.position,
        employeeAvatar: teamMembers.avatarUrl,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        status: leaveRequests.status,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
        daysCount: leaveRequests.daysCount,
        reason: leaveRequests.reason,
        requestedBy: leaveRequests.requestedBy,
        decisionBy: leaveRequests.decisionBy,
        decisionAt: leaveRequests.decisionAt,
        decisionReason: leaveRequests.decisionReason,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(isNull(leaveRequests.archivedAt))
      .orderBy(desc(leaveRequests.createdAt))

    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' })
  }
})

// Compatibility routes share the same validated lifecycle as the current calendar.
const forwardLeave = (method: string, target: (req: any) => string, status?: string) => (req: any, res: any, next: any) => {
  req.method = method
  req.url = target(req)
  if (status) req.body = { ...req.body, status, decisionReason: req.body.reason }
  if (method === 'POST') req.body = { ...req.body, autoApprove: false }
  leaveLifecycleRouter(req, res, next)
}
router.post('/leave-requests', forwardLeave('POST', () => '/admin/create-and-approve'))
router.patch('/leave-requests/:id', forwardLeave('PUT', req => `/requests/${req.params.id}`))
router.patch('/leave-requests/:id/approve', forwardLeave('PUT', req => `/requests/${req.params.id}/status`, 'approved'))
router.patch('/leave-requests/:id/deny', forwardLeave('PUT', req => `/requests/${req.params.id}/status`, 'denied'))
router.patch('/leave-requests/:id/cancel', forwardLeave('PUT', req => `/requests/${req.params.id}/cancel`))

// Leave Balances
router.get('/leave-balances', async (req, res) => {
  try {
    const balances = await db
      .select({
        id: leaveBalances.id,
        employeeId: leaveBalances.employeeId,
        employeeName: teamMembers.name,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        employmentType: teamMembers.employmentType,
        totalDays: leaveBalances.totalDays,
        adjustmentDays: leaveBalances.adjustmentDays,
      })
      .from(leaveBalances)
      .leftJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id))
      .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))

    res.json(balances.map(row=>({...row,totalDays:String(Number(row.totalDays)*benefitFactor(row.employmentType)),adjustmentDays:String(Number(row.adjustmentDays||0)*benefitFactor(row.employmentType))})))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave balances' })
  }
})

// Leave Types
router.get('/leave-types', async (req, res) => {
  try {
    const types = await db.select().from(leaveTypes)
    res.json(types)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave types' })
  }
})

// Delete Client
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params
    const clientId = parseInt(id)

    // Check if client exists
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))

    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // Delete client (related data will be cascade deleted by database constraints)
    await db
      .delete(clients)
      .where(eq(clients.id, clientId))

    res.json({ message: 'Client deleted successfully', clientId })
  } catch (error) {
    if ((error as any).code === '23503' || (error as any).cause?.code === '23503') return res.status(409).json({error:'This client has project or financial history. Set the client inactive to preserve those records.'})
    console.error('Error deleting client:', error)
    res.status(500).json({ error: 'Failed to delete client' })
  }
})

export { router as adminRouter }
