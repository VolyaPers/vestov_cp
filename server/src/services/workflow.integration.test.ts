import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import * as s from '../db/schema.js'
const url = process.env.TEST_DATABASE_URL
if (url && (!['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !/^\/vestov_test_/.test(new URL(url).pathname))) throw new Error('Use a disposable local workflow database')
test('workflow inbox is private and atomic; Slack retries survive errors and reminders are deduplicated', { skip: !url }, async () => {
  process.env.DATABASE_URL = url!
  delete process.env.WORKFLOW_OWNER_USER_IDS; delete process.env.WORKFLOW_DEPUTY_USER_IDS
  const { db, pool } = await import('../db/index.js')
  const { getWorkflowAccess, queueWorkflowNotification, listWorkflowDecisions } = await import('./workflow.js')
  const { enqueueOverdueReminders, deliverWorkflowNotifications } = await import('./workflowNotifications.js')
  const { workflowRouter } = await import('../routes/workflow.js')
  const { default: express } = await import('express')
  const tag = randomUUID().slice(0, 8), ids: number[] = [], leaveIds: number[] = []
  let memberId: number | undefined
  const previousSlack = { token: process.env.SLACK_BOT_TOKEN, enabled: process.env.SLACK_NOTIFICATIONS_ENABLED }
  const app = express(); app.use(express.json())
  const fixtureKey = randomUUID()
  app.use(async (req: any, _res, next) => {
    const id = Number(req.get('x-user'))
    if (req.get('x-fixture') === fixtureKey && ids.includes(id)) [req.user] = await db.select().from(s.users).where(eq(s.users.id, id))
    req.isAuthenticated = () => Boolean(req.user?.isActive); next()
  })
  app.use('/api/workflow', workflowRouter)
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/workflow`
  const request = (path: string, id?: number, method = 'GET') => fetch(base + path, { method, headers: { 'x-fixture': fixtureKey, 'x-user': String(id || '') } })
  try {
    const [owner, deputy, outsider, employee] = await db.insert(s.users).values(['owner', 'deputy', 'outsider', 'employee'].map((role, i) => ({ username: `${tag}-${role}`, email: `${tag}-${role}@example.test`, fullName: role, role: i === 3 ? 'team_member' : 'admin', isActive: true }))).returning()
    ids.push(owner.id, deputy.id, outsider.id, employee.id)
    await db.insert(s.workflowAssignments).values([{ userId: owner.id, role: 'owner', displayName: 'Owner' }, { userId: deputy.id, role: 'deputy', displayName: 'Deputy' }])
    assert.equal((await getWorkflowAccess(owner)).canApprovePurchase, true)
    assert.equal((await getWorkflowAccess(deputy)).canApproveLeave, true)
    assert.equal((await getWorkflowAccess(deputy)).canManageFeedback, false)
    assert.equal((await getWorkflowAccess(outsider)).canViewQueue, false)
    assert.equal((await getWorkflowAccess({ ...owner, originalUserId: outsider.id })).canApprovePurchase, false)
    await db.update(s.users).set({ isActive: false }).where(eq(s.users.id, owner.id))
    assert.equal((await getWorkflowAccess(owner)).canApprovePurchase, false, 'DB deactivation beats stale session')
    await db.update(s.users).set({ isActive: true }).where(eq(s.users.id, owner.id))
    const notice = { eventKey: `${tag}:created`, recipientIds: [employee.id, employee.id], title: 'Request updated', body: 'Private body', href: '/employee/vacations' }
    await assert.rejects(db.transaction(async tx => { await queueWorkflowNotification(tx, notice); throw new Error('Rollback') }))
    assert.equal((await db.select().from(s.workflowNotifications).where(eq(s.workflowNotifications.eventKey, notice.eventKey))).length, 0)
    await db.transaction(async tx => { await queueWorkflowNotification(tx, notice); await queueWorkflowNotification(tx, notice) })
    const [notification] = await db.select().from(s.workflowNotifications).where(eq(s.workflowNotifications.eventKey, notice.eventKey))
    assert.ok(notification)
    assert.equal((await request('/notifications')).status, 401)
    assert.equal((await request('/decisions', outsider.id)).status, 403)
    assert.equal((await request('/decisions', employee.id)).status, 403)
    assert.equal((await request('/decisions', deputy.id)).status, 200)
    assert.equal((await (await request('/notifications', employee.id)).json() as any).unreadCount, 1)
    assert.equal((await (await request('/notifications', outsider.id)).json() as any).items.length, 0)
    assert.equal((await request(`/notifications/${notification.id}/read`, outsider.id, 'PATCH')).status, 404)
    assert.equal((await request(`/notifications/${notification.id}/read`, employee.id, 'PATCH')).status, 200)
    assert.equal((await (await request('/notifications', employee.id)).json() as any).unreadCount, 0)

    const [member] = await db.insert(s.teamMembers).values({ name: `${tag} Member`, email: `${tag}-member@example.test`, position: 'Engineer', startDate: '2026-01-01' }).returning(); memberId = member.id
    const [type] = await db.select().from(s.leaveTypes).limit(1)
    const [leave] = await db.insert(s.leaveRequests).values({ employeeId: member.id, leaveTypeId: type.id, startDate: '2026-10-01', endDate: '2026-10-01', daysCount: '1', requestedBy: employee.id, createdAt: new Date('2026-09-04T09:00:00Z') }).returning(); leaveIds.push(leave.id)
    const monday = new Date('2026-09-07T09:01:00Z')
    await enqueueOverdueReminders(monday); await enqueueOverdueReminders(monday)
    const reminderKey = `overdue:leave:${leave.id}:2026-09-07T09:00:00.000Z`
    const reminders = await db.select().from(s.workflowNotifications).where(eq(s.workflowNotifications.eventKey, reminderKey))
    assert.deepEqual(reminders.map(row => row.userId).filter(id => ids.includes(id)).sort(), [owner.id, deputy.id].sort())
    assert.equal((await listWorkflowDecisions(deputy, monday)).items.find(item => item.id === `leave:${leave.id}`)?.overdue, true)
    await db.update(s.leaveRequests).set({ status: 'approved' }).where(eq(s.leaveRequests.id, leave.id))
    assert.equal((await listWorkflowDecisions(owner, monday)).items.some(item => item.id === `leave:${leave.id}`), false)
    await enqueueOverdueReminders(monday)
    const closedReminders = await db.select().from(s.workflowNotifications).where(and(eq(s.workflowNotifications.eventKey, reminderKey), inArray(s.workflowNotifications.userId, ids)))
    assert.ok(closedReminders.every(row => row.supersededAt), 'HUB reminders are cleared even with Slack disabled')

    // Isolate the worker batch in this disposable test DB while testing actual outbox storage.
    const future = new Date('2099-01-01T00:00:00Z')
    await db.update(s.workflowNotifications).set({ slackNextAttemptAt: future }).where(inArray(s.workflowNotifications.userId, ids))
    await db.update(s.workflowNotifications).set({ slackNextAttemptAt: new Date(0) }).where(eq(s.workflowNotifications.id, notification.id))
    process.env.SLACK_NOTIFICATIONS_ENABLED = 'true'; process.env.SLACK_BOT_TOKEN = 'fixture-token-never-sent'
    const sent: any[] = []; let fail = true
    const fakeFetch = (async (input: any, init: any) => {
      const target = String(input)
      if (fail) return new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), { status: 429, headers: { 'retry-after': '120' } })
      if (target.includes('users.lookupByEmail')) return new Response(JSON.stringify({ ok: true, user: { id: 'UFIXTURE' } }))
      sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true }))
    }) as typeof fetch
    await deliverWorkflowNotifications(fakeFetch)
    let [after] = await db.select().from(s.workflowNotifications).where(eq(s.workflowNotifications.id, notification.id))
    assert.equal(after.slackSentAt, null); assert.equal(after.slackAttempts, 1); assert.equal(after.slackLastError, 'ratelimited')
    assert.ok(after.slackNextAttemptAt.getTime() > Date.now() + 60_000)
    fail = false
    await db.update(s.workflowNotifications).set({ slackNextAttemptAt: new Date(0) }).where(eq(s.workflowNotifications.id, notification.id))
    await Promise.all([deliverWorkflowNotifications(fakeFetch), deliverWorkflowNotifications(fakeFetch)])
    ;[after] = await db.select().from(s.workflowNotifications).where(eq(s.workflowNotifications.id, notification.id))
    assert.ok(after.slackSentAt); assert.equal(after.slackLastError, null); assert.equal(sent.filter(message => message.text.startsWith('Request updated\n')).length, 1)
    const delivered = sent.find(message => message.text.startsWith('Request updated\n')); assert.equal(delivered.channel, 'UFIXTURE'); assert.ok(!delivered.text.includes('Private body'))
    await deliverWorkflowNotifications(fakeFetch); assert.equal(sent.filter(message => message.text.startsWith('Request updated\n')).length, 1)
    await db.update(s.workflowNotifications).set({ slackNextAttemptAt: new Date(0) }).where(eq(s.workflowNotifications.eventKey, reminderKey))
    await deliverWorkflowNotifications(fakeFetch)
    const suppressed = await db.select().from(s.workflowNotifications).where(and(eq(s.workflowNotifications.eventKey, reminderKey), inArray(s.workflowNotifications.userId, ids)))
    assert.ok(suppressed.every(row => row.supersededAt && !row.slackSentAt), 'Resolved decision reminders are not delivered as stale pending decisions')
    await request('/notifications/read-all', owner.id, 'POST')
    assert.equal((await (await request('/notifications', owner.id)).json() as any).unreadCount, 0)
  } finally {
    process.env.SLACK_BOT_TOKEN = previousSlack.token || ''; process.env.SLACK_NOTIFICATIONS_ENABLED = previousSlack.enabled || 'false'
    if (leaveIds.length) await db.delete(s.leaveRequests).where(inArray(s.leaveRequests.id, leaveIds))
    if (memberId) await db.delete(s.teamMembers).where(eq(s.teamMembers.id, memberId))
    if (ids.length) await db.delete(s.users).where(inArray(s.users.id, ids))
    await new Promise<void>(resolve => server.close(() => resolve())); await pool.end()
  }
})
