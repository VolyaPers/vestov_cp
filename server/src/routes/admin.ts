import { Router } from 'express'
import { eq, desc, and, sql } from 'drizzle-orm'
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
  feedback
} from '../db/schema.js'
import { requireAdmin } from '../middleware/auth.js'
import { calculateDays } from '../utils/dateUtils.js'

const router = Router()

// Apply admin middleware to all routes
router.use(requireAdmin)

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [clientCount] = await db.select({ count: sql`count(*)` }).from(clients)
    const [teamMemberCount] = await db.select({ count: sql`count(*)` }).from(teamMembers)
    const [pendingLeaveRequests] = await db
      .select({ count: sql`count(*)` })
      .from(leaveRequests)
      .where(eq(leaveRequests.status, 'pending'))

    const activeTeamMembers = await db
      .select({ count: sql`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.status, 'active'))

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
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, parseInt(req.params.id)))
    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }
    res.json(client)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client' })
  }
})

router.post('/clients', async (req, res) => {
  try {
    const [client] = await db.insert(clients).values(req.body).returning()
    res.json(client)
  } catch (error) {
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

// Team Members CRUD
router.get('/team-members', async (req, res) => {
  try {
    const members = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        role: teamMembers.role,
        email: teamMembers.email,
        phone: teamMembers.phone,
        skills: teamMembers.skills,
        bio: teamMembers.bio,
        hourlyRate: teamMembers.hourlyRate,
        monthlyRate: teamMembers.monthlyRate,
        status: teamMembers.status,
        startDate: teamMembers.startDate,
        location: teamMembers.location,
        avatarUrl: teamMembers.avatarUrl,
        clientId: teamMembers.clientId,
        clientName: clients.name,
      })
      .from(teamMembers)
      .leftJoin(clients, eq(teamMembers.clientId, clients.id))
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
        role: teamMembers.role,
        email: teamMembers.email,
        phone: teamMembers.phone,
        skills: teamMembers.skills,
        bio: teamMembers.bio,
        hourlyRate: teamMembers.hourlyRate,
        monthlyRate: teamMembers.monthlyRate,
        status: teamMembers.status,
        startDate: teamMembers.startDate,
        location: teamMembers.location,
        avatarUrl: teamMembers.avatarUrl,
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

router.post('/team-members', async (req, res) => {
  try {
    const [member] = await db.insert(teamMembers).values(req.body).returning()
    res.json(member)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create team member' })
  }
})

router.put('/team-members/:id', async (req, res) => {
  try {
    const [member] = await db
      .update(teamMembers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(teamMembers.id, parseInt(req.params.id)))
      .returning()
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }
    res.json(member)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update team member' })
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
        employeeRole: teamMembers.role,
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
    
    // Calculate days count
    const daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd)
    
    const [request] = await db.insert(leaveRequests).values({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      halfDayStart: halfDayStart || false,
      halfDayEnd: halfDayEnd || false,
      daysCount,
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
      updateData.daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd)
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

export { router as adminRouter }