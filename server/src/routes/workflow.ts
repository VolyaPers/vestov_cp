import { Router } from 'express'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, workflowNotifications } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { getWorkflowAccess, listWorkflowDecisions, requireWorkflowCapability } from '../services/workflow.js'
import { workflowSlackEnabled } from '../services/workflowNotifications.js'
import { FinanceValidationError, positiveId, financeError } from '../lib/money.js'
export const workflowRouter = Router()
workflowRouter.use(requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next() })
workflowRouter.use((req, res, next) => {
  if (req.user?.originalUserId && !['GET', 'HEAD'].includes(req.method)) return res.status(403).json({ error: 'Exit user preview to change notifications.' })
  next()
})
workflowRouter.get('/access', async (req, res) => {
  try { res.json(await getWorkflowAccess(req.user)) } catch (error) { financeError(res, error, 'Failed to load workflow access') }
})
workflowRouter.get('/decisions', async (req, res) => {
  try {
    await requireWorkflowCapability(req.user!, 'canViewQueue')
    const result = await listWorkflowDecisions(req.user!)
    const [delivery] = await db.select({ pending: sql<number>`count(*) filter (where ${workflowNotifications.slackSentAt} is null and ${workflowNotifications.supersededAt} is null)::int`, failed: sql<number>`count(*) filter (where ${workflowNotifications.slackSentAt} is null and ${workflowNotifications.supersededAt} is null and ${workflowNotifications.slackLastError} is not null)::int` }).from(workflowNotifications)
    res.json({ ...result, items: result.items.map(({ recipientIds, ...item }) => item), delivery: { enabled: workflowSlackEnabled(), ...delivery } })
  } catch (error) { financeError(res, error, 'Failed to load decisions') }
})
workflowRouter.get('/notifications', async (req, res) => {
  try {
    if (req.user!.originalUserId) {
      const [original] = await db.select().from(users).where(eq(users.id, req.user!.originalUserId))
      if (!(await getWorkflowAccess(original)).canViewQueue) throw new FinanceValidationError('Notification preview is available only to the workflow owner or deputy.', 403)
    }
    const [items, [counts]] = await Promise.all([
      db.select({ id: workflowNotifications.id, title: workflowNotifications.title, body: workflowNotifications.body, href: workflowNotifications.href, createdAt: workflowNotifications.createdAt, readAt: workflowNotifications.readAt }).from(workflowNotifications).where(and(eq(workflowNotifications.userId, req.user!.id), isNull(workflowNotifications.supersededAt))).orderBy(desc(workflowNotifications.createdAt), desc(workflowNotifications.id)).limit(50),
      db.select({ unreadCount: sql<number>`count(*)::int` }).from(workflowNotifications).where(and(eq(workflowNotifications.userId, req.user!.id), isNull(workflowNotifications.readAt), isNull(workflowNotifications.supersededAt))),
    ])
    res.json({ items, unreadCount: counts.unreadCount })
  } catch (error) { financeError(res, error, 'Failed to load notifications') }
})
workflowRouter.patch('/notifications/:id/read', async (req, res) => {
  try {
    const [row] = await db.update(workflowNotifications).set({ readAt: new Date() }).where(and(eq(workflowNotifications.id, positiveId(req.params.id)), eq(workflowNotifications.userId, req.user!.id))).returning({ id: workflowNotifications.id })
    if (!row) throw new FinanceValidationError('Notification not found', 404)
    res.json({ success: true })
  } catch (error) { financeError(res, error, 'Failed to update notification') }
})
workflowRouter.post('/notifications/read-all', async (req, res) => {
  try {
    await db.update(workflowNotifications).set({ readAt: new Date() }).where(and(eq(workflowNotifications.userId, req.user!.id), isNull(workflowNotifications.readAt), isNull(workflowNotifications.supersededAt)))
    res.json({ success: true })
  } catch (error) { financeError(res, error, 'Failed to update notifications') }
})
