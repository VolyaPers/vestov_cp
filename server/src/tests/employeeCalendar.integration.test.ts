import test from 'node:test';
import assert from 'node:assert/strict';

// This harness never authenticates with a person's session. Only disposable fixture principals are injected.
const testUrl = process.env.EMPLOYEE_CALENDAR_TEST_DATABASE_URL;
const enabled = !!testUrl;
if (enabled) {
  const database = new URL(testUrl!).pathname.slice(1);
  if (!/^vestov_(fix|test|audit)_/.test(database)) throw new Error('Integration test requires a separate vestov_fix_/test_/audit_ database');
  process.env.DATABASE_URL = testUrl;
  process.env.SLACK_NOTIFICATIONS_ENABLED = 'false';
  for (const key of ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID', 'SLACK_ADMIN_CHANNEL_ID', 'INVITE_EMAIL_WEBHOOK_URL', 'EMAIL_WEBHOOK_URL', 'RESEND_WEBHOOK_URL', 'SENDGRID_API_KEY']) process.env[key] = '';
}
test('employee calendar and shifts: transactional real-router integration on disposable fixtures', {
  skip: !enabled,
  timeout: 60000
}, async () => {
  const express = (await import('express')).default;
  const {
    db,
    pool
  } = await import('../db/index.js');
  const schema = await import('../db/schema.js');
  const {
    eq,
    inArray
  } = await import('drizzle-orm');
  const {
    default: vacationRouter
  } = await import('../routes/vacation.js');
  const {
    default: shiftsRouter
  } = await import('../routes/shifts.js');
  const database = (await pool.query('select current_database() as name')).rows[0].name;
  assert.match(database, /^vestov_(fix|test|audit)_/);
  const suffix = `calendar_${Date.now()}`;
  const memberIds: number[] = [],
    userIds: number[] = [],
    leaveTypeIds: number[] = [];
  let server: any;
  try {
    const year = new Date().getUTCFullYear();
    const [member] = await db.insert(schema.teamMembers).values({
      name: `Fixture ${suffix}`,
      email: `member_${suffix}@example.invalid`,
      startDate: `${year}-01-01`,
      position: 'Test only',
      timezone: 'UTC',
      status: 'active'
    }).returning();
    memberIds.push(member.id);
    const [other] = await db.insert(schema.teamMembers).values({
      name: `Other fixture ${suffix}`,
      email: `other_${suffix}@example.invalid`,
      startDate: `${year}-01-01`,
      position: 'Test only',
      timezone: 'UTC',
      status: 'active'
    }).returning();
    memberIds.push(other.id);
    const [user] = await db.insert(schema.users).values({
      username: `u_${suffix}`,
      fullName: 'Fixture employee',
      email: `login_${suffix}@example.invalid`,
      role: 'team_member',
      teamMemberId: member.id,
      isActive: true
    }).returning();
    userIds.push(user.id);
    const [admin] = await db.insert(schema.users).values({
      username: `a_${suffix}`,
      fullName: 'Fixture administrator',
      email: `admin_${suffix}@example.invalid`,
      role: 'admin',
      isActive: true
    }).returning();
    userIds.push(admin.id);
    await db.insert(schema.workflowAssignments).values({ userId: admin.id, role: 'owner', displayName: 'Fixture leave approver' });
    const types = await db.select().from(schema.leaveTypes);
    const vacation = types.find(t => t.name === 'Vacation')!,
      sick = types.find(t => t.name === 'Sick Leave')!;
    assert.ok(vacation && sick, 'Run schema and standard leave type setup before integration tests');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = req.headers['x-test-actor'] === 'admin' ? admin : user;
      req.isAuthenticated = () => true;
      next();
    });
    app.use('/api/vacation', vacationRouter);
    app.use('/api/shifts', shiftsRouter);
    server = await new Promise<any>(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const call = async (path: string, method = 'GET', body?: any, actor = 'employee') => {
      const response = await fetch(origin + '/api' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Actor': actor
        },
        ...(body !== undefined ? {
          body: JSON.stringify(body)
        } : {})
      });
      return {
        status: response.status,
        body: (await response.json()) as any
      };
    };
    const countCycles = async () => Number((await pool.query('select count(*) from employment_cycles where employee_id=$1', [member.id])).rows[0].count);
    assert.equal(await countCycles(), 0);
    const balance = await call('/vacation/my-balance');
    assert.equal(balance.status, 200);
    assert.ok(Number.isFinite(balance.body.totalAllocated));
    const baselineAllocation = balance.body.totalAllocated;
    await call('/vacation/my-balance');
    assert.equal(await countCycles(), 0, 'Balance GET does not provision or alter cycles');
    const fixtureAllocation = await call('/vacation/cycles/initialize', 'POST', {
      employeeId: member.id,
      leaveAllocations: [{
        leaveTypeId: vacation.id,
        totalDays: 16,
        adjustmentDays: 0
      }],
      reason: 'Isolated test allocation'
    }, 'admin');
    assert.equal(fixtureAllocation.status, 200, JSON.stringify(fixtureAllocation.body));
    assert.equal((await call(`/vacation/requests/${other.id}`)).status, 403);
    assert.equal((await call('/vacation/requests', 'POST', {
      employeeId: other.id,
      leaveTypeId: vacation.id,
      startDate: `${year}-09-15`,
      endDate: `${year}-09-15`
    })).status, 403);
    const request = (start: string, end: string, type = vacation.id, extra: any = {}) => ({
      employeeId: member.id,
      leaveTypeId: type,
      startDate: start,
      endDate: end,
      ...extra
    });
    const first = await call('/vacation/requests', 'POST', request(`${year}-09-15`, `${year}-09-15`));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal((await call(`/vacation/requests/${first.body.id}/status`, 'PUT', {
      status: 'approved'
    }, 'admin')).status, 200, 'First-year second-half day can be approved');
    assert.equal((await call('/vacation/requests', 'POST', request(`${year}-09-15`, `${year}-09-15`, sick.id))).status, 400, 'Different leave types cannot overlap');
    assert.equal((await call('/vacation/admin/create-and-approve', 'POST', {
      ...request(`${year + 1}-01-01`, `${year + 1}-12-31`),
      autoApprove: true
    }, 'admin')).status, 400, 'Admin calendar must validate future allocation');
    // Two full weeks contain ten working days; weekends do not consume allowance.
    const firstTen = await call('/vacation/requests', 'POST', request(`${year}-10-01`, `${year}-10-14`));
    assert.equal(firstTen.status, 200);
    const secondTen = await call('/vacation/requests', 'POST', request(`${year}-11-01`, `${year}-11-14`));
    assert.equal(secondTen.status, 200);
    const approvals = await Promise.all([firstTen, secondTen].map(r => call(`/vacation/requests/${r.body.id}/status`, 'PUT', {
      status: 'approved'
    }, 'admin')));
    assert.equal(approvals.filter(r => r.status === 200).length, 1, 'Concurrent approvals cannot overdraw remaining allocation');
    const rejected = approvals.findIndex(r => r.status !== 200);
    const pendingId = [firstTen, secondTen][rejected].body.id;
    const bulk = await call('/vacation/admin/requests/bulk-action', 'POST', {
      requestIds: [pendingId],
      action: 'approve'
    }, 'admin');
    assert.equal(bulk.body.successful, 0, 'Bulk approve cannot bypass allocation');
    const approvedId = [firstTen, secondTen][1 - rejected].body.id;
    const enlarge = await call(`/vacation/requests/${approvedId}`, 'PUT', {
      endDate: `${year}-12-31`
    }, 'admin');
    assert.equal(enlarge.status, 400, 'Partial edit recalculates and validates the whole date interval');
    const am = await call('/vacation/requests', 'POST', request(`${year}-12-15`, `${year}-12-15`, sick.id, {
      halfDayEnd: true
    }));
    assert.equal(am.status, 200);
    const pm = await call('/vacation/requests', 'POST', request(`${year}-12-15`, `${year}-12-15`, sick.id, {
      halfDayStart: true
    }));
    assert.equal(pm.status, 200, 'Complementary half days can coexist');
    assert.equal((await call(`/vacation/requests/${am.body.id}/cancel`, 'PUT', {})).status, 200);
    assert.equal((await call(`/vacation/requests/${am.body.id}`, 'DELETE')).status, 200);
    const auditCount = Number((await pool.query('select count(*) from leave_request_events where leave_request_id=$1', [am.body.id])).rows[0].count);
    assert.equal(auditCount, 3, 'Submit, cancel and archive preserve the immutable event history');
    const [archived] = await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, am.body.id));
    assert.ok(archived.archivedAt);
    assert.equal((await call(`/vacation/requests/${am.body.id}`, 'PUT', { reason: 'Attempted history rewrite' }, 'admin')).status, 409);
    const myRequests = await call(`/vacation/requests/${member.id}`);
    assert.equal(myRequests.body.some((r: any) => r.request.id === am.body.id), false);
    const initialized = await call('/vacation/cycles/initialize', 'POST', {
      employeeId: other.id
    }, 'admin');
    assert.equal(initialized.status, 200, JSON.stringify(initialized.body));
    assert.equal(initialized.body.cycle.cycleEnd, `${year}-12-31`);
    assert.equal(Number(initialized.body.balances.find((b: any) => b.leaveTypeId === vacation.id).totalDays), baselineAllocation, 'Legacy initialize uses the configured allocation');
    await db.update(schema.employmentCycles).set({ cycleEnd: `${year + 1}-01-01` }).where(eq(schema.employmentCycles.id, initialized.body.cycle.id));
    const normalizedView = await call(`/vacation/admin/cycles/employee/${other.id}`, 'GET', undefined, 'admin');
    assert.equal(normalizedView.body.cycles[0].cycleEnd, `${year}-12-31`, 'Historical inclusive boundary is displayed using the canonical anniversary');
    const [unchangedCycle] = await db.select().from(schema.employmentCycles).where(eq(schema.employmentCycles.id, initialized.body.cycle.id));
    assert.equal(unchangedCycle.cycleEnd, `${year + 1}-01-01`, 'Read normalization does not rewrite stored history');
    const again = await call('/vacation/cycles/initialize', 'POST', {
      employeeId: other.id
    }, 'admin');
    assert.equal(again.body.cycle.id, initialized.body.cycle.id, 'Repeated cycle initialize is idempotent');
    const future = await call('/vacation/admin/cycles', 'POST', {
      employeeId: other.id,
      cycleStart: `${year + 1}-01-01`,
      isActive: true
    }, 'admin');
    assert.equal(future.status, 200);
    assert.equal(future.body.isActive, false, 'Future provisioning never switches current cycle');
    const currentCycle = await call(`/vacation/employment-cycle/${other.id}`, 'GET', undefined, 'admin');
    assert.equal(currentCycle.body.id, initialized.body.cycle.id);
    assert.equal((await call(`/vacation/admin/cycles/${future.body.id}`, 'PUT', {
      isActive: true
    }, 'admin')).status, 400, 'Forcing future cycle active is rejected');
    const mainBalances = await call(`/vacation/admin/balances?employeeId=${member.id}`, 'GET', undefined, 'admin');
    const mainBalance = mainBalances.body.find((r: any) => r.leaveType.id === vacation.id).balance;
    assert.equal((await call(`/vacation/admin/balances/${mainBalance.id}`, 'PUT', {
      totalDays: -1
    }, 'admin')).status, 400);
    assert.equal((await call(`/vacation/admin/balances/${mainBalance.id}`, 'PUT', {
      totalDays: 1
    }, 'admin')).status, 409, 'Legacy allocation cannot erase approved consumption');
    assert.equal((await call('/vacation/admin/balances/bulk-update', 'POST', {
      updates: [{
        balanceId: mainBalance.id,
        totalDays: 1
      }]
    }, 'admin')).status, 409, 'Bulk balance validation is identical');
    assert.equal((await call('/vacation/balances/adjust', 'POST', {
      employeeId: member.id,
      leaveTypeId: vacation.id,
      adjustmentDays: 0.5,
      reason: 'Fixture reviewed allocation'
    }, 'admin')).status, 200);
    const balancesAfter = await call('/vacation/my-balance');
    assert.equal(balancesAfter.body.totalAllocated, 16.5);
    const events = await call(`/vacation/admin/events?employeeId=${member.id}`, 'GET', undefined, 'admin');
    assert.ok(events.body.some((e: any) => e.action === 'allocation_updated' && e.beforeData && e.afterData), 'Balance adjustments retain immutable snapshots');
    const customType = await call('/vacation/admin/leave-types', 'POST', {
      name: `Fixture Leave ${suffix}`,
      isDeductible: true,
      halfDaySupported: true
    }, 'admin');
    assert.equal(customType.status, 200);
    leaveTypeIds.push(customType.body.id);
    assert.equal((await call('/vacation/admin/allocation-settings', 'POST', {
      cycleNumber: 1,
      leaveTypeId: customType.body.id,
      allocatedDays: 4,
      isDefault: true
    }, 'admin')).status, 200);
    const otherSummary = await call(`/vacation/balances/${other.id}`, 'GET', undefined, 'admin');
    assert.equal(otherSummary.body.balances.find((b: any) => b.leaveTypeId === customType.body.id).totalAllocated, 4, 'Uninitialized allocation reads configured days');
    const customRequest = await call('/vacation/admin/create-and-approve', 'POST', {
      employeeId: other.id,
      leaveTypeId: customType.body.id,
      startDate: `${year}-09-21`,
      endDate: `${year}-09-21`,
      autoApprove: true
    }, 'admin');
    assert.equal(customRequest.status, 200);
    assert.equal((await call('/vacation/admin/allocation-settings', 'POST', {
      cycleNumber: 1,
      leaveTypeId: customType.body.id,
      allocatedDays: 6,
      isDefault: true
    }, 'admin')).status, 200);
    const savedSummary = await call(`/vacation/balances/${other.id}`, 'GET', undefined, 'admin');
    assert.equal(savedSummary.body.balances.find((b: any) => b.leaveTypeId === customType.body.id).totalAllocated, 4, 'New settings do not silently rewrite saved individual allocations');
    await db.insert(schema.payrollPeriods).values({
      teamMemberId: other.id,
      salaryMonth: `${year}-09`,
      status: 'closed',
      baseSalary: '100',
      defaultExtras: [],
      createdBy: admin.id
    });
    assert.equal((await call(`/vacation/requests/${customRequest.body.id}/cancel`, 'PUT', {}, 'admin')).status, 409, 'Settled payroll freezes its approved attendance');
    assert.equal((await call('/vacation/admin/rollover-balances', 'POST', {
      fromCycleId: initialized.body.cycle.id,
      toCycleId: future.body.id
    }, 'admin')).status, 409, 'No unapproved automatic carryover policy');
    const schedules = Array.from({
      length: 7
    }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
      isActive: true
    }));
    assert.equal((await call('/shifts/preferred/me', 'PUT', {
      schedules
    })).status, 200);
    const starts = await Promise.all(Array.from({
      length: 10
    }, () => call('/shifts/start', 'POST', {
      comment: 'Persisted fixture note'
    })));
    assert.equal(starts.every(r => r.status === 200), true, JSON.stringify(starts.map(r => r.body.error)));
    assert.equal(new Set(starts.map(r => r.body.shift.id)).size, 1, 'Concurrent starts are idempotent');
    const shiftId = starts[0].body.shift.id;
    assert.ok(starts[0].body.shift.scheduleId);
    const saveAfterStart = await call('/shifts/preferred/me', 'PUT', {
      schedules: schedules.map(s => ({
        ...s,
        startTime: '10:00'
      }))
    });
    assert.equal(saveAfterStart.status, 200, 'Referenced schedule can be changed without FK DELETE');
    const breaks = await Promise.all(Array.from({
      length: 10
    }, () => call('/shifts/break/start', 'POST', {
      description: 'Persisted break note'
    })));
    assert.equal(new Set(breaks.map(r => r.body.break.id)).size, 1, 'Concurrent breaks are idempotent');
    const endResults = await Promise.all([call('/shifts/break/end', 'POST', {}), call('/shifts/end', 'POST', {})]);
    assert.equal(endResults.every(r => r.status === 200), true);
    const [closed] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, shiftId));
    assert.equal(closed.status, 'completed');
    assert.ok(closed.endTime);
    assert.equal(closed.notes, 'Persisted fixture note');
    const pauses = await db.select().from(schema.shiftBreaks).where(eq(schema.shiftBreaks.shiftId, shiftId));
    assert.equal(pauses.length, 1);
    assert.ok(pauses[0].endTime);
    assert.equal(pauses[0].notes, 'Persisted break note');
    const history = await call('/shifts/history');
    assert.equal(history.status, 200);
    assert.ok(history.body.shifts[0].workingMinutes >= 0);
    assert.equal(history.body.shifts[0].breaks.length, 1);
    const before = await call('/shifts/preferred/me');
    await call('/shifts/preferred/me', 'PUT', {
      schedules: [{
        dayOfWeek: 9,
        startTime: '25:00',
        endTime: '10:00',
        isActive: true
      }]
    });
    const after = await call('/shifts/preferred/me');
    assert.deepEqual(after.body.schedules, before.body.schedules, 'Validation failure preserves existing graph');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    // Only rows owned by IDs created above are removed. Never touch existing employee data.
    if (memberIds.length) await db.transaction(async tx => {
      const requestIds = (await tx.select({
        id: schema.leaveRequests.id
      }).from(schema.leaveRequests).where(inArray(schema.leaveRequests.employeeId, memberIds))).map(r => r.id);
      if (requestIds.length) await tx.delete(schema.leaveRequestEvents).where(inArray(schema.leaveRequestEvents.leaveRequestId, requestIds));
      await tx.delete(schema.leaveRequests).where(inArray(schema.leaveRequests.employeeId, memberIds));
      const shiftIds = (await tx.select({
        id: schema.shifts.id
      }).from(schema.shifts).where(inArray(schema.shifts.employeeId, memberIds))).map(r => r.id);
      if (shiftIds.length) await tx.delete(schema.shiftBreaks).where(inArray(schema.shiftBreaks.shiftId, shiftIds));
      await tx.delete(schema.shifts).where(inArray(schema.shifts.employeeId, memberIds));
      await tx.delete(schema.shiftScheduleOverrides).where(inArray(schema.shiftScheduleOverrides.employeeId, memberIds));
      await tx.delete(schema.shiftSchedules).where(inArray(schema.shiftSchedules.employeeId, memberIds));
      await tx.delete(schema.leaveAdminEvents).where(inArray(schema.leaveAdminEvents.actorId, userIds));
      await tx.delete(schema.payrollPeriods).where(inArray(schema.payrollPeriods.teamMemberId, memberIds));
      if (leaveTypeIds.length) await tx.delete(schema.leaveAllocationSettings).where(inArray(schema.leaveAllocationSettings.leaveTypeId, leaveTypeIds));
      await tx.delete(schema.leaveBalances).where(inArray(schema.leaveBalances.employeeId, memberIds));
      await tx.delete(schema.employmentCycles).where(inArray(schema.employmentCycles.employeeId, memberIds));
      if (leaveTypeIds.length) await tx.delete(schema.leaveTypes).where(inArray(schema.leaveTypes.id, leaveTypeIds));
      if (userIds.length) await tx.delete(schema.users).where(inArray(schema.users.id, userIds));
      await tx.delete(schema.teamMembers).where(inArray(schema.teamMembers.id, memberIds));
    });
    await pool.end();
  }
});
