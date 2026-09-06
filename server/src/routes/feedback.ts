import { Router } from 'express'
import { db } from '../db/index.js'
import { feedback, clients, users, clientServices, serviceTypes, teamMembers, clientServiceTeamMembers, clientUsers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { canAccessClient, canAccessService } from '../services/access.js'
import { resolveClientScope, coversDate, dateKey } from '../services/clientWorkspace.js'

const router = Router()
router.use(requireAuth, (req, res, next) => {
  if (!req.user || !['admin', 'client'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' })
  next()
})

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

    const clientId = await resolveClientScope(req, res)
    if (!clientId) return
    // Preserve author privacy within the selected client workspace
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
      .where(and(eq(feedback.userId, user.id), eq(feedback.clientId, clientId)))
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

    const clientId = await resolveClientScope(req, res)
    if (!clientId) return
    const services = await db.select({ service: clientServices, serviceType: serviceTypes, client: clients })
      .from(clientServices).innerJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(clientServices.clientId, clientId))
    const filteredServices = services.filter(s => coversDate(s.service, dateKey()))

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
    if (!await canAccessService(req.user!, Number(clientServiceId))) return res.status(403).json({ error: 'Access denied' })
    const [service] = await db.select().from(clientServices).where(eq(clientServices.id, Number(clientServiceId)))
    if (!service || !coversDate(service, dateKey())) return res.status(400).json({ error: 'Select an active project' })

    // Get all team members for this service
    const developers = await db
      .select({
        cstm: clientServiceTeamMembers,
        teamMember: teamMembers,
      })
      .from(clientServiceTeamMembers)
      .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .where(and(
        eq(clientServiceTeamMembers.clientServiceId, Number(clientServiceId)),
        eq(clientServiceTeamMembers.isActive, true)
      ))

    const formattedDevelopers = developers.filter(d => coversDate(d.cstm, dateKey()) && d.teamMember.status === 'active').map(d => ({
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

    if (!Number.isInteger(rating) || typeof comments !== 'string' || !comments.trim() || comments.trim().length > 10000) {
      return res.status(400).json({ error: 'An integer rating and feedback text (1–10000 characters) are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' })
    }

    let selectedClientId = req.body.clientId
    let selectedService: typeof clientServices.$inferSelect | undefined
    if (clientServiceId) {
      if (!Number.isSafeInteger(Number(clientServiceId)) || !await canAccessService(user, Number(clientServiceId))) return res.status(403).json({ error: 'Access denied to this project' })
      ;[selectedService] = await db.select().from(clientServices).where(eq(clientServices.id, Number(clientServiceId)))
      if (!selectedService || !coversDate(selectedService, dateKey())) return res.status(400).json({ error: 'Select an active project' })
      if (selectedClientId !== undefined && Number(selectedClientId) !== selectedService.clientId) return res.status(400).json({ error: 'Project does not belong to the selected client' })
      selectedClientId = selectedService.clientId
    }
    const clientId = await resolveClientScope(req, res, selectedClientId)
    if (!clientId) return
    if (teamMemberId) {
      if (!selectedService || !Number.isSafeInteger(Number(teamMemberId))) return res.status(400).json({ error: 'Select a project for employee feedback' })
      const members = await db.select({ assignment: clientServiceTeamMembers, member: teamMembers }).from(clientServiceTeamMembers)
        .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
        .where(and(eq(clientServiceTeamMembers.clientServiceId, selectedService.id), eq(clientServiceTeamMembers.teamMemberId, Number(teamMemberId))))
      if (!members.some(row => coversDate(row.assignment, dateKey()) && row.member.status === 'active')) return res.status(400).json({ error: 'Team member not found in this active project' })
    }

    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId: user.id,
        clientId: clientId,
        clientServiceId: clientServiceId ? Number(clientServiceId) : null,
        teamMemberId: teamMemberId ? Number(teamMemberId) : null,
        rating,
        comments: comments.trim(),
        feedbackType: teamMemberId ? 'team_member' : clientServiceId ? 'team' : 'general',
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
