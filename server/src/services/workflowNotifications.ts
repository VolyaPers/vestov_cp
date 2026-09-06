import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { db } from '../db/index.js'
import { users, workflowNotifications, leaveRequests, reimbursementRequests, feedback } from '../db/schema.js'
import { getWorkflowAccess, listWorkflowDecisions, queueWorkflowNotification } from './workflow.js'
import { workflowDueAt, isWorkflowWorkingDay } from '../utils/workflowTime.js'

export const workflowSlackEnabled = () => process.env.SLACK_NOTIFICATIONS_ENABLED === 'true' && Boolean(process.env.SLACK_BOT_TOKEN)
export async function enqueueOverdueReminders(now = new Date()) {
  const { items } = await listWorkflowDecisions(undefined, now)
  const activeReminders = new Set(items.filter(item => item.overdue).map(item => `overdue:${item.id}:${item.dueAt}`))
  const stored = await db.select({ id: workflowNotifications.id, eventKey: workflowNotifications.eventKey }).from(workflowNotifications).where(and(isNull(workflowNotifications.supersededAt), sql`${workflowNotifications.eventKey} LIKE 'overdue:%'`))
  const obsoleteIds = stored.filter(row => !activeReminders.has(row.eventKey)).map(row => row.id)
  if (obsoleteIds.length) await db.update(workflowNotifications).set({ supersededAt: now, slackLastError: null }).where(inArray(workflowNotifications.id, obsoleteIds))
  if (!isWorkflowWorkingDay(now)) return
  // One durable reminder per outstanding decision deadline, never per poll/run.
  await db.transaction(async tx => {
    for (const item of items.filter(item => item.overdue)) {
      if (!await decisionStillPending(item.kind, item.entityId, tx)) continue
      await queueWorkflowNotification(tx, { eventKey: `overdue:${item.id}:${item.dueAt}`, recipientIds: item.recipientIds, title: 'Decision overdue', body: `${item.title}. The one-working-day response deadline has passed.`, href: item.href })
    }
  })
}
async function decisionStillPending(kind: string, id: number, tx: any = db): Promise<boolean> {
  if (kind === 'leave') return Boolean((await tx.select({ id: leaveRequests.id }).from(leaveRequests).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'pending'), isNull(leaveRequests.archivedAt))).limit(1))[0])
  if (kind === 'purchase') return Boolean((await tx.select({ id: reimbursementRequests.id }).from(reimbursementRequests).where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.status, 'pending'))).limit(1))[0])
  if (kind === 'feedback') return Boolean((await tx.select({ id: feedback.id }).from(feedback).where(and(eq(feedback.id, id), inArray(feedback.status, ['pending', 'in_progress']), isNull(feedback.firstRespondedAt), isNull(feedback.adminRespondedAt))).limit(1))[0])
  return false
}
async function reminderStillRelevant(eventKey: string) {
  if (!eventKey.startsWith('overdue:')) return true
  const [, kind, id, ...deadline] = eventKey.split(':')
  if (!await decisionStillPending(kind, Number(id))) return false
  if (kind === 'leave') {
    const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, Number(id)))
    return row && workflowDueAt(row.decisionRequestedAt || row.createdAt).toISOString() === deadline.join(':')
  }
  return true
}
class SlackDeliveryError extends Error {
  constructor(message: string, public retrySeconds?: number) { super(message) }
}
async function slackApi(method: string, values: Record<string, unknown>, fetcher: typeof fetch) {
  const lookup = method === 'users.lookupByEmail'
  const url = new URL(`https://slack.com/api/${method}`)
  if (lookup) url.searchParams.set('email', String(values.email))
  const response = await fetcher(url, {
    method: lookup ? 'GET' : 'POST', headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    ...(lookup ? {} : { body: JSON.stringify(values) }), signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 429) throw new SlackDeliveryError('ratelimited', Number(response.headers.get('retry-after')) || 60)
  const payload = await response.json() as any
  if (!response.ok || !payload.ok) throw new SlackDeliveryError(payload.error || `Slack HTTP ${response.status}`)
  return payload
}
export async function deliverWorkflowNotifications(fetcher: typeof fetch = fetch, now = new Date()) {
  if (!workflowSlackEnabled()) return
  // Claim a small batch with a lease. A crashed worker releases it automatically.
  const rows = await db.transaction(async tx => {
    const claimed = await tx.select().from(workflowNotifications)
      .where(and(isNull(workflowNotifications.slackSentAt), isNull(workflowNotifications.supersededAt), lte(workflowNotifications.slackNextAttemptAt, now)))
      .orderBy(workflowNotifications.id).limit(5).for('update', { skipLocked: true })
    if (claimed.length) await tx.update(workflowNotifications).set({ slackNextAttemptAt: new Date(now.getTime() + 10 * 60_000) }).where(inArray(workflowNotifications.id, claimed.map(row => row.id)))
    return claimed
  })
  for (const row of rows) {
    try {
      const [recipient] = await db.select().from(users).where(eq(users.id, row.userId))
      if (!recipient || recipient.isActive === false || !await reminderStillRelevant(row.eventKey) || (row.href.startsWith('/admin/') && !(await getWorkflowAccess(recipient)).canViewQueue)) {
        await db.update(workflowNotifications).set({ supersededAt: new Date(), slackLastError: null }).where(eq(workflowNotifications.id, row.id))
        continue
      }
      const lookup = await slackApi('users.lookupByEmail', { email: recipient.email }, fetcher)
      if (!lookup.user?.id || lookup.user.deleted) throw new SlackDeliveryError('users_not_found')
      const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'https://hub.vestov.com'
      const digest = createHash('sha256').update(`vestov-workflow:${row.id}`).digest('hex')
      const clientMessageId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
      // Private DM only. No medical reason, receipt or client feedback text is copied into Slack.
      if (!await reminderStillRelevant(row.eventKey)) {
        await db.update(workflowNotifications).set({ supersededAt: new Date(), slackLastError: null }).where(eq(workflowNotifications.id, row.id))
        continue
      }
      await slackApi('chat.postMessage', { channel: lookup.user.id, text: `${row.title}\n${new URL(row.href, frontendUrl).toString()}`, client_msg_id: clientMessageId, mrkdwn: false, unfurl_links: false, unfurl_media: false }, fetcher)
      await db.update(workflowNotifications).set({ slackSentAt: new Date(), slackAttempts: row.slackAttempts + 1, slackLastError: null }).where(eq(workflowNotifications.id, row.id))
    } catch (error) {
      const delay = error instanceof SlackDeliveryError && error.retrySeconds
        ? Math.max(60, error.retrySeconds) * 1000 : Math.min(6 * 3600_000, 60_000 * 2 ** Math.min(row.slackAttempts, 9))
      await db.update(workflowNotifications).set({ slackAttempts: row.slackAttempts + 1, slackNextAttemptAt: new Date(Date.now() + delay), slackLastError: (error instanceof Error ? error.message : 'Delivery failed').slice(0, 500) }).where(eq(workflowNotifications.id, row.id))
    }
  }
}
let timer: ReturnType<typeof setInterval> | undefined
export function startWorkflowScheduler() {
  if (timer) return
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try { await enqueueOverdueReminders(); await deliverWorkflowNotifications() }
    catch (error) { console.error('[WORKFLOW] Notification worker failed:', error instanceof Error ? error.message : 'Unknown error') }
    finally { running = false }
  }
  timer = setInterval(() => { void tick() }, 60_000)
  timer.unref()
  void tick()
}
