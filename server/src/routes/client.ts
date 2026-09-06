import { Router } from 'express'
import { eq, desc, and, or, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  clients,
  teamMembers,
  serviceRequests,
  documents,
  feedback,
  messages, clientServices, serviceTypes, clientServiceTeamMembers
} from '../db/schema.js'
import { resolveClientScope, coversDate, dateKey, clientAssignmentDto, clientServiceDto } from '../services/clientWorkspace.js'
import { requireClient } from '../middleware/auth.js'

const router = Router()

// Apply client middleware to all routes
router.use(requireClient)

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const clientId = await resolveClientScope(req, res)
    if (!clientId) return
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId))
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const projects = await db.select({ service: clientServices, type: serviceTypes }).from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id)).where(eq(clientServices.clientId, clientId))
    const activeProjects = projects.filter(row => coversDate(row.service, dateKey()))
    const assignments = activeProjects.length ? await db.select({ assignment: clientServiceTeamMembers, employee: teamMembers }).from(clientServiceTeamMembers)
      .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .where(inArray(clientServiceTeamMembers.clientServiceId, activeProjects.map(row => row.service.id))) : []
    const assignedTeam = [...new Set(assignments.filter(row => coversDate(row.assignment, dateKey()) && row.employee.status === 'active').map(row => row.employee.id))]
    const recentFeedback = await db.select({ id: feedback.id, comments: feedback.comments, status: feedback.status, createdAt: feedback.createdAt, adminResponse: feedback.adminResponse })
      .from(feedback).where(and(eq(feedback.userId, req.user!.id), eq(feedback.clientId, clientId)))
      .orderBy(desc(feedback.createdAt))
    const contractActive = client.status === 'active' && (!client.contractStart || client.contractStart <= dateKey()) && (!client.contractEnd || client.contractEnd >= dateKey())

    res.json({
      client: { ...client, status: contractActive ? 'active' : 'inactive', activeServices: activeProjects.map(row => row.service.serviceTitle || row.type?.name || 'Project') },
      viewer: { fullName: req.user!.fullName },
      teamSize: assignedTeam.length,
      activeServices: activeProjects.map(row => row.service.serviceTitle || row.type?.name || 'Project'),
      recentFeedback: recentFeedback.slice(0, 5),
      stats: {
        totalTeamMembers: assignedTeam.length,
        activeServices: activeProjects.length,
        pendingFeedback: recentFeedback.filter(item => item.status === 'pending').length,
      }
    })
  } catch (error) {
    console.error('Client dashboard error:', error)
    res.status(500).json({ error: 'Failed to load dashboard data' })
  }
})

// Team Members (assigned to client)
router.get('/team', async (req, res) => {
  try {
    const clientId = await resolveClientScope(req, res)
    if (!clientId) return
    const rows = await db.select({ employee: teamMembers, assignment: clientServiceTeamMembers, project: clientServices }).from(clientServiceTeamMembers)
      .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
      .where(eq(clientServices.clientId, clientId))
    const team = [...new Map(rows.filter(row => coversDate(row.project, dateKey()) && coversDate(row.assignment, dateKey()) && row.employee.status === 'active').map(({ employee }) => [employee.id, {
      id: employee.id, employeeId: employee.id, name: employee.name, email: employee.email, position: employee.position, avatarUrl: employee.avatarUrl, skills: employee.skills,
    }])).values()]
    res.json(team)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' })
  }
})

// Service Requests
router.get('/service-requests', async (req, res) => {
  try {
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.userId, req.user!.id))
      .orderBy(desc(serviceRequests.requestDate))

    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch service requests' })
  }
})

router.post('/service-requests', async (req, res) => {
  try {
    const { title, description } = req.body
    if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'Title and description are required' })

    const [request] = await db.insert(serviceRequests).values({
      title,
      description,
      userId: req.user!.id,
    }).returning()

    res.json(request)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service request' })
  }
})

// Documents (accessible to client)
router.get('/documents', async (req, res) => {
  try {
    const clientId = await resolveClientScope(req, res)
    if (!clientId) return

    const clientDocuments = await db
      .select()
      .from(documents)
      .where(and(eq(documents.clientId, clientId), eq(documents.visibleToClient, true)))
      .orderBy(desc(documents.lastUpdated))

    res.json(clientDocuments.map(({ id, name, type, fileSize, documentTitle, createdAt, lastUpdated }) => ({ id, name, type, fileSize, documentTitle, createdAt, lastUpdated })))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Keep legacy URLs on the same validation/authorization path as the current UI.
router.get('/feedback', async (req, res) => {
  const clientId = await resolveClientScope(req, res)
  if (clientId) res.redirect(307, `/api/feedback/client?clientId=${clientId}`)
})
router.post('/feedback', (req, res) => res.redirect(307, '/api/feedback'))

// Messages
router.get('/messages', async (req, res) => {
  try {
    const userMessages = await db
      .select()
      .from(messages)
      .where(
        or(
          eq(messages.senderId, req.user!.id),
          eq(messages.receiverId, req.user!.id)
        )
      )
      .orderBy(desc(messages.createdAt))

    res.json(userMessages)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

export { router as clientRouter }
