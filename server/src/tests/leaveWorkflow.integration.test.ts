import test from 'node:test';
import assert from 'node:assert/strict';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/vestov_test_/.test(url.pathname)) throw new Error('Leave workflow tests require a disposable local vestov_test_* database');
  process.env.DATABASE_URL = testUrl;
  process.env.SLACK_NOTIFICATIONS_ENABLED = 'false';
  process.env.PROJECT_BOT_ENABLED = 'false';
}

test('leave workflow: automatic short sick leave, authority, edits, payroll locks, calendar and durable notifications', {
  skip: !testUrl, timeout: 60000,
}, async () => {
  const express = (await import('express')).default;
  const { db, pool } = await import('../db/index.js');
  const schema = await import('../db/schema.js');
  const { and, eq, inArray } = await import('drizzle-orm');
  const { default: vacationRouter } = await import('../routes/vacation.js');
  const { default: shiftsRouter } = await import('../routes/shifts.js');
  const { SHORT_SICK_LEAVE_REASON } = await import('../services/leavePolicy.js');
  const { listWorkflowDecisions } = await import('../services/workflow.js');
  const { workflowDueAt } = await import('../utils/workflowTime.js');
  const suffix = `leave_${Date.now()}`;
  const members: any[] = [];
  const actors: Record<string, any> = {};
  let server: any;
  try {
    for (const key of ['employee', 'editor', 'locked', 'concurrent']) {
      const [member] = await db.insert(schema.teamMembers).values({ name: `${key} ${suffix}`, email: `${key}_${suffix}@example.invalid`, startDate: '2027-01-01', position: 'Fixture only', timezone: 'UTC', status: 'active' }).returning();
      members.push(member);
      const [user] = await db.insert(schema.users).values({ username: `${key}_${suffix}`, fullName: member.name, email: member.email, role: 'team_member', teamMemberId: member.id, isActive: true }).returning();
      actors[key] = user;
      await db.insert(schema.shiftSchedules).values([1, 2, 3, 4, 5].map(dayOfWeek => ({ employeeId: member.id, dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true })));
    }
    for (const key of ['owner', 'deputy', 'unassignedAdmin']) {
      const [user] = await db.insert(schema.users).values({ username: `${key}_${suffix}`, fullName: `${key} ${suffix}`, email: `${key}_${suffix}@example.invalid`, role: 'admin', isActive: true }).returning();
      actors[key] = user;
      if (key !== 'unassignedAdmin') await db.insert(schema.workflowAssignments).values({ userId: user.id, role: key, displayName: `Fixture ${key}` });
    }
    actors.preview = { ...actors.employee, originalUserId: actors.owner.id };
    const types = await db.select().from(schema.leaveTypes);
    const sick = types.find(type => type.name === 'Sick Leave')!;
    const vacation = types.find(type => type.name === 'Vacation')!;
    assert.ok(sick && vacation, 'Standard leave types must be seeded');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = actors[String(req.headers['x-test-actor'] || 'employee')];
      req.isAuthenticated = () => true;
      next();
    });
    app.use('/api/vacation', vacationRouter);
    app.use('/api/shifts', shiftsRouter);
    server = await new Promise<any>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const origin = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (path: string, method = 'GET', body?: any, actor = 'employee') => {
      const result = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', 'X-Test-Actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: result.status, body: await result.json() as any };
    };
    const input = (startDate: string, endDate = startDate, leaveTypeId = sick.id) => ({ startDate, endDate, leaveTypeId });
    const create = (startDate: string, endDate = startDate, actor = 'employee', leaveTypeId = sick.id) => call('/vacation/requests', 'POST', input(startDate, endDate, leaveTypeId), actor);
    assert.equal((await create('2027-01-04', '2027-01-05', 'preview')).status, 403, 'Impersonation cannot create automatically approved leave');
    assert.equal((await call('/vacation/my-requests', 'GET', undefined, 'preview')).status, 200, 'Read-only employee preview remains available');
    const short = await create('2027-01-04', '2027-01-05');
    assert.equal(short.status, 200, JSON.stringify(short.body));
    assert.equal(short.body.status, 'approved');
    assert.equal(short.body.decisionBy, null, 'Automatic approval is not attributed to an employee decision');
    assert.equal(short.body.decisionReason, SHORT_SICK_LEAVE_REASON);
    const calendar = await call('/shifts/calendar/me?month=2027-01');
    assert.equal(calendar.body.days.find((day: any) => day.date === '2027-01-04').absenceUnits, 1, 'Sick leave reaches the calendar immediately');
    assert.equal((await call('/vacation/my-sick-leave-balance')).body.totalUsed, 2);
    const extension = await create('2027-01-06');
    assert.equal(extension.body.status, 'pending', 'A separate adjacent request cannot bypass the two-day threshold');
    assert.equal(extension.body.decisionRequestedAt, extension.body.createdAt, 'New pending requests start their decision deadline at submission');
    const pendingEdit = await call(`/vacation/requests/${extension.body.id}`, 'PUT', { reason: 'Updated note without postponing the decision' });
    assert.equal(pendingEdit.body.decisionRequestedAt, extension.body.decisionRequestedAt, 'Editing a pending request cannot reset its deadline');
    assert.equal((await call(`/vacation/requests/${extension.body.id}/status`, 'PUT', { status: 'approved' }, 'preview')).status, 403);
    assert.equal((await call('/vacation/requests', 'GET', undefined, 'unassignedAdmin')).status, 200, 'Existing administrator read access is retained');
    for (const actor of ['employee', 'unassignedAdmin']) {
      assert.equal((await call(`/vacation/requests/${extension.body.id}/status`, 'PUT', { status: 'approved' }, actor)).status, 403);
      assert.equal((await call('/vacation/admin/requests/bulk-action', 'POST', { requestIds: [extension.body.id], action: 'approve' }, actor)).status, 403);
    }
    assert.equal((await call('/vacation/admin/create-and-approve', 'POST', { ...input('2027-01-14'), employeeId: members[0].id, autoApprove: true }, 'unassignedAdmin')).status, 403);
    assert.equal((await call(`/vacation/requests/${extension.body.id}/status`, 'PUT', { status: 'approved' }, 'deputy')).status, 200);
    assert.equal((await call(`/vacation/requests/${extension.body.id}`, 'PUT', { endDate: '2027-01-07' })).status, 409, 'Employee cannot rewrite a manual approval');
    const holiday = await create('2027-01-11', '2027-01-12', 'employee', vacation.id);
    assert.equal(holiday.body.status, 'pending', 'Two-day vacation still needs a decision');
    const approvedHoliday = await call(`/vacation/requests/${holiday.body.id}/status`, 'PUT', { status: 'approved' }, 'owner');
    assert.equal(approvedHoliday.status, 200, JSON.stringify(approvedHoliday.body));
    assert.equal(approvedHoliday.body.decisionBy, actors.owner.id);
    assert.equal((await create('2027-01-09', '2027-01-10')).status, 400, 'Weekend-only zero-day absence is not approved');

    const editable = await create('2027-02-01', '2027-02-01', 'editor');
    assert.equal(editable.body.status, 'approved');
    const originalCreatedAt = new Date(Date.now() - 7 * 86_400_000);
    await db.update(schema.leaveRequests).set({ createdAt: originalCreatedAt }).where(eq(schema.leaveRequests.id, editable.body.id));
    const editableList = await call('/vacation/my-requests', 'GET', undefined, 'editor');
    assert.equal(editableList.body.find((row: any) => row.id === editable.body.id).canEdit, true);
    const longer = await call(`/vacation/requests/${editable.body.id}`, 'PUT', { endDate: '2027-02-03' }, 'editor');
    assert.equal(longer.status, 200, JSON.stringify(longer.body));
    assert.equal(longer.body.status, 'pending');
    assert.equal(longer.body.decisionAt, null);
    assert.equal(longer.body.createdAt, originalCreatedAt.toISOString(), 'Reopening for a new decision preserves original request creation');
    assert.ok(Date.parse(longer.body.decisionRequestedAt) > originalCreatedAt.getTime(), 'Sick extension starts a fresh decision deadline');
    const extensionDecision = (await listWorkflowDecisions(actors.owner)).items.find(item => item.id === `leave:${editable.body.id}`)!;
    assert.equal(extensionDecision.dueAt, workflowDueAt(longer.body.decisionRequestedAt).toISOString());
    assert.equal(extensionDecision.overdue, false, 'An old automatically approved request is not immediately overdue when extended');
    assert.equal((await call('/shifts/calendar/me?month=2027-02', 'GET', undefined, 'editor')).body.days.find((day: any) => day.date === '2027-02-01').absenceUnits, 0);
    const shorter = await call(`/vacation/requests/${editable.body.id}`, 'PUT', { endDate: '2027-02-02' }, 'editor');
    assert.equal(shorter.body.status, 'approved', JSON.stringify(shorter.body));
    const asVacation = await call(`/vacation/requests/${editable.body.id}`, 'PUT', { leaveTypeId: vacation.id }, 'editor');
    assert.equal(asVacation.body.status, 'pending', 'Changing auto-approved sick leave to vacation cannot inherit automatic approval');
    const cancel = await call(`/vacation/requests/${editable.body.id}/cancel`, 'PUT', {}, 'editor');
    assert.equal(cancel.body.status, 'canceled');
    assert.equal((await call(`/vacation/requests/${editable.body.id}`, 'DELETE', undefined, 'editor')).status, 200);
    const history = await db.select().from(schema.leaveRequestEvents).where(eq(schema.leaveRequestEvents.leaveRequestId, editable.body.id));
    assert.equal(history.length, 6, 'Every create, edit, cancellation and archive retains an event');
    assert.ok(history.some(event => event.note?.includes('Short sick leave automatically approved')));
    assert.equal((await call(`/vacation/requests/${editable.body.id}`, 'PUT', { endDate: '2027-02-01' }, 'owner')).status, 409);

    await db.insert(schema.payrollPeriods).values({ teamMemberId: members[2].id, salaryMonth: '2027-03', status: 'closed', baseSalary: '100', defaultExtras: [], createdBy: actors.owner.id });
    const noticesBefore = await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.userId, actors.locked.id));
    assert.equal((await create('2027-03-01', '2027-03-02', 'locked')).status, 409, 'Auto-approval respects closed payroll');
    const pendingLocked = await create('2027-03-01', '2027-03-03', 'locked');
    assert.equal(pendingLocked.body.status, 'pending');
    assert.equal((await call(`/vacation/requests/${pendingLocked.body.id}`, 'PUT', { endDate: '2027-03-02' }, 'locked')).status, 409, 'Editing a pending leave into automatic approval also respects closed payroll');
    assert.equal((await call(`/vacation/requests/${pendingLocked.body.id}/status`, 'PUT', { status: 'approved' }, 'owner')).status, 409);
    const noticesAfter = await db.select().from(schema.workflowNotifications).where(eq(schema.workflowNotifications.userId, actors.locked.id));
    assert.equal(noticesAfter.length, noticesBefore.length + 1, 'Failed business writes leave no notification behind');
    const futureSick = await create('2027-04-01', '2027-04-01', 'locked');
    assert.equal(futureSick.body.status, 'approved');
    await db.insert(schema.payrollPeriods).values({ teamMemberId: members[2].id, salaryMonth: '2027-04', status: 'closed', baseSalary: '100', defaultExtras: [], createdBy: actors.owner.id });
    assert.equal((await call(`/vacation/requests/${futureSick.body.id}`, 'PUT', { endDate: '2027-04-02' }, 'locked')).status, 409);
    assert.equal((await call(`/vacation/requests/${futureSick.body.id}/cancel`, 'PUT', {}, 'locked')).status, 409);
    const concurrent = await Promise.all([create('2027-04-01', '2027-04-02', 'concurrent'), create('2027-04-05', '2027-04-06', 'concurrent')]);
    assert.ok(concurrent.every(result => result.status === 200), JSON.stringify(concurrent));
    assert.deepEqual(concurrent.map(result => result.body.status).sort(), ['approved', 'pending']);
    const notifications = await db.select().from(schema.workflowNotifications).where(inArray(schema.workflowNotifications.userId, [actors.employee.id, actors.owner.id, actors.deputy.id]));
    assert.ok(notifications.some(notification => notification.userId === actors.employee.id && notification.title === 'Sick leave approved automatically'));
    for (const actor of ['owner', 'deputy']) assert.ok(notifications.some(notification => notification.userId === actors[actor].id && notification.title === 'Leave request needs a decision'));
    const approvedNotice = notifications.filter(notification => notification.userId === actors.employee.id && notification.eventKey.startsWith(`leave:${extension.body.id}:`) && notification.title === 'Leave request approved');
    assert.equal(approvedNotice.length, 1, 'Employee receives the decision once');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    const memberIds = members.map(member => member.id);
    const userIds = Object.values(actors).map(user => user.id);
    if (memberIds.length) await db.transaction(async tx => {
      const requests = await tx.select({ id: schema.leaveRequests.id }).from(schema.leaveRequests).where(inArray(schema.leaveRequests.employeeId, memberIds));
      if (requests.length) await tx.delete(schema.leaveRequestEvents).where(inArray(schema.leaveRequestEvents.leaveRequestId, requests.map(request => request.id)));
      await tx.delete(schema.leaveRequests).where(inArray(schema.leaveRequests.employeeId, memberIds));
      await tx.delete(schema.shiftSchedules).where(inArray(schema.shiftSchedules.employeeId, memberIds));
      await tx.delete(schema.leaveBalances).where(inArray(schema.leaveBalances.employeeId, memberIds));
      await tx.delete(schema.employmentCycles).where(inArray(schema.employmentCycles.employeeId, memberIds));
      await tx.delete(schema.payrollPeriods).where(inArray(schema.payrollPeriods.teamMemberId, memberIds));
      if (userIds.length) await tx.delete(schema.users).where(inArray(schema.users.id, userIds));
      await tx.delete(schema.teamMembers).where(inArray(schema.teamMembers.id, memberIds));
    });
    await pool.end();
  }
});
