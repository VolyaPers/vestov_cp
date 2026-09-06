import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'

const url = process.env.TEST_DATABASE_URL
if (url && (!['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !/^\/vestov_test_/.test(new URL(url).pathname))) throw new Error('Feedback tests require an isolated local vestov_test_* database')

test('feedback API preserves author privacy, owner decisions, client consent, history and atomic notifications', { skip: !url }, async () => {
  process.env.DATABASE_URL = url!
  process.env.SLACK_BOT_TOKEN = ''
  process.env.SLACK_NOTIFICATIONS_ENABLED = 'false'
  process.env.PROJECT_BOT_ENABLED = 'false'
  const { db, pool } = await import('../db/index.js')
  const { default: express } = await import('express')
  const { createFeedbackRouter } = await import('./feedback.js')
  const { clientRouter } = await import('./client.js')
  const { createUsersRouter } = await import('./users.js')
  const workflow = await import('../services/workflow.js')
  const { workflowDueAt } = await import('../utils/workflowTime.js')
  const userIds: number[] = [], clientIds: number[] = []
  const tag = randomUUID().slice(0, 10), fixtureKey = randomUUID()
  const app = express()
  app.use(express.json())
  app.use(async (req: any, _res, next) => {
    const id = Number(req.get('x-fixture-user'))
    if (req.get('x-fixture-key') === fixtureKey && userIds.includes(id)) [req.user] = await db.select().from(schema.users).where(eq(schema.users.id, id))
    const original = Number(req.get('x-fixture-original'))
    if (req.user && userIds.includes(original)) req.user.originalUserId = original
    req.isAuthenticated = () => Boolean(req.user?.isActive)
    next()
  })
  app.use('/feedback', createFeedbackRouter())
  app.use('/client', clientRouter)
  app.use('/users', createUsersRouter())
  app.use('/failing', createFeedbackRouter({ ...workflow, queueWorkflowNotification: async () => { throw new Error('Simulated outbox failure') } }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  const request = async (path: string, user?: number, method = 'GET', body?: unknown, original?: number) => {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-key': fixtureKey, ...(user ? { 'x-fixture-user': String(user) } : {}), ...(original ? { 'x-fixture-original': String(original) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  try {
    const user = async (role: string, name: string) => {
      const [created] = await db.insert(schema.users).values({ username: `${tag}_${name}`, email: `${tag}_${name}@example.test`, fullName: name, role, isActive: true }).returning()
      userIds.push(created.id); return created
    }
    const owner = await user('admin', 'owner'), deputy = await user('admin', 'deputy'), otherAdmin = await user('admin', 'otherAdmin')
    const author = await user('client', 'author'), colleague = await user('client', 'colleague'), outsider = await user('client', 'outsider')
    process.env.WORKFLOW_OWNER_USER_IDS = String(owner.id)
    process.env.WORKFLOW_DEPUTY_USER_IDS = String(deputy.id)
    const [client, otherClient] = await db.insert(schema.clients).values([{ name: `${tag} client` }, { name: `${tag} other` }]).returning()
    clientIds.push(client.id, otherClient.id)
    await db.insert(schema.clientUsers).values([
      { clientId: client.id, userId: author.id, accessLevel: 'read', assignedBy: owner.id },
      { clientId: client.id, userId: colleague.id, accessLevel: 'admin', assignedBy: owner.id },
      { clientId: otherClient.id, userId: outsider.id, accessLevel: 'read', assignedBy: owner.id },
    ])
    assert.equal((await request('/feedback/admin')).status, 401)
    assert.equal((await request('/feedback/admin', otherAdmin.id)).status, 403)
    assert.equal((await request('/feedback/admin', deputy.id)).body.canManageFeedback, false)
    const created = await request('/feedback', author.id, 'POST', { clientId: client.id, rating: 2, comments: 'Private delivery issue' })
    assert.equal(created.status, 200)
    const id = created.body.id, thread = `/feedback/${id}`
    assert.equal(new Date(created.body.firstResponseDueAt).getTime(), workflowDueAt(new Date(created.body.createdAt)).getTime())
    assert.equal((await request(`/feedback/client?clientId=${client.id}`, colleague.id)).body.feedbacks.length, 0)
    assert.equal((await request(`${thread}/thread`, colleague.id)).status, 404)
    assert.equal((await request(`${thread}/thread`, outsider.id)).status, 404)
    assert.equal((await request(`${thread}/thread`, otherAdmin.id)).status, 403)
    assert.equal((await request(`${thread}/respond`, deputy.id, 'POST', { adminResponse: 'Not authorized' })).status, 403)
    assert.equal((await request(`${thread}/reply`, colleague.id, 'POST', { body: 'Not my thread' })).status, 404)
    assert.equal((await request(`${thread}/confirm`, author.id, 'POST', {})).status, 409)
    const notices = await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.eventKey, `feedback:${id}:created`))
    assert.deepEqual(notices.map(notice => notice.userId), [owner.id])

    const reply = await request(`${thread}/respond`, owner.id, 'POST', { adminResponse: 'We are investigating.' })
    assert.equal(reply.status, 200); assert.equal(reply.body.status, 'in_progress')
    const firstRespondedAt = reply.body.firstRespondedAt
    const replyThread = (await request(`${thread}/thread`, author.id)).body
    const savedReply = replyThread.messages.find((message: any) => message.id === reply.body.message.id)
    assert.equal(savedReply.createdAt, firstRespondedAt, 'Raw SQL history must preserve the same UTC instant as Drizzle timestamps, including non-UTC server timezones')
    assert.ok(Math.abs(Date.now() - new Date(savedReply.createdAt).getTime()) < 60_000, 'New replies must appear at the current instant, not offset by the server timezone')
    const responseNotice = await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.eventKey, `feedback:${id}:message:${reply.body.message.id}`))
    assert.deepEqual(responseNotice.map(notice => notice.userId), [author.id])
    assert.equal(responseNotice[0].body.includes('investigating'), false, 'Slack notice must not include private message content')
    assert.equal((await request(`${thread}/respond`, owner.id, 'POST', { adminResponse: 'Fixed and checked.', requestConfirmation: true })).body.status, 'awaiting_client')
    assert.equal((await request(`${thread}/confirm`, owner.id, 'POST', {})).status, 403)
    assert.equal((await request(`${thread}/confirm`, colleague.id, 'POST', {})).status, 404)
    assert.equal((await request(`${thread}/confirm`, author.id, 'POST', {}, owner.id)).status, 403, 'Admin preview is not client consent')
    assert.equal((await request(`${thread}/thread`, author.id, 'GET', undefined, otherAdmin.id)).status, 403)
    assert.equal((await request(`${thread}/thread`, author.id, 'GET', undefined, owner.id)).status, 200)
    assert.equal((await request(`/feedback/client?clientId=${client.id}`, author.id, 'GET', undefined, owner.id)).body.canReply, false)
    assert.equal((await request(`/client/dashboard?clientId=${client.id}`, author.id, 'GET', undefined, otherAdmin.id)).status, 403)
    const dashboardPreview = await request(`/client/dashboard?clientId=${client.id}`, author.id, 'GET', undefined, owner.id)
    assert.equal(dashboardPreview.status, 200)
    assert.equal(dashboardPreview.body.recentFeedback[0].adminResponse, 'Fixed and checked.')
    const confirmed = await request(`${thread}/confirm`, author.id, 'POST', {})
    assert.equal(confirmed.body.status, 'resolved'); assert.ok(confirmed.body.resolvedAt)
    assert.equal((await request(`${thread}/respond`, owner.id, 'POST', { adminResponse: 'Change after closure' })).status, 409)
    assert.equal((await request(`${thread}/reopen`, author.id, 'POST', { body: 'The issue returned.' })).body.status, 'in_progress')
    const reopened = await request(`${thread}/thread`, author.id)
    assert.equal(reopened.body.firstRespondedAt, firstRespondedAt); assert.equal(reopened.body.resolvedAt, null)
    assert.deepEqual(reopened.body.messages.map((message: any) => message.kind), ['reply', 'resolution_requested', 'confirmed', 'reopened'])
    assert.equal((await request(thread, owner.id, 'DELETE')).status, 405)

    const beforeFailure = await db.select().from(schema.feedbackMessages).where(eq(schema.feedbackMessages.feedbackId, id))
    const failed = await request(`/failing/${id}/respond`, owner.id, 'POST', { adminResponse: 'Should roll back', requestConfirmation: true })
    assert.equal(failed.status, 500)
    assert.equal((await db.select().from(schema.feedbackMessages).where(eq(schema.feedbackMessages.feedbackId, id))).length, beforeFailure.length)
    assert.equal((await request(`${thread}/thread`, author.id)).body.status, 'in_progress')

    const [legacy] = await db.insert(schema.feedback).values({ userId: author.id, clientId: client.id, rating: 3, comments: 'Historical feedback', status: 'reviewed', adminResponse: 'Original response is retained', adminRespondedBy: owner.id, adminRespondedAt: new Date('2026-09-01T10:00:00Z') }).returning()
    assert.equal((await request(`/feedback/${legacy.id}/thread`, author.id)).body.status, 'awaiting_client')
    await request(`/feedback/${legacy.id}/respond`, owner.id, 'POST', { adminResponse: 'Follow-up response' })
    assert.equal((await db.select().from(schema.feedback).where(eq(schema.feedback.id, legacy.id)))[0].adminResponse, 'Original response is retained')
    const legacyThread = (await request(`/feedback/${legacy.id}/thread`, author.id)).body
    assert.equal(legacyThread.messages[0].historical, true); assert.equal(legacyThread.messages[0].body, 'Original response is retained')
    assert.equal(legacyThread.messages[1].body, 'Follow-up response')

    await db.insert(schema.feedbackMessages).values(Array.from({ length: 205 }, (_, index) => ({ feedbackId: legacy.id, authorId: author.id, body: `History message ${index}` })))
    const list = (await request(`/feedback/client?clientId=${client.id}`, author.id)).body
    const preview = list.feedbacks.find((item: any) => item.id === legacy.id)
    assert.equal(preview.messages.length, 3); assert.ok(preview.nextMessageCursor)
    const historyIds = new Set<number>()
    let messageCursor: number | null = null
    do {
      const page = (await request(`/feedback/${legacy.id}/thread${messageCursor ? `?beforeMessage=${messageCursor}` : ''}`, author.id)).body
      for (const message of page.messages) if (typeof message.id === 'number') historyIds.add(message.id)
      assert.ok(page.messages.filter((message: any) => typeof message.id === 'number').length <= 100)
      messageCursor = page.nextMessageCursor
    } while (messageCursor)
    assert.equal(historyIds.size, 206, 'Cursor must preserve every reply without duplication or loss')
    await db.insert(schema.feedback).values(Array.from({ length: 51 }, (_, index) => ({ userId: author.id, clientId: client.id, rating: 4, comments: `Page ${index}` })))
    const pageOne = (await request(`/feedback/client?clientId=${client.id}`, author.id)).body
    assert.equal(pageOne.feedbacks.length, 50); assert.ok(pageOne.nextCursor)
    const pageTwo = (await request(`/feedback/client?clientId=${client.id}&before=${pageOne.nextCursor}`, author.id)).body
    assert.equal(new Set([...pageOne.feedbacks, ...pageTwo.feedbacks].map((item: any) => item.id)).size, 53)
    const dashboardPage = (await request(`/client/dashboard?clientId=${client.id}`, author.id)).body
    assert.equal(dashboardPage.recentFeedback.length, 5)
    assert.equal(dashboardPage.stats.pendingFeedback, 51)
    assert.equal((await request(`${thread}/thread`, author.id)).status, 200, 'Old queue links stay addressable outside the first page')
    await db.insert(schema.feedbackMessages).values({ feedbackId: id, authorId: otherAdmin.id, body: 'Historical response by a former handler' })
    assert.equal((await request(`/users/${otherAdmin.id}/hard`, owner.id, 'DELETE')).status, 409, 'Hard deletion must retain a feedback author with history')
    await db.delete(schema.clientUsers).where(eq(schema.clientUsers.userId, author.id))
    assert.equal((await request(`${thread}/thread`, author.id)).status, 404, 'Removed client access also removes private thread access')
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    if (userIds.length) await db.delete(schema.feedback).where(inArray(schema.feedback.userId, userIds))
    if (clientIds.length) await db.delete(schema.clientUsers).where(inArray(schema.clientUsers.clientId, clientIds))
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    if (clientIds.length) await db.delete(schema.clients).where(inArray(schema.clients.id, clientIds))
    await pool.end()
  }
})
