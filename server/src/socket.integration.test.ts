import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import * as schema from './db/schema.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (databaseUrl && (!/^\/vestov_(fix|test|audit|fresh)/.test(new URL(databaseUrl).pathname) || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))) throw new Error('Socket tests require an isolated local vestov database')

test('live sockets authenticate sessions and recheck project, membership, identity and revocation', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  process.env.DATABASE_URL = databaseUrl!
  const { db, pool } = await import('./db/index.js')
  const { default: express } = await import('express')
  const { default: session } = await import('express-session')
  const { default: passport } = await import('passport')
  const { setupPassport } = await import('./auth/passport.js')
  const { initializeSocket, emitBreakStarted, revokeUserSockets, revokeSessionSockets } = await import('./socket.js')
  const { io: createSocket } = await import('socket.io-client')
  const tag = randomUUID().slice(0, 10), fixtureKey = randomUUID()
  const userIds: number[] = [], clientIds: number[] = [], memberIds: number[] = [], serviceIds: number[] = []
  let serviceTypeId: number | undefined
  const connections: { socket: ReturnType<typeof createSocket>; events: unknown[] }[] = []
  const store = new session.MemoryStore()
  const sessionMiddleware = session({ secret: randomUUID(), store, resave: false, saveUninitialized: false })
  setupPassport(pool)
  const app = express()
  app.use(express.json(), sessionMiddleware, passport.initialize(), passport.session())
  // Fixture-only local sign-in: production Passport serialization, session reload,
  // Socket.IO middleware and SQL permissions run unchanged; no Clerk call is made.
  app.post('/fixture-session', async (req, res, next) => {
    if (req.get('x-fixture-key') !== fixtureKey || !userIds.includes(req.body.userId)) return res.sendStatus(403)
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.body.userId))
    req.login({ ...user, ...(userIds.includes(req.body.originalUserId) ? { originalUserId: req.body.originalUserId } : {}) }, error => {
      if (error) return next(error)
      res.json({ sessionId: req.sessionID })
    })
  })
  const server = app.listen(0, '127.0.0.1')
  const io = initializeSocket(server, false, sessionMiddleware)
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  const once = (socket: ReturnType<typeof createSocket>, event: string) => new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, done); reject(new Error(`Timed out waiting for ${event}`)) }, 5_000)
    const done = (value: unknown) => { clearTimeout(timer); resolve(value) }
    socket.once(event, done)
  })
  const login = async (userId: number, originalUserId?: number) => {
    const response = await fetch(`${base}/fixture-session`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-key': fixtureKey }, body: JSON.stringify({ userId, originalUserId }) })
    assert.equal(response.status, 200)
    return { ...(await response.json() as { sessionId: string }), cookie: response.headers.get('set-cookie')!.split(';')[0] }
  }
  const connect = async (cookie?: string, rejected = false) => {
    const socket = createSocket(base, { path: '/api/socket.io', transports: ['polling'], autoConnect: false, reconnection: false, ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}) })
    const connection = { socket, events: [] as unknown[] }; connections.push(connection)
    socket.on('break:started', event => connection.events.push(event))
    const ready = once(socket, rejected ? 'connect_error' : 'connect')
    socket.connect()
    const result = await ready
    if (rejected) { assert.match(result.message, /Authentication required/); socket.disconnect() }
    return connection
  }
  const flush = () => Promise.all(connections.filter(c => c.socket.connected).map(async ({ socket }) => {
    const serverSocket = io.sockets.sockets.get(socket.id!)
    if (!serverSocket) return // The disconnect packet may still be in transit.
    const done = once(socket, 'fixture:barrier')
    serverSocket.emit('fixture:barrier')
    await done
  }))
  const readSession = (id: string) => new Promise<any>((resolve, reject) => store.get(id, (error, data) => error ? reject(error) : resolve(data)))
  const writeSession = (id: string, data: any) => new Promise<void>((resolve, reject) => store.set(id, data, error => error ? reject(error) : resolve()))
  try {
    const createUser = async (role: string, suffix: string) => {
      const [user] = await db.insert(schema.users).values({ username: `${tag}_${suffix}`, email: `${tag}_${suffix}@example.test`, fullName: `Socket ${suffix}`, role, isActive: true, authProvider: 'clerk' }).returning()
      userIds.push(user.id); return user
    }
    const admin = await createUser('admin', 'admin'), original = await createUser('admin', 'original')
    const clientA = await createUser('client', 'a'), clientB = await createUser('client', 'b'), employee = await createUser('team_member', 'employee')
    const [a, b] = await db.insert(schema.clients).values([{ name: `${tag} A` }, { name: `${tag} B` }]).returning(); clientIds.push(a.id, b.id)
    const [membership] = await db.insert(schema.clientUsers).values([{ userId: clientA.id, clientId: a.id, accessLevel: 'read', assignedBy: admin.id }, { userId: clientB.id, clientId: b.id, accessLevel: 'read', assignedBy: admin.id }]).returning()
    const [type] = await db.insert(schema.serviceTypes).values({ name: `${tag} service`, category: 'outstaffing', billingModel: 'hourly' }).returning(); serviceTypeId = type.id
    const [active, future] = await db.insert(schema.clientServices).values([{ clientId: a.id, serviceTypeId: type.id, startDate: '2020-01-01' }, { clientId: b.id, serviceTypeId: type.id, startDate: '2099-01-01' }]).returning(); serviceIds.push(active.id, future.id)
    const [member] = await db.insert(schema.teamMembers).values({ name: 'Socket employee', email: `${tag}_member@example.test`, position: 'QA', startDate: '2020-01-01', timezone: 'UTC', status: 'active' }).returning(); memberIds.push(member.id)
    await db.update(schema.users).set({ teamMemberId: member.id }).where(eq(schema.users.id, employee.id))
    const [assignment] = await db.insert(schema.clientServiceTeamMembers).values([active, future].map(project => ({ clientServiceId: project.id, teamMemberId: member.id, employmentType: 'fulltime', startDate: '2020-01-01' }))).returning()
    await connect(undefined, true)
    const adminConnection = await connect((await login(admin.id)).cookie)
    const clientASession = await login(clientA.id), clientBSession = await login(clientB.id)
    const aConnection = await connect(clientASession.cookie), bConnection = await connect(clientBSession.cookie)
    const employeeConnection = await connect((await login(employee.id)).cookie)
    aConnection.socket.emit('join', 'admin'); aConnection.socket.emit('join-room', 'admin')
    const event = { breakId: 123, shiftId: 456, employeeId: member.id, employeeName: 'Private name', employeeEmail: 'private@example.test', breakType: 'personal', breakNote: 'Private break reason', timestamp: new Date().toISOString() }
    const publish = async () => { await emitBreakStarted(event); await flush() }
    await publish()
    assert.deepEqual(adminConnection.events, [event])
    assert.deepEqual(aConnection.events, [{ timestamp: event.timestamp }])
    assert.deepEqual(employeeConnection.events, [{ employeeId: member.id, timestamp: event.timestamp }])
    assert.deepEqual(bConnection.events, [], 'Future project must not grant notifications')
    assert.equal(io.sockets.sockets.get(aConnection.socket.id!)!.rooms.has('admin'), false)

    await db.update(schema.clientServices).set({ endDate: '2001-01-01' }).where(eq(schema.clientServices.id, active.id))
    await publish(); assert.equal(aConnection.events.length, 1, 'An ended project cannot keep client notifications')
    await db.update(schema.clientServices).set({ endDate: null }).where(eq(schema.clientServices.id, active.id))
    await db.update(schema.clientServiceTeamMembers).set({ isActive: false }).where(eq(schema.clientServiceTeamMembers.id, assignment.id))
    await publish(); assert.equal(aConnection.events.length, 1, 'Revoking the assignment applies to existing sockets')
    await db.update(schema.clientServiceTeamMembers).set({ isActive: true }).where(eq(schema.clientServiceTeamMembers.id, assignment.id))
    await db.update(schema.clientUsers).set({ isActive: false }).where(eq(schema.clientUsers.id, membership.id))
    await publish(); assert.equal(aConnection.events.length, 1, 'Revoking membership applies to existing sockets')
    await db.update(schema.clientUsers).set({ isActive: true }).where(eq(schema.clientUsers.id, membership.id))
    await publish(); assert.equal(aConnection.events.length, 2)

    const replacedSession = await login(clientA.id), replaced = await connect(replacedSession.cookie)
    const sessionData = await readSession(replacedSession.sessionId)
    sessionData.passport.user.id = clientB.id
    await writeSession(replacedSession.sessionId, sessionData)
    const replacedDisconnected = once(replaced.socket, 'disconnect')
    await publish(); await replacedDisconnected
    assert.equal(replaced.events.length, 0)

    const revokeOneSession = await login(clientA.id), revokeOne = await connect(revokeOneSession.cookie)
    const revokeOneDisconnected = once(revokeOne.socket, 'disconnect')
    revokeSessionSockets(revokeOneSession.sessionId); await revokeOneDisconnected
    assert.equal(aConnection.socket.connected, true, 'Session revocation leaves a different session alone')
    const aSecond = await connect((await login(clientA.id)).cookie)
    const userDisconnected = Promise.all([once(aConnection.socket, 'disconnect'), once(aSecond.socket, 'disconnect')])
    revokeUserSockets(clientA.id); await userDisconnected
    assert.equal(bConnection.socket.connected, true)

    await new Promise<void>((resolve, reject) => store.destroy(clientBSession.sessionId, error => error ? reject(error) : resolve()))
    const destroyedDisconnected = once(bConnection.socket, 'disconnect')
    await publish(); await destroyedDisconnected
    assert.equal(bConnection.events.length, 0)

    const impersonated = await connect((await login(employee.id, original.id)).cookie)
    await db.update(schema.users).set({ role: 'client' }).where(eq(schema.users.id, original.id))
    const impersonatedDisconnected = once(impersonated.socket, 'disconnect')
    await publish(); await impersonatedDisconnected
    assert.equal(impersonated.events.length, 0)
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, employee.id))
    const employeeDisconnected = once(employeeConnection.socket, 'disconnect')
    await publish(); await employeeDisconnected

    const legacySession = await login(clientA.id), legacyData = await readSession(legacySession.sessionId)
    legacyData.passport.user.version = 1
    await writeSession(legacySession.sessionId, legacyData)
    await connect(legacySession.cookie, true)
    await db.update(schema.users).set({ role: 'client' }).where(eq(schema.users.id, admin.id))
    const adminEventsBefore = adminConnection.events.length
    await publish(); assert.equal(adminConnection.events.length, adminEventsBefore, 'An open socket cannot retain a downgraded admin role')
  } finally {
    connections.forEach(connection => connection.socket.disconnect())
    await new Promise<void>(resolve => io.close(() => resolve()))
    if (server.listening) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
    store.clear()
    if (clientIds.length) await db.delete(schema.clientUsers).where(inArray(schema.clientUsers.clientId, clientIds))
    if (serviceIds.length) { await db.delete(schema.clientServiceTeamMembers).where(inArray(schema.clientServiceTeamMembers.clientServiceId, serviceIds)); await db.delete(schema.clientServices).where(inArray(schema.clientServices.id, serviceIds)) }
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    if (memberIds.length) await db.delete(schema.teamMembers).where(inArray(schema.teamMembers.id, memberIds))
    if (clientIds.length) await db.delete(schema.clients).where(inArray(schema.clients.id, clientIds))
    if (serviceTypeId) await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, serviceTypeId))
    await pool.end()
  }
})
