import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (databaseUrl && (!/^\/vestov_(fix|test|audit|fresh)/.test(new URL(databaseUrl).pathname) || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))) throw new Error('Client integration tests require an isolated local vestov test database')

test('client and Users real routers preserve tenant/date scope, feedback and identity history', { skip: !databaseUrl }, async () => {
  process.env.DATABASE_URL = databaseUrl!
  process.env.SLACK_BOT_TOKEN = ''
  process.env.SLACK_NOTIFICATIONS_ENABLED = 'false'
  const { db, pool } = await import('../db/index.js')
  const { default: express } = await import('express')
  const { clientRouter } = await import('./client.js')
  const { servicesRouter } = await import('./services.js')
  const { feedbackRouter } = await import('./feedback.js')
  const { clientContactsRouter } = await import('./client-contacts.js')
  const { clientCalendarRouter } = await import('./client-calendar.js')
  const { default: shiftsRouter } = await import('./shifts.js')
  const { createUsersRouter } = await import('./users.js')
  const { accessibleClientIds, canAccessService, canReadDocument } = await import('../services/access.js')
  const tag = randomUUID().slice(0, 10)
  const userIds: number[] = [], clientIds: number[] = [], memberIds: number[] = [], serviceIds: number[] = []
  let serviceTypeId: number | undefined, leaveTypeId: number | undefined
  let inviteCalls = 0
  const app = express(), fixtureKey = randomUUID()
  app.use(express.json())
  // Ephemeral test-only identity adapter. The production routers/ACL and DB are real.
  app.use(async (req: any, _res, next) => {
    const id = Number(req.get('x-fixture-user'))
    if (req.get('x-fixture-key') === fixtureKey && userIds.includes(id)) [req.user] = await db.select().from(schema.users).where(eq(schema.users.id, id))
    req.isAuthenticated = () => Boolean(req.user?.isActive)
    next()
  })
  app.use('/client', clientRouter); app.use('/services', servicesRouter); app.use('/feedback', feedbackRouter); app.use('/contacts', clientContactsRouter); app.use('/vacation', clientCalendarRouter)
  app.use('/shifts', shiftsRouter)
  app.use('/users', createUsersRouter({ invitations: {
    getInvitationList: async () => ({ data: [] }),
    createInvitation: async input => { assert.equal(input.notify, false); inviteCalls++; return { id: 'fixture_invitation', url: 'https://example.invalid/fixture-invite' } },
  } }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  const request = async (path: string, user?: number, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-fixture-key': fixtureKey, 'x-fixture-user': String(user) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  try {
    const createUser = async (role: string, suffix: string) => {
      const [user] = await db.insert(schema.users).values({ username: `${tag}_${suffix}`, email: `${tag}_${suffix}@example.test`, fullName: `Fixture ${suffix}`, role, isActive: true, authProvider: 'clerk' }).returning()
      userIds.push(user.id); return user
    }
    const admin = await createUser('admin', 'admin'), clientA = await createUser('client', 'a'), multi = await createUser('client', 'multi'), employee = await createUser('team_member', 'employee')
    const [a, b] = await db.insert(schema.clients).values([{ name: `${tag} A` }, { name: `${tag} B` }]).returning(); clientIds.push(a.id, b.id)
    await db.insert(schema.clientUsers).values([{ userId: clientA.id, clientId: a.id, accessLevel: 'read', assignedBy: admin.id }, { userId: multi.id, clientId: a.id, accessLevel: 'write', assignedBy: admin.id }, { userId: multi.id, clientId: b.id, accessLevel: 'read', assignedBy: admin.id }])
    const [type] = await db.insert(schema.serviceTypes).values({ name: `${tag} service`, category: 'outstaffing', billingModel: 'hourly' }).returning(); serviceTypeId = type.id
    const [projectA, projectB] = await db.insert(schema.clientServices).values([{ clientId: a.id, serviceTypeId: type.id, serviceTitle: 'Project A', startDate: '2020-01-01', rate: '999', projectBotAuthorizedSlackUserIds: ['private'] }, { clientId: b.id, serviceTypeId: type.id, serviceTitle: 'Project B', startDate: '2020-01-01' }]).returning(); serviceIds.push(projectA.id, projectB.id)
    const [member, limited] = await db.insert(schema.teamMembers).values([{ name: 'Fixture main', email: `${tag}_member@example.test`, position: 'QA', startDate: '2020-01-01', timezone: 'UTC', status: 'active' }, { name: 'Fixture limited', email: `${tag}_limited@example.test`, position: 'QA', startDate: '2020-01-01', timezone: 'UTC', status: 'active' }]).returning(); memberIds.push(member.id, limited.id)
    await db.update(schema.users).set({ teamMemberId: member.id }).where(eq(schema.users.id, employee.id))
    const [assignment] = await db.insert(schema.clientServiceTeamMembers).values([{ clientServiceId: projectA.id, teamMemberId: member.id, employmentType: 'fulltime', startDate: '2020-01-01', hourlyRate: '99' }, { clientServiceId: projectA.id, teamMemberId: limited.id, employmentType: 'part_time', startDate: '2026-09-10', endDate: '2026-09-20' }]).returning()
    const staleProjects = await db.insert(schema.clientServices).values([
      { clientId: a.id, serviceTypeId: type.id, serviceTitle: 'Ended project', startDate: '2000-01-01', endDate: '2001-01-01' },
      { clientId: a.id, serviceTypeId: type.id, serviceTitle: 'Disabled project', startDate: '2020-01-01', isActive: false },
      { clientId: b.id, serviceTypeId: type.id, serviceTitle: 'Future project', startDate: '2099-01-01' },
    ]).returning(); serviceIds.push(...staleProjects.map(project => project.id))
    await db.insert(schema.clientServiceTeamMembers).values(staleProjects.map(project => ({ clientServiceId: project.id, teamMemberId: member.id, employmentType: 'fulltime', startDate: '2020-01-01', isActive: true })))
    await db.insert(schema.shiftSchedules).values([1, 2, 3, 4, 5].map(dayOfWeek => ({ employeeId: member.id, dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true })))
    await db.insert(schema.shiftScheduleOverrides).values({ employeeId: member.id, overrideDate: '2026-09-07', startTime: '09:00', endTime: '17:00', isDayOff: true })
    await db.insert(schema.shiftScheduleOverrides).values(['2026-09-09', '2026-09-19'].map(overrideDate => ({ employeeId: limited.id, overrideDate, startTime: '09:00', endTime: '17:00', isDayOff: true })))
    const [leaveType] = await db.insert(schema.leaveTypes).values({ name: `${tag} Sick Leave` }).returning(); leaveTypeId = leaveType.id
    await db.insert(schema.leaveRequests).values([
      { employeeId: member.id, leaveTypeId: leaveType.id, startDate: '2026-09-08', endDate: '2026-09-08', halfDayEnd: true, daysCount: '0.5', status: 'approved', reason: 'private medical reason', requestedBy: admin.id },
      { employeeId: limited.id, leaveTypeId: leaveType.id, startDate: '2026-09-08', endDate: '2026-09-23', halfDayStart: true, halfDayEnd: true, daysCount: '15', status: 'approved', requestedBy: admin.id },
    ])
    await db.insert(schema.clientContacts).values({ clientId: a.id, fullName: 'Fixture contact', email: `${tag}_contact@example.test`, notes: 'private internal note' })

    assert.equal((await request('/users')).status, 401)
    assert.equal((await request('/users', clientA.id)).status, 403)
    assert.equal((await request(`/services/clients/${b.id}`, clientA.id)).status, 403)
    assert.equal((await request(`/services/clients/${a.id}`, employee.id)).status, 403)
    const accessEmployee = { ...employee, teamMemberId: member.id }
    assert.deepEqual(await accessibleClientIds(accessEmployee), [a.id])
    assert.equal(await canAccessService(accessEmployee, projectA.id), true)
    for (const stale of staleProjects) {
      assert.equal(await canAccessService(accessEmployee, stale.id), false, `${stale.serviceTitle} is outside employee access`)
      assert.equal(await canReadDocument(accessEmployee, { clientId: stale.clientId, clientServiceId: stale.id, visibleToClient: true }), false)
    }
    const project = await request(`/services/clients/${a.id}`, clientA.id)
    assert.equal(project.status, 200); assert.equal('rate' in project.body.services[0], false); assert.equal('projectBotAuthorizedSlackUserIds' in project.body.services[0], false)
    const assignments = await request(`/services/service-developer-assignments?clientId=${a.id}`, clientA.id)
    assert.equal(assignments.status, 200); assert.equal(assignments.body[projectA.id][0].employeeId > 0, true); assert.equal('hourlyRate' in assignments.body[projectA.id][0], false)
    assert.equal((await request(`/services/clients/${a.id}/services/${projectA.id}/developers/${assignment.id}`, clientA.id, 'PATCH', { hourlyRate: 1 })).status, 403)
    assert.equal((await request(`/services/clients/${b.id}/services/${projectA.id}/developers/${assignment.id}`, admin.id, 'PATCH', { hourlyRate: 1 })).status, 404)
    const [unchanged] = await db.select().from(schema.clientServiceTeamMembers).where(eq(schema.clientServiceTeamMembers.id, assignment.id)); assert.equal(unchanged.hourlyRate, '99.00')
    const contact = await request(`/contacts/client/${a.id}`, clientA.id); assert.equal(contact.status, 200); assert.equal('notes' in contact.body[0], false)
    assert.equal((await request(`/contacts/client/${b.id}`, clientA.id)).status, 403)
    assert.equal((await request(`/contacts/client/${a.id}e0`, clientA.id)).status, 400)
    await db.insert(schema.feedback).values({ userId: multi.id, clientId: b.id, clientServiceId: projectB.id, rating: 4, comments: 'Company B feedback', status: 'pending' })
    const dashboard = await request(`/client/dashboard?clientId=${a.id}`, multi.id); assert.equal(dashboard.status, 200); assert.equal(dashboard.body.client.id, a.id)
    assert.equal(dashboard.body.viewer.fullName, multi.fullName)
    assert.equal(dashboard.body.stats.pendingFeedback, 0)
    const dashboardB = await request(`/client/dashboard?clientId=${b.id}`, multi.id)
    assert.equal(dashboardB.body.client.id, b.id); assert.equal(dashboardB.body.stats.pendingFeedback, 1)
    assert.equal((await request('/client/dashboard', multi.id)).status, 400)
    const calendar = await request(`/vacation/client/calendar?clientId=${a.id}&month=2026-09`, clientA.id)
    assert.equal(calendar.status, 200)
    const days = calendar.body.days
    assert.equal(days.find((day: any) => day.employeeId === member.id && day.date === '2026-09-07').isDayOff, true)
    assert.equal(days.find((day: any) => day.employeeId === member.id && day.date === '2026-09-07').isScheduleConfigured, true)
    assert.equal(days.find((day: any) => day.employeeId === limited.id && day.date === '2026-09-10').isScheduleConfigured, false)
    assert.equal(days.find((day: any) => day.employeeId === member.id && day.date === '2026-09-08').workingMinutes, 240)
    assert.equal(days.find((day: any) => day.employeeId === member.id && day.date === '2026-09-08').leaveType, leaveType.name)
    assert.equal(days.some((day: any) => day.employeeId === limited.id && day.date === '2026-09-09'), false)
    assert.equal(days.some((day: any) => day.employeeId === limited.id && day.date === '2026-09-20'), true)
    assert.equal(days.some((day: any) => day.employeeId === limited.id && day.date === '2026-09-21'), false)
    const scopedLeave = calendar.body.vacations.find((leave: any) => leave.employeeId === limited.id)
    assert.equal(scopedLeave.startDate, '2026-09-10'); assert.equal(scopedLeave.endDate, '2026-09-20')
    assert.equal(scopedLeave.halfDayStart, false); assert.equal(scopedLeave.halfDayEnd, false)
    assert.equal(JSON.stringify(calendar.body).includes('private medical reason'), false)
    assert.equal((await request(`/vacation/client/calendar?clientId=${b.id}&month=2026-09`, clientA.id)).status, 403)
    const legacyOverrides = await request(`/shifts/overrides/all?clientId=${a.id}&month=2026-09`, clientA.id)
    assert.equal(legacyOverrides.status, 200)
    const limitedOverrides = legacyOverrides.body.overrides.filter((row: any) => row.override.employeeId === limited.id)
    assert.deepEqual(limitedOverrides.map((row: any) => row.override.overrideDate), ['2026-09-19'])
    assert.equal((await request(`/shifts/overrides/all?clientId=${b.id}&month=2026-09`, clientA.id)).status, 403)
    assert.equal((await request(`/feedback/service/${projectB.id}/developers`, clientA.id)).status, 403)
    assert.equal((await request('/feedback', clientA.id, 'POST', { clientId: b.id, clientServiceId: projectB.id, rating: 5, comments: 'Foreign' })).status, 403)
    assert.equal((await request('/feedback', clientA.id, 'POST', { clientId: a.id, clientServiceId: projectA.id, teamMemberId: member.id, rating: 2.5, comments: 'Invalid rating' })).status, 400)
    const saved = await request('/feedback', clientA.id, 'POST', { clientId: a.id, clientServiceId: projectA.id, teamMemberId: member.id, rating: 5, comments: 'Useful feedback' }); assert.equal(saved.status, 200)
    assert.equal((await request(`/client/dashboard?clientId=${a.id}`, clientA.id)).body.stats.pendingFeedback, 1)
    assert.equal((await request(`/feedback/${saved.body.id}/respond`, admin.id, 'POST', { adminResponse: 'We reviewed it' })).status, 200)
    assert.equal((await request(`/client/dashboard?clientId=${a.id}`, clientA.id)).body.stats.pendingFeedback, 0)
    const feedback = await request(`/feedback/client?clientId=${a.id}`, clientA.id); assert.equal(feedback.status, 200); assert.equal(feedback.body.feedbacks[0].adminResponse, 'We reviewed it')
    assert.equal((await request(`/feedback/admin`, admin.id)).status, 200)

    assert.equal((await request(`/users/${admin.id}`, admin.id, 'PUT', { isActive: false })).status, 409)
    assert.equal((await request(`/users/${clientA.id}/hard`, admin.id, 'DELETE')).status, 409)
    assert.equal((await request(`/users/${employee.id}/hard`, admin.id, 'DELETE')).status, 409)
    const created = await request('/users', admin.id, 'POST', { email: `${tag}_unused@example.test`, fullName: 'Unused fixture', username: `${tag}_unused`, role: 'client' })
    assert.equal(created.status, 201); userIds.push(created.body.user.id)
    const [internal] = await db.select().from(schema.users).where(eq(schema.users.id, created.body.user.id)); assert.equal(internal.password, null); assert.equal(internal.authProvider, 'clerk')
    const invite = await request(`/users/${created.body.user.id}/invitation`, admin.id, 'POST'); assert.equal(invite.status, 200); assert.equal(invite.body.emailSent, false); assert.equal(inviteCalls, 1)
    assert.equal((await request(`/users/${created.body.user.id}/password`, admin.id, 'PUT', { newPassword: 'ignored' })).status, 410)
    assert.equal((await request(`/users/${created.body.user.id}/hard`, admin.id, 'DELETE')).status, 200)
    const [retained] = await db.select().from(schema.users).where(eq(schema.users.id, employee.id)); assert.ok(retained)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    if (userIds.length) await db.delete(schema.feedback).where(inArray(schema.feedback.userId, userIds))
    if (memberIds.length) { await db.delete(schema.leaveRequests).where(inArray(schema.leaveRequests.employeeId, memberIds)); await db.delete(schema.shiftScheduleOverrides).where(inArray(schema.shiftScheduleOverrides.employeeId, memberIds)); await db.delete(schema.shiftSchedules).where(inArray(schema.shiftSchedules.employeeId, memberIds)) }
    if (clientIds.length) { await db.delete(schema.clientContacts).where(inArray(schema.clientContacts.clientId, clientIds)); await db.delete(schema.clientUsers).where(inArray(schema.clientUsers.clientId, clientIds)) }
    if (serviceIds.length) { await db.delete(schema.clientServiceTeamMembers).where(inArray(schema.clientServiceTeamMembers.clientServiceId, serviceIds)); await db.delete(schema.clientServices).where(inArray(schema.clientServices.id, serviceIds)) }
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    if (memberIds.length) await db.delete(schema.teamMembers).where(inArray(schema.teamMembers.id, memberIds))
    if (clientIds.length) await db.delete(schema.clients).where(inArray(schema.clients.id, clientIds))
    if (serviceTypeId) await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, serviceTypeId))
    if (leaveTypeId) await db.delete(schema.leaveTypes).where(eq(schema.leaveTypes.id, leaveTypeId))
    await pool.end()
  }
})
