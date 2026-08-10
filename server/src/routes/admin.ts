import { Router } from 'express'
import { eq, desc, and, sql } from 'drizzle-orm'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import {
  clients,
  teamMembers,
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
} from '../db/schema.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
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
    const isOwner = existingMember.email === req.user.email

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

    const [member] = await db
      .update(teamMembers)
      .set(updateData)
      .where(eq(teamMembers.id, memberId))
      .returning()

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }
    res.json(member)
  } catch (error) {
    console.error('Error updating team member:', error)
    res.status(500).json({ error: 'Failed to update team member' })
  }
})

// Apply admin middleware to all routes
router.use(requireAdmin)

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'logos')
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
        activeTeamMembers: activeTeamMembers[0].count,
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
      sql`${financialTransactions.transactionDate} >= ${startDate}`,
      sql`${financialTransactions.transactionDate} <= ${endDate}`,
    ]
    const invoiceDateConditions = [
      sql`${invoices.invoiceDate} >= ${startDate}`,
      sql`${invoices.invoiceDate} <= ${endDate}`,
    ]
    const paidInvoiceConditions = [
      sql`${invoices.status} = 'paid'`,
      sql`${invoices.paidAt} IS NOT NULL`,
      ...invoiceDateConditions,
    ]

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
        .where(and(...paidInvoiceConditions)),
      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${invoices.invoiceDate})::int`,
          year: sql<number>`EXTRACT(YEAR FROM ${invoices.invoiceDate})::int`,
          total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(and(...paidInvoiceConditions))
        .groupBy(
          sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
          sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
        )
        .orderBy(
          sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
          sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
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
    console.log('[POST /admin/clients] Request body:', req.body)

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

    console.log('[POST /admin/clients] Cleaned data:', cleanedData)

    const [client] = await db.insert(clients).values(cleanedData).returning()
    console.log('[POST /admin/clients] Client created successfully:', client.id)
    res.json(client)
  } catch (error) {
    console.error('[POST /admin/clients] Error creating client:', error)
    console.error('[POST /admin/clients] Request body was:', req.body)

    // Send more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to create client'
    res.status(500).json({ error: errorMessage })
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
      const oldLogoPath = path.join(process.cwd(), 'uploads', 'logos', path.basename(client.logoUrl))
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

    res.json(members)
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
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required. Team members can only be created by linking to an existing user with role="team_member"' })
    }

    // Verify user exists and has role='team_member'
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'team_member' && user.role !== 'admin') {
      return res.status(400).json({ error: 'User must have role="team_member" or "admin" to create a team member' })
    }

    if (user.teamMemberId) {
      return res.status(400).json({ error: 'User already has a team member linked' })
    }

    // Create team member from user data
    const today = new Date().toISOString().slice(0, 10)
    const [member] = await db
      .insert(teamMembers)
      .values({
        name: user.fullName,
        email: user.email,
        startDate: today,
        status: 'active',
        isBillable: true,
        position: user.position || 'Team Member',
      })
      .returning()

    // Link user to team member
    await db
      .update(users)
      .set({ teamMemberId: member.id, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    res.json(member)
  } catch (error) {
    console.error('Error creating team member:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create team member'
    res.status(500).json({ error: errorMessage })
  }
})


router.delete('/team-members/:id', async (req, res) => {
  try {
    console.log(`Attempting to delete team member with ID: ${req.params.id}`)
    const memberId = parseInt(req.params.id)

    // First, check if the team member exists
    const existingMember = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1)

    if (existingMember.length === 0) {
      console.log(`Team member with ID ${req.params.id} not found`)
      return res.status(404).json({ error: 'Team member not found' })
    }

    // Delete all related records to avoid foreign key constraint violations
    console.log(`Deleting related records for team member ${memberId}`)

    // 1. Delete leave request events first (they reference leave requests)
    const memberLeaveRequests = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(eq(leaveRequests.employeeId, memberId))

    for (const request of memberLeaveRequests) {
      await db.delete(leaveRequestEvents).where(eq(leaveRequestEvents.leaveRequestId, request.id))
    }

    // 2. Delete leave requests
    await db.delete(leaveRequests).where(eq(leaveRequests.employeeId, memberId))

    // 3. Delete leave balances
    await db.delete(leaveBalances).where(eq(leaveBalances.employeeId, memberId))

    // 4. Delete employment cycles
    await db.delete(employmentCycles).where(eq(employmentCycles.employeeId, memberId))

    // 5. Delete feedback records
    await db.delete(feedback).where(eq(feedback.teamMemberId, memberId))

    // 6. Update time entries to remove team member reference (set to null instead of deleting)
    await db.update(timeEntries)
      .set({ teamMemberId: null })
      .where(eq(timeEntries.teamMemberId, memberId))

    // Now delete the team member
    const [member] = await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .returning()

    console.log(`Successfully deleted team member: ${member.id}`)
    res.json({ message: 'Team member deleted successfully', id: member.id })
  } catch (error) {
    console.error('Error deleting team member:', error)
    res.status(500).json({ error: 'Failed to delete team member' })
  }
})

// Leave Management
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
      .orderBy(desc(leaveRequests.createdAt))

    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' })
  }
})

router.post('/leave-requests', async (req, res) => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, halfDayStart, halfDayEnd, reason } = req.body

    // Calculate days count (weekdays only — weekends excluded)
    const daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd)

    if (daysCount <= 0) {
      return res.status(400).json({
        error: 'Selected date range has no working days (weekends are not counted). Please choose weekdays.'
      })
    }

    const [request] = await db.insert(leaveRequests).values({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      halfDayStart: halfDayStart || false,
      halfDayEnd: halfDayEnd || false,
      daysCount: daysCount.toString(),
      reason,
      requestedBy: req.user!.id,
    }).returning()

    // Create audit trail event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: request.id,
      status: 'pending',
      actorId: req.user!.id,
      note: 'Leave request created',
    })

    res.json(request)
  } catch (error) {
    console.error('Create leave request error:', error)
    res.status(500).json({ error: 'Failed to create leave request' })
  }
})

router.patch('/leave-requests/:id', async (req, res) => {
  try {
    const { startDate, endDate, halfDayStart, halfDayEnd, reason } = req.body

    // Recalculate days if dates changed
    let updateData = req.body
    if (startDate && endDate) {
      updateData.daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd).toString()
    }

    const [request] = await db
      .update(leaveRequests)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(leaveRequests.id, parseInt(req.params.id)))
      .returning()

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    res.json(request)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave request' })
  }
})

router.patch('/leave-requests/:id/approve', async (req, res) => {
  try {
    const { reason } = req.body

    const [request] = await db
      .update(leaveRequests)
      .set({
        status: 'approved',
        decisionBy: req.user!.id,
        decisionAt: new Date(),
        decisionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, parseInt(req.params.id)))
      .returning()

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Create audit trail event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: request.id,
      status: 'approved',
      actorId: req.user!.id,
      note: reason || 'Leave request approved',
    })

    res.json(request)
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave request' })
  }
})

router.patch('/leave-requests/:id/deny', async (req, res) => {
  try {
    const { reason } = req.body

    const [request] = await db
      .update(leaveRequests)
      .set({
        status: 'denied',
        decisionBy: req.user!.id,
        decisionAt: new Date(),
        decisionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, parseInt(req.params.id)))
      .returning()

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Create audit trail event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: request.id,
      status: 'denied',
      actorId: req.user!.id,
      note: reason || 'Leave request denied',
    })

    res.json(request)
  } catch (error) {
    res.status(500).json({ error: 'Failed to deny leave request' })
  }
})

router.patch('/leave-requests/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body

    const [request] = await db
      .update(leaveRequests)
      .set({
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, parseInt(req.params.id)))
      .returning()

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Create audit trail event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: request.id,
      status: 'canceled',
      actorId: req.user!.id,
      note: reason || 'Leave request canceled',
    })

    res.json(request)
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel leave request' })
  }
})

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
        totalDays: leaveBalances.totalDays,
        adjustmentDays: leaveBalances.adjustmentDays,
      })
      .from(leaveBalances)
      .leftJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id))
      .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))

    res.json(balances)
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
    console.error('Error deleting client:', error)
    res.status(500).json({ error: 'Failed to delete client' })
  }
})

export { router as adminRouter }
