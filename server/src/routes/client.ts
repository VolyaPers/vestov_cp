import { Router } from 'express'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  clients,
  teamMembers,
  serviceRequests,
  documents,
  feedback,
  messages
} from '../db/schema.js'
import { requireClient } from '../middleware/auth.js'

const router = Router()

// Apply client middleware to all routes
router.use(requireClient)

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const clientId = req.user!.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'No client associated with user' })
    }

    // Get client info
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId))

    // Get assigned team members
    const assignedTeam = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.clientId, clientId), eq(teamMembers.status, 'active')))

    // Get recent service requests
    const recentRequests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.userId, req.user!.id))
      .orderBy(desc(serviceRequests.requestDate))
      .limit(5)

    res.json({
      client,
      teamSize: assignedTeam.length,
      activeServices: client?.activeServices || [],
      recentRequests,
      stats: {
        totalTeamMembers: assignedTeam.length,
        activeServices: (client?.activeServices as any[])?.length || 0,
        pendingRequests: recentRequests.filter(r => r.status === 'pending').length,
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
    const clientId = (req.user as any)?.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'No client associated with user' })
    }

    const team = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        role: teamMembers.role,
        email: teamMembers.email,
        phone: teamMembers.phone,
        skills: teamMembers.skills,
        bio: teamMembers.bio,
        status: teamMembers.status,
        startDate: teamMembers.startDate,
        location: teamMembers.location,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(teamMembers)
      .where(eq(teamMembers.clientId, clientId))
      .orderBy(teamMembers.name)

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
    const clientId = req.user!.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'No client associated with user' })
    }

    const clientDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.clientId, clientId))
      .orderBy(desc(documents.lastUpdated))

    res.json(clientDocuments)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Feedback
router.get('/feedback', async (req, res) => {
  try {
    const clientId = req.user!.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'No client associated with user' })
    }

    const clientFeedback = await db
      .select({
        id: feedback.id,
        teamMemberId: feedback.teamMemberId,
        teamMemberName: teamMembers.name,
        rating: feedback.rating,
        comments: feedback.comments,
        feedbackType: feedback.feedbackType,
        status: feedback.status,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .leftJoin(teamMembers, eq(feedback.teamMemberId, teamMembers.id))
      .where(eq(feedback.clientId, clientId))
      .orderBy(desc(feedback.createdAt))

    res.json(clientFeedback)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
})

router.post('/feedback', async (req, res) => {
  try {
    const clientId = req.user!.clientId
    if (!clientId) {
      return res.status(400).json({ error: 'No client associated with user' })
    }

    const { teamMemberId, rating, comments, feedbackType } = req.body

    const [newFeedback] = await db.insert(feedback).values({
      userId: req.user!.id,
      clientId,
      teamMemberId,
      rating,
      comments,
      feedbackType: feedbackType || 'client_feedback',
    }).returning()

    res.json(newFeedback)
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

// Messages
router.get('/messages', async (req, res) => {
  try {
    const userMessages = await db
      .select()
      .from(messages)
      .where(
        and(
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