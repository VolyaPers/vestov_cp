import { Router } from 'express'
import { db } from '../db/index.js'
import { feedback, feedbackMessages, clients, users, clientServices, serviceTypes, teamMembers, clientServiceTeamMembers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { canAccessClient, canAccessService } from '../services/access.js'
import { resolveClientScope, coversDate, dateKey } from '../services/clientWorkspace.js'
import { feedbackStatus, feedbackMessageBody, nextFeedbackStatus, FeedbackWorkflowError, type FeedbackAction } from '../services/feedbackWorkflow.js'
import { getWorkflowAccess, requireWorkflowCapability, queueWorkflowNotification, workflowRecipients } from '../services/workflow.js'
import { workflowDueAt } from '../utils/workflowTime.js'

const defaultDependencies = { getWorkflowAccess, requireWorkflowCapability, queueWorkflowNotification, workflowRecipients }

export function createFeedbackRouter(dependencies: typeof defaultDependencies = defaultDependencies) {
const router = Router()
router.use(requireAuth)
router.param('feedbackId', (_req, res, next, value) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ error: 'Invalid feedback ID' })
  next()
})
const handle = (action: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
  try { await action(req, res) }
  catch (error: any) {
    const status = Number(error?.status || error?.statusCode || 500)
    if (status >= 500) console.error('Feedback workflow failed:', error)
    res.status(status >= 400 && status <= 599 ? status : 500).json({ error: status < 500 ? error.message : 'Unable to update feedback. Please try again.' })
  }
}
router.use(async (req: any, res, next) => {
  if (!req.user.originalUserId) return next()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return res.status(403).json({ error: 'Exit user preview before changing feedback. Resolution must be confirmed by the client author.' })
  try {
    const [originalUser] = await db.select().from(users).where(eq(users.id, req.user.originalUserId))
    if (!originalUser || !(await dependencies.getWorkflowAccess(originalUser)).canViewQueue) return res.status(403).json({ error: 'Feedback queue access is required to preview private conversations' })
    next()
  } catch { res.status(500).json({ error: 'Unable to verify feedback preview access' }) }
})

async function listFeedback(where?: ReturnType<typeof and>, options: { beforeId?: number; messageLimit?: number; beforeMessageId?: number } = {}) {
  const messageLimit = options.messageLimit || 3
  const fetched = await db.select({ feedback, client: { id: clients.id, name: clients.name }, service: { id: clientServices.id, serviceTitle: clientServices.serviceTitle }, serviceType: { name: serviceTypes.name }, teamMember: { id: teamMembers.id, fullName: teamMembers.name }, submittedBy: { id: users.id, fullName: users.fullName },
    latestReply: sql<string>`(select body from feedback_messages fm where fm.feedback_id = ${feedback.id} and fm.author_id <> ${feedback.userId} and fm.kind in ('reply', 'resolution_requested') order by fm.id desc limit 1)`,
    latestReplyAt: sql<Date>`(select created_at from feedback_messages fm where fm.feedback_id = ${feedback.id} and fm.author_id <> ${feedback.userId} and fm.kind in ('reply', 'resolution_requested') order by fm.id desc limit 1)`.mapWith(feedbackMessages.createdAt),
  }).from(feedback).leftJoin(clients, eq(feedback.clientId, clients.id))
    .leftJoin(clientServices, eq(feedback.clientServiceId, clientServices.id)).leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
    .leftJoin(teamMembers, eq(feedback.teamMemberId, teamMembers.id)).innerJoin(users, eq(feedback.userId, users.id))
    .where(and(where, options.beforeId ? sql`${feedback.id} < ${options.beforeId}` : undefined)).orderBy(desc(feedback.id)).limit(51)
  const rows = fetched.slice(0, 50)
  // The lateral limit bounds both work and payload per thread, even with long histories.
  // Raw SQL bypasses Drizzle's UTC timestamp decoder; return an explicit instant.
  const messages = rows.length ? (await db.execute<{
    id: number; feedbackId: number; authorId: number; body: string; kind: string; createdAt: Date | string; authorName: string; authorRole: string;
  }>(sql`select candidate.id, candidate.feedback_id as "feedbackId", candidate.author_id as "authorId", candidate.body, candidate.kind, candidate.created_at at time zone 'UTC' as "createdAt", author.full_name as "authorName", author.role as "authorRole"
    from ${feedback} cross join lateral (
      select * from feedback_messages fm where fm.feedback_id = ${feedback.id}
        ${options.beforeMessageId ? sql`and fm.id < ${options.beforeMessageId}` : sql``}
      order by fm.id desc limit ${messageLimit + 1}
    ) candidate inner join users author on author.id = candidate.author_id
    where ${inArray(feedback.id, rows.map(row => row.feedback.id))} order by candidate.id desc`)).rows : []
  const threads = new Map<number, typeof messages>()
  for (const message of messages) {
    let thread = threads.get(message.feedbackId)
    if (!thread) { thread = []; threads.set(message.feedbackId, thread) }
    thread.push(message)
  }
  const feedbacks = rows.map(row => {
    const item = row.feedback
    const allMessages = threads.get(item.id) || []
    const recent = allMessages.slice(0, messageLimit)
    const thread = recent.reverse().map(message => ({ id: message.id, feedbackId: message.feedbackId, body: message.body, kind: message.kind, createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt), author: { id: message.authorId, fullName: message.authorName, role: message.authorRole }, isClient: message.authorId === item.userId }))
    const firstRespondedAt = item.firstRespondedAt || item.adminRespondedAt
    const firstResponseDueAt = item.firstResponseDueAt || workflowDueAt(item.createdAt)
    return {
      ...item, status: feedbackStatus(item.status), adminResponse: row.latestReply || item.adminResponse, adminRespondedAt: row.latestReplyAt || item.adminRespondedAt,
      firstResponseDueAt, firstRespondedAt,
      firstResponseOverdue: !firstRespondedAt && new Date(firstResponseDueAt).getTime() < Date.now(),
      client: row.client, service: row.service ? { id: row.service.id, serviceTitle: row.service.serviceTitle || row.serviceType?.name || 'Service' } : null,
      teamMember: row.teamMember, submittedBy: row.submittedBy,
      nextMessageCursor: allMessages.length > messageLimit ? recent[0].id : null,
      messages: [
        ...(item.adminResponse && allMessages.length <= messageLimit ? [{ id: `legacy-${item.id}`, feedbackId: item.id, body: item.adminResponse, kind: 'reply', createdAt: item.adminRespondedAt || item.createdAt, author: { id: item.adminRespondedBy, fullName: 'Vestov team', role: 'admin' }, isClient: false, historical: true }] : []),
        ...thread,
      ],
    }
  })
  return { feedbacks, nextCursor: fetched.length > 50 ? rows[rows.length - 1].feedback.id : null }
}

function cursor(value: unknown) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new FeedbackWorkflowError('Invalid pagination cursor', 400)
  return Number(value)
}

router.get('/admin', handle(async (req, res) => {
  const access = await dependencies.getWorkflowAccess(req.user)
  if (!access.canViewQueue) throw new FeedbackWorkflowError('Feedback queue access required', 403)
  res.json({ ...await listFeedback(undefined, { beforeId: cursor(req.query.before) }), canManageFeedback: access.canManageFeedback })
}))

router.get('/client', handle(async (req, res) => {
  if (req.user.role !== 'client') throw new FeedbackWorkflowError('Client access required', 403)
  const clientId = await resolveClientScope(req, res)
  if (!clientId) return
  res.json({ ...await listFeedback(and(eq(feedback.userId, req.user.id), eq(feedback.clientId, clientId)), { beforeId: cursor(req.query.before) }), canReply: !req.user.originalUserId })
}))

router.get('/:feedbackId/thread', handle(async (req, res) => {
  const [item] = await db.select().from(feedback).where(eq(feedback.id, Number(req.params.feedbackId)))
  if (!item) throw new FeedbackWorkflowError('Feedback not found', 404)
  if (req.user.role === 'client') {
    if (item.userId !== req.user.id || !item.clientId || !await canAccessClient(req.user, item.clientId)) throw new FeedbackWorkflowError('Feedback not found', 404)
  } else if (!(await dependencies.getWorkflowAccess(req.user)).canViewQueue) throw new FeedbackWorkflowError('Feedback queue access required', 403)
  const result = await listFeedback(eq(feedback.id, item.id), { messageLimit: 100, beforeMessageId: cursor(req.query.beforeMessage) })
  res.json(result.feedbacks[0])
}))

// Get services for client user (for feedback form)
router.get('/client-services', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'client') return res.status(403).json({ error: 'Client access required' })

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
    if (req.user?.role !== 'client') return res.status(403).json({ error: 'Client access required' })
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
    if (user.role !== 'client') return res.status(403).json({ error: 'Client access required' })
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

    const createdAt = new Date()
    const newFeedback = await db.transaction(async tx => {
    const [created] = await tx
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
        createdAt, updatedAt: createdAt,
        firstResponseDueAt: workflowDueAt(createdAt),
      })
      .returning()
    const recipients = await dependencies.workflowRecipients(tx)
    await dependencies.queueWorkflowNotification(tx, { eventKey: `feedback:${created.id}:created`, recipientIds: recipients.ownerIds, title: 'New client feedback', body: `Feedback #${created.id} requires a first response within one working day.`, href: `/admin/feedback?feedback=${created.id}` })
    return created
    })

    res.json(newFeedback)
  } catch (error) {
    console.error('Error creating feedback:', error)
    res.status(500).json({ error: 'Failed to create feedback' })
  }
})


async function changeThread(req: any, action: FeedbackAction) {
  const isManagerAction = action === 'manager_reply' || action === 'request_confirmation'
  if (isManagerAction) await dependencies.requireWorkflowCapability(req.user, 'canManageFeedback')
  else if (req.user.role !== 'client') throw new FeedbackWorkflowError('Only the client author can perform this action', 403)
  const body = action === 'confirm' ? 'Confirmed that the issue is resolved.' : feedbackMessageBody(isManagerAction ? req.body.adminResponse : req.body.body)
  const feedbackId = Number(req.params.feedbackId)
  return db.transaction(async tx => {
    // Serialize replies and confirmations so no concurrent reply is silently closed.
    const [item] = await tx.select().from(feedback).where(eq(feedback.id, feedbackId)).for('update')
    if (!item) throw new FeedbackWorkflowError('Feedback not found', 404)
    if (!isManagerAction && (item.userId !== req.user.id || !item.clientId || !await canAccessClient(req.user, item.clientId))) throw new FeedbackWorkflowError('Feedback not found', 404)
    const firstRespondedAt = item.firstRespondedAt || item.adminRespondedAt
    const status = nextFeedbackStatus(item.status, action, Boolean(firstRespondedAt))
    const now = new Date()
    const kind = action === 'request_confirmation' ? 'resolution_requested' : action === 'confirm' ? 'confirmed' : action === 'reopen' ? 'reopened' : 'reply'
    const [message] = await tx.insert(feedbackMessages).values({ feedbackId, authorId: req.user.id, body, kind, createdAt: now }).returning()
    const [updated] = await tx.update(feedback).set({
      status, updatedAt: now,
      firstResponseDueAt: item.firstResponseDueAt || workflowDueAt(item.createdAt),
      firstRespondedAt: firstRespondedAt || (isManagerAction ? now : null),
      resolvedAt: status === 'resolved' ? now : null,
    }).where(eq(feedback.id, feedbackId)).returning()
    const recipients = isManagerAction ? [item.userId] : (await dependencies.workflowRecipients(tx)).ownerIds
    const title = isManagerAction ? action === 'request_confirmation' ? 'Please confirm the feedback resolution' : 'New reply to your feedback'
      : action === 'confirm' ? 'Client confirmed feedback resolution' : action === 'reopen' ? 'Client reopened feedback' : 'Client replied to feedback'
    await dependencies.queueWorkflowNotification(tx, {
      eventKey: `feedback:${feedbackId}:message:${message.id}`, recipientIds: recipients, title,
      body: `Feedback #${feedbackId} has an update. Open the private thread to view it.`,
      href: isManagerAction ? `/client/feedback?feedback=${feedbackId}&clientId=${item.clientId}` : `/admin/feedback?feedback=${feedbackId}`,
    })
    return { ...updated, status: feedbackStatus(updated.status), message }
  })
}

router.post('/:feedbackId/respond', handle(async (req, res) => {
  if (req.body.requestConfirmation !== undefined && typeof req.body.requestConfirmation !== 'boolean') throw new FeedbackWorkflowError('requestConfirmation must be a boolean', 400)
  res.json(await changeThread(req, req.body.requestConfirmation === true ? 'request_confirmation' : 'manager_reply'))
}))
router.post('/:feedbackId/reply', handle(async (req, res) => res.json(await changeThread(req, 'client_reply'))))
router.post('/:feedbackId/confirm', handle(async (req, res) => res.json(await changeThread(req, 'confirm'))))
router.post('/:feedbackId/reopen', handle(async (req, res) => res.json(await changeThread(req, 'reopen'))))
router.delete('/:feedbackId', handle(async (req, res) => {
  await dependencies.requireWorkflowCapability(req.user, 'canManageFeedback')
  res.status(405).json({ error: 'Feedback history is retained. Only the client author can confirm resolution.' })
}))

return router
}

export const feedbackRouter = createFeedbackRouter()
