import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'

const url = process.env.TEST_DATABASE_URL
if (url && (!/^\/vestov_(fix|test|audit|fresh)/.test(new URL(url).pathname) || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))) throw new Error('Use an isolated local vestov test database')

test('real HTTP access, document ownership, private uploads and stable employee identity', { skip: !url }, async () => {
  process.env.DATABASE_URL = url!
  process.env.SLACK_BOT_TOKEN = ''
  process.env.SLACK_NOTIFICATIONS_ENABLED = 'false'
  process.env.UPLOADS_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'vestov-access-test-'))
  const { db, pool } = await import('../db/index.js')
  const { default: express } = await import('express')
  const { authRouter } = await import('./auth.js')
  const { adminRouter } = await import('./admin.js')
  const { default: usersRouter } = await import('./users.js')
  const { documentsRouter } = await import('./documents.js')
  const { uploadsRouter } = await import('./uploads.js')
  const tag = randomUUID().slice(0, 12)
  const userIds: number[] = [], clientIds: number[] = [], serviceIds: number[] = [], memberIds: number[] = []
  let typeId: number | undefined
  const app = express()
  const fixtureKey = randomUUID()
  app.use(express.json())
  // This fixture authentication exists only in this test file, on an ephemeral
  // localhost listener. Production middleware and route handlers remain unchanged.
  app.use(async (req: any, _res, next) => {
    if (req.get('x-fixture-key') === fixtureKey) {
      const id = Number(req.get('x-fixture-user'))
      if (userIds.includes(id)) [req.user] = await db.select().from(schema.users).where(eq(schema.users.id, id))
    }
    req.isAuthenticated = () => Boolean(req.user?.isActive)
    next()
  })
  app.use('/api', authRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/documents', documentsRouter)
  app.use('/api/uploads', uploadsRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`
  const request = (route: string, user?: number, options: RequestInit = {}) => fetch(base + route, {
    ...options, headers: { ...(user ? { 'x-fixture-key': fixtureKey, 'x-fixture-user': String(user) } : {}), ...options.headers },
  })
  try {
    const createUser = async (role: string, suffix: string, extra = {}) => {
      const [user] = await db.insert(schema.users).values({ username: `${tag}_${suffix}`, email: `${tag}_${suffix}@example.test`, fullName: `Access ${suffix}`, role, isActive: true, ...extra }).returning()
      userIds.push(user.id); return user
    }
    const admin = await createUser('admin', 'admin')
    const reader = await createUser('client', 'read'), writer = await createUser('client', 'write'), outsider = await createUser('client', 'outside')
    const [a, b] = await db.insert(schema.clients).values([{ name: `${tag} A` }, { name: `${tag} B` }]).returning()
    clientIds.push(a.id, b.id)
    await db.insert(schema.clientUsers).values([
      { clientId: a.id, userId: reader.id, accessLevel: 'read', assignedBy: admin.id },
      { clientId: a.id, userId: writer.id, accessLevel: 'write', assignedBy: admin.id },
      { clientId: b.id, userId: outsider.id, accessLevel: 'admin', assignedBy: admin.id },
    ])
    const listedResponse = await request('/users?limit=2&page=1&search=' + tag, admin.id)
    assert.equal(listedResponse.status, 200)
    const listed = await listedResponse.json() as any
    assert.equal(listed.users.length, 2)
    assert.equal(listed.pagination.total, 4)
    assert.equal(listed.pagination.pages, 2)
    const accountProfile = await (await request('/user', reader.id)).json() as any
    assert.ok(accountProfile.createdAt, 'Profile carries its creation date')
    const clientList = await (await request('/users?limit=50&role=client&search=' + tag, admin.id)).json() as any
    assert.equal(clientList.users.length, 3)
    assert.deepEqual(clientList.users.find((row: any) => row.id === reader.id).clientAssignments.map((row: any) => row.clientId), [a.id])
    assert.deepEqual(clientList.users.find((row: any) => row.id === outsider.id).clientAssignments.map((row: any) => row.clientId), [b.id])
    assert.equal((await request('/users', reader.id)).status, 403)
    const [type] = await db.insert(schema.serviceTypes).values({ name: `${tag} Service`, category: 'outstaffing', billingModel: 'monthly' }).returning(); typeId = type.id
    const services = await db.insert(schema.clientServices).values([
      { clientId: a.id, serviceTypeId: type.id, startDate: '2026-01-01', rate: '999.00', projectBotAuthorizedSlackUserIds: ['private-id'] },
      { clientId: b.id, serviceTypeId: type.id, startDate: '2026-01-01' },
    ]).returning(); serviceIds.push(...services.map(s => s.id))
    const [member, otherMember] = await db.insert(schema.teamMembers).values([
      { name: 'Stable ID', email: `${tag}_old@example.test`, position: 'QA', startDate: '2026-01-01', monthlyRate: '1000.00' },
      { name: 'Another person', email: `${tag}_new@example.test`, position: 'QA', startDate: '2026-01-01' },
    ]).returning(); memberIds.push(member.id, otherMember.id)
    const employee = await createUser('team_member', 'employee', { email: otherMember.email, teamMemberId: member.id })
    await db.insert(schema.clientServiceTeamMembers).values({ clientServiceId: services[0].id, teamMemberId: member.id, employmentType: 'fulltime', startDate: '2026-01-01' })
    await db.insert(schema.clientServiceTeamMembers).values({ clientServiceId: services[1].id, teamMemberId: member.id, employmentType: 'fulltime', startDate: '2026-01-01' })
    await db.update(schema.clientServices).set({ startDate: '2099-01-01' }).where(eq(schema.clientServices.id, services[1].id))
    const clientsForMember = async () => {
      const response = await request('/admin/team-members', admin.id)
      assert.equal(response.status, 200)
      return ((await response.json()) as any[]).find(row => row.id === member.id).clientIds
    }
    assert.deepEqual(await clientsForMember(), [a.id], 'Future projects are absent from current employee clientIds')
    await db.update(schema.clientServices).set({ startDate: '2000-01-01', endDate: '2001-01-01' }).where(eq(schema.clientServices.id, services[1].id))
    assert.deepEqual(await clientsForMember(), [a.id], 'Ended projects are absent from current employee clientIds')
    const [folder] = await db.insert(schema.documentFolders).values({ clientServiceId: services[0].id, name: 'Empty folder', createdBy: admin.id }).returning()
    const localDir = path.join(process.env.UPLOADS_DIR!, 'documents')
    await fs.mkdir(localDir)
    await fs.writeFile(path.join(localDir, `${tag}.txt`), 'private fixture document')
    const docs = await db.insert(schema.documents).values([
      { name: `${tag}.txt`, url: `/uploads/documents/${tag}.txt`, userId: admin.id, clientId: a.id, clientServiceId: services[0].id, visibleToClient: true },
      { name: 'hidden.txt', url: `/uploads/documents/${tag}.txt`, userId: admin.id, clientId: a.id, clientServiceId: services[0].id, visibleToClient: false },
    ]).returning()
    for (const route of ['/register', '/login']) {
      const response = await request(route, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: admin.email, password: 'claim-attempt', role: 'admin' }) })
      assert.equal(response.status, 410)
    }
    assert.equal((await request('/auth/clerk/sync', undefined, { method: 'POST' })).status, 401)
    assert.equal((await request(`/documents/download/${docs[0].id}`)).status, 401)
    assert.equal((await request(`/documents/download/${docs[0].id}`, reader.id)).status, 200)
    assert.equal((await request(`/documents/download/${docs[0].id}`, outsider.id)).status, 403)
    assert.equal((await request(`/documents/download/${docs[1].id}`, reader.id)).status, 403)
    assert.equal((await request(`/documents/download/${docs[1].id}`, employee.id)).status, 200)
    assert.equal((await request(`/uploads/documents/${tag}.txt`)).status, 401)
    assert.equal((await request(`/uploads/documents/${tag}.txt`, outsider.id)).status, 403)
    assert.equal(await (await request(`/uploads/documents/${tag}.txt`, reader.id)).text(), 'private fixture document')
    const folderResponse = await request(`/documents/service/${services[0].id}/client-visible`, writer.id)
    assert.equal(folderResponse.status, 200)
    const folderData = await folderResponse.json() as any
    assert(folderData.folders.some((f: any) => f.id === folder.id))
    assert(!('rate' in folderData.service)); assert(!('projectBotAuthorizedSlackUserIds' in folderData.service))
    assert.equal((await request(`/documents/service/${services[1].id}/client-visible`, reader.id)).status, 403)
    const upload = async (user: number, client = a.id, service = services[0].id) => {
      const form = new FormData(); form.set('clientId', String(client)); form.set('clientServiceId', String(service)); form.set('folderId', String(folder.id)); form.set('document', new Blob(['persisted'], { type: 'text/plain' }), 'uploaded.txt')
      return request('/documents/upload', user, { method: 'POST', body: form })
    }
    assert.equal((await upload(reader.id)).status, 403)
    assert.equal((await upload(writer.id, b.id, services[1].id)).status, 403)
    const uploaded = await upload(writer.id); assert.equal(uploaded.status, 200)
    const uploadData = await uploaded.json() as any
    assert.equal(await (await request(`/documents/download/${uploadData.id}`, reader.id)).text(), 'persisted')
    const json = (body: unknown) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal((await request(`/admin/team-members/${member.id}`, employee.id, json({ bio: 'saved with stable ID' }))).status, 200)
    assert.equal((await request(`/admin/team-members/${otherMember.id}`, employee.id, json({ bio: 'must not save' }))).status, 403)
    const profile = await request(`/admin/team-members/${member.id}`, admin.id, json({ monthlyRate: '1500.00' })); assert.equal(profile.status, 200, await profile.text())
    assert((await db.select().from(schema.salaryRateHistory).where(eq(schema.salaryRateHistory.teamMemberId, member.id))).length >= 2)
    assert.equal((await request('/admin/dashboard', admin.id)).status, 200)
    assert.equal((await request(`/admin/team-members/${member.id}`, admin.id, { method: 'DELETE' })).status, 409)
    assert.equal((await db.select().from(schema.teamMembers).where(eq(schema.teamMembers.id, member.id))).length, 1)
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    if (memberIds.length) {
      await db.delete(schema.financeActivityLogs).where(inArray(schema.financeActivityLogs.teamMemberId, memberIds))
      await db.delete(schema.salaryRateHistory).where(inArray(schema.salaryRateHistory.teamMemberId, memberIds))
    }
    if (clientIds.length) await db.delete(schema.documents).where(inArray(schema.documents.clientId, clientIds))
    if (serviceIds.length) {
      await db.delete(schema.documentFolders).where(inArray(schema.documentFolders.clientServiceId, serviceIds))
      await db.delete(schema.clientServiceTeamMembers).where(inArray(schema.clientServiceTeamMembers.clientServiceId, serviceIds))
      await db.delete(schema.clientServices).where(inArray(schema.clientServices.id, serviceIds))
    }
    if (clientIds.length) { await db.delete(schema.clientUsers).where(inArray(schema.clientUsers.clientId, clientIds)); await db.delete(schema.clients).where(inArray(schema.clients.id, clientIds)) }
    if (typeId) await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, typeId))
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    if (memberIds.length) await db.delete(schema.teamMembers).where(inArray(schema.teamMembers.id, memberIds))
    await pool.end(); await fs.rm(process.env.UPLOADS_DIR!, { recursive: true, force: true })
  }
})
