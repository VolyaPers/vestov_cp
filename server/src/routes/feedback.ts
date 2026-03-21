import { Router } from 'express'
import { db } from '../db/index.js'
import { feedback, clients, users, clientServices, serviceTypes, teamMembers, clientServiceTeamMembers, clientUsers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc } from 'drizzle-orm'

const router = Router()

// Get all feedbacks for admin (with client/service/developer info)
router.get('/admin', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const feedbacks = await db
      .select({
        feedback: feedback,
        client: {
          id: clients.id,
          name: clients.name,
        },
        service: {
          id: clientServices.id,
          serviceTitle: clientServices.serviceTitle,
        },
        serviceType: {
          name: serviceTypes.name,
        },
        teamMember: {
          id: teamMembers.id,
          name: teamMembers.name,
        },
        submittedBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
        respondedBy: {
          id: users.id,
          fullName: users.fullName,
        }
      })
      .from(feedback)
      .leftJoin(clients, eq(feedback.clientId, clients.id))
      .leftJoin(clientServices, eq(feedback.clientServiceId, clientServices.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .leftJoin(teamMembers, eq(feedback.teamMemberId, teamMembers.id))
      .innerJoin(users, eq(feedback.userId, users.id))
      .orderBy(desc(feedback.createdAt))

    // Format the response
    const formattedFeedbacks = feedbacks.map(f => ({
      id: f.feedback.id,
      rating: f.feedback.rating,
      comments: f.feedback.comments,
      feedbackType: f.feedback.feedbackType,
      status: f.feedback.status,
      createdAt: f.feedback.createdAt,
      adminResponse: f.feedback.adminResponse,
      adminRespondedAt: f.feedback.adminRespondedAt,
      client: f.client ? { id: f.client.id, name: f.client.name } : null,
      service: f.service ? {
        id: f.service.id,
        serviceTitle: f.service.serviceTitle || f.serviceType?.name || 'Service'
      } : null,
      teamMember: f.teamMember ? { id: f.teamMember.id, fullName: f.teamMember.name } : null,
      submittedBy: { id: f.submittedBy.id, fullName: f.submittedBy.fullName },
    }))

    res.json({ feedbacks: formattedFeedbacks })
  } catch (error) {
    console.error('Error fetching admin feedbacks:', error)
    res.status(500).json({ error: 'Failed to fetch feedbacks' })
  }
})

// Get feedbacks submitted by current client user
router.get('/client', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user

    // Get feedbacks submitted by this user
    const feedbacks = await db
      .select({
        feedback: feedback,
        service: {
          id: clientServices.id,
          serviceTitle: clientServices.serviceTitle,
        },
        serviceType: {
          name: serviceTypes.name,
        },
        teamMember: {
          id: teamMembers.id,
          name: teamMembers.name,
        },
      })
      .from(feedback)
      .leftJoin(clientServices, eq(feedback.clientServiceId, clientServices.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .leftJoin(teamMembers, eq(feedback.teamMemberId, teamMembers.id))
      .where(eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt))

    const formattedFeedbacks = feedbacks.map(f => ({
      id: f.feedback.id,
      rating: f.feedback.rating,
      comments: f.feedback.comments,
      feedbackType: f.feedback.feedbackType,
      status: f.feedback.status,
      createdAt: f.feedback.createdAt,
      adminResponse: f.feedback.adminResponse,
      adminRespondedAt: f.feedback.adminRespondedAt,
      service: f.service ? {
        id: f.service.id,
        serviceTitle: f.service.serviceTitle || f.serviceType?.name || 'Service'
      } : null,
      teamMember: f.teamMember ? { id: f.teamMember.id, fullName: f.teamMember.name } : null,
    }))

    res.json({ feedbacks: formattedFeedbacks })
  } catch (error) {
    console.error('Error fetching client feedbacks:', error)
    res.status(500).json({ error: 'Failed to fetch feedbacks' })
  }
})

// Get services for client user (for feedback form)
router.get('/client-services', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user

    // Get clients the user has access to
    const userClients = await db
      .select({
        clientId: clientUsers.clientId,
        clientName: clients.name,
      })
      .from(clientUsers)
      .innerJoin(clients, eq(clientUsers.clientId, clients.id))
      .where(and(
        eq(clientUsers.userId, user.id),
        eq(clientUsers.isActive, true)
      ))

    if (userClients.length === 0) {
      return res.json({ services: [] })
    }

    const clientIds = userClients.map(c => c.clientId)

    // Get all active services for these clients
    const services = await db
      .select({
        service: clientServices,
        serviceType: serviceTypes,
        client: clients,
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(clientServices.isActive, true))

    const filteredServices = services.filter(s => clientIds.includes(s.service.clientId))

    const formattedServices = filteredServices.map(s => ({
      id: s.service.id,
      clientId: s.service.clientId,
      clientName: s.client.name,
      serviceTitle: s.service.serviceTitle || s.serviceType?.name || 'Service',
      serviceCategory: s.serviceType?.category,
    }))

    res.json({ services: formattedServices })
  } catch (error) {
    console.error('Error fetching client services:', error)
    res.status(500).json({ error: 'Failed to fetch services' })
  }
})

// Get developers for a specific service (for feedback form)
router.get('/service/:clientServiceId/developers', requireAuth, async (req, res) => {
  try {
    const { clientServiceId } = req.params

    // Get all team members for this service
    const developers = await db
      .select({
        cstm: clientServiceTeamMembers,
        teamMember: teamMembers,
      })
      .from(clientServiceTeamMembers)
      .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .where(and(
        eq(clientServiceTeamMembers.clientServiceId, parseInt(clientServiceId)),
        eq(clientServiceTeamMembers.isActive, true)
      ))

    const formattedDevelopers = developers.map(d => ({
      id: d.teamMember.id,
      fullName: d.teamMember.name,
      role: d.teamMember.position,
      avatarUrl: d.teamMember.avatarUrl,
    }))

    res.json({ developers: formattedDevelopers })
  } catch (error) {
    console.error('Error fetching service developers:', error)
    res.status(500).json({ error: 'Failed to fetch developers' })
  }
})

// Create new feedback
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    const { clientServiceId, teamMemberId, rating, comments, feedbackType } = req.body

    if (!rating || !comments) {
      return res.status(400).json({ error: 'Rating and comments are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' })
    }

    // Determine clientId from service or from user's client association
    let clientId: number | null = null

    if (clientServiceId) {
      // Get client from service
      const service = await db
        .select()
        .from(clientServices)
        .where(eq(clientServices.id, parseInt(clientServiceId)))
        .limit(1)

      if (service.length === 0) {
        return res.status(404).json({ error: 'Service not found' })
      }

      clientId = service[0].clientId
    } else {
      // Get client from user's association
      const userClient = await db
        .select()
        .from(clientUsers)
        .where(and(
          eq(clientUsers.userId, user.id),
          eq(clientUsers.isActive, true)
        ))
        .limit(1)

      if (userClient.length > 0) {
        clientId = userClient[0].clientId
      }
    }

    // If teamMemberId provided, verify they're part of the service
    if (teamMemberId && clientServiceId) {
      const memberInService = await db
        .select()
        .from(clientServiceTeamMembers)
        .where(and(
          eq(clientServiceTeamMembers.clientServiceId, parseInt(clientServiceId)),
          eq(clientServiceTeamMembers.teamMemberId, parseInt(teamMemberId)),
          eq(clientServiceTeamMembers.isActive, true)
        ))
        .limit(1)

      if (memberInService.length === 0) {
        return res.status(400).json({ error: 'Team member not found in this service' })
      }
    }

    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId: user.id,
        clientId: clientId,
        clientServiceId: clientServiceId ? parseInt(clientServiceId) : null,
        teamMemberId: teamMemberId ? parseInt(teamMemberId) : null,
        rating: parseInt(rating),
        comments: comments.trim(),
        feedbackType: feedbackType || (teamMemberId ? 'team_member' : 'general'),
        status: 'pending',
      })
      .returning()

    res.json(newFeedback)
  } catch (error) {
    console.error('Error creating feedback:', error)
    res.status(500).json({ error: 'Failed to create feedback' })
  }
})

// Admin responds to feedback
router.post('/:feedbackId/respond', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { feedbackId } = req.params
    const { adminResponse } = req.body

    if (!adminResponse || adminResponse.trim() === '') {
      return res.status(400).json({ error: 'Response is required' })
    }

    const [updatedFeedback] = await db
      .update(feedback)
      .set({
        adminResponse: adminResponse.trim(),
        adminRespondedBy: user.id,
        adminRespondedAt: new Date(),
        status: 'reviewed',
      })
      .where(eq(feedback.id, parseInt(feedbackId)))
      .returning()

    if (!updatedFeedback) {
      return res.status(404).json({ error: 'Feedback not found' })
    }

    res.json(updatedFeedback)
  } catch (error) {
    console.error('Error responding to feedback:', error)
    res.status(500).json({ error: 'Failed to respond to feedback' })
  }
})

// Delete feedback (Admin only)
router.delete('/:feedbackId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { feedbackId } = req.params

    const deletedFeedback = await db
      .delete(feedback)
      .where(eq(feedback.id, parseInt(feedbackId)))
      .returning()

    if (deletedFeedback.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' })
    }

    res.json({ message: 'Feedback deleted successfully' })
  } catch (error) {
    console.error('Error deleting feedback:', error)
    res.status(500).json({ error: 'Failed to delete feedback' })
  }
})

export { router as feedbackRouter }
