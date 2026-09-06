import { Router } from 'express';
import { and, eq, inArray, isNull, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employmentCycles, leaveTypes, leaveBalances, leaveRequests, teamMembers, leaveAllocationSettings, leaveAdminEvents, clientServices, clientServiceTeamMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import leaveLifecycleRouter, { lock, provision } from './leaveLifecycle.js';
import { configuredAllocation, loadLeaveContext, summarizeLeave } from '../utils/vacationBalanceCalculator.js';
import { addDays, employmentCycleForDate, isoDate, timezoneLocalDate } from '../utils/calendar.js';
import { coversDate, overlapsPeriod } from '../services/clientWorkspace.js';
const router = Router();
router.use(leaveLifecycleRouter);
router.use(requireAuth, (req, res, next) => {
  if (req.method === 'GET' && req.path === '/leave-types') return next();
  if (req.user?.role !== 'admin') return res.status(403).json({
    error: 'Admin access required'
  });
  next();
});
class LeaveAdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
const wrap = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch((error: any) => res.status(error.status || 400).json({
  error: error.message || 'Leave administration failed'
}));
const id = (value: any) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new LeaveAdminError('Invalid identifier');
  return n;
};
function days(value: any, signed = false) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || !signed && n < 0 || Math.abs(n) > 999 || !Number.isInteger(n * 2)) throw new LeaveAdminError('Days must be a finite half-day increment between 0 and 999');
  return n;
}
async function audit(tx: any, req: any, entityType: string, entityId: number | null, employeeId: number | null, action: string, beforeData: any, afterData: any) {
  await tx.insert(leaveAdminEvents).values({
    actorId: req.user.id,
    employeeId,
    entityType,
    entityId,
    action,
    beforeData,
    afterData,
    reason: String(req.body?.reason || '').trim() || null
  });
}
async function payrollOpen(tx: any, employeeId: number, startDate: string, endDate: string) {
  const {
    assertPayrollDatesOpen
  } = await import('../services/payroll.js');
  await assertPayrollDatesOpen(tx, employeeId, startDate, endDate);
}
const todayFor = (context: any) => timezoneLocalDate(new Date(), context.member.timezone);
const currentFor = (context: any) => employmentCycleForDate(context.member.startDate, todayFor(context) < context.member.startDate ? context.member.startDate : todayFor(context));
function cycleView(cycle: any, member: any) {
  const today = timezoneLocalDate(new Date(), member.timezone);
  if (cycle.cycleStart < member.startDate) return {
    ...cycle,
    isActive: false,
    reconciliationWarning: 'Historical cycle predates employment; review the saved employment date and allocation.'
  };
  const canonical = employmentCycleForDate(member.startDate, cycle.cycleStart);
  if (canonical.cycleStart !== cycle.cycleStart) return {
    ...cycle,
    isActive: false,
    reconciliationWarning: 'Historical cycle differs from the employment anniversary; review the allocation.'
  };
  return {
    ...cycle,
    cycleEnd: canonical.cycleEnd,
    cycleMidpoint: canonical.cycleMidpoint,
    isActive: canonical.cycleStart <= today && canonical.cycleEnd >= today,
    reconciliationWarning: cycle.cycleEnd !== canonical.cycleEnd ? 'Stored cycle end requires normalization; calculations use the anniversary boundary.' : null
  };
}
function balanceView(context: any, type: any, date: string) {
  const b = summarizeLeave(context, type, date);
  return {
    leaveType: b.leaveType,
    leaveTypeId: b.leaveTypeId,
    totalAllocated: b.allocated,
    used: b.totalUsed,
    pending: b.pendingDays,
    adjustments: b.adjustments,
    available: b.totalRemaining,
    currentlyAvailable: b.currentlyAvailable,
    allocationWarning: b.allocationWarning,
    standardAllocation: b.baseAllocation
  };
}
async function summaries() {
  const members = await db.select().from(teamMembers).orderBy(teamMembers.name);
  return Promise.all(members.map(async member => {
    const context = await loadLeaveContext(member.id);
    return {
      employeeId: member.id,
      employeeName: member.name,
      balances: context.types.map((type: any) => balanceView(context, type, todayFor(context)))
    };
  }));
}
router.get('/leave-types', wrap(async (_req: any, res: any) => res.json(await db.select().from(leaveTypes))));
router.get(['/calendar', '/calendar-events', '/admin/calendar/optimized'], wrap(async (req: any, res: any) => {
  const conditions: any[] = [isNull(leaveRequests.archivedAt)];
  const statuses = req.path === '/calendar-events' ? ['approved'] : req.query.status ? [String(req.query.status)] : ['approved', 'pending'];
  conditions.push(inArray(leaveRequests.status, statuses));
  if (req.query.startDate || req.query.endDate) {
    const start = isoDate(req.query.startDate),
      end = isoDate(req.query.endDate);
    if (end < start) throw new LeaveAdminError('End date must follow start date');
    conditions.push(sql`${leaveRequests.startDate} <= ${end} AND ${leaveRequests.endDate} >= ${start}`);
  }
  const rows = await db.select({
    id: leaveRequests.id,
    employeeId: leaveRequests.employeeId,
    employeeName: teamMembers.name,
    avatarUrl: teamMembers.avatarUrl,
    employeeAvatar: teamMembers.avatarUrl,
    timezone: teamMembers.timezone,
    leaveType: leaveTypes.name,
    leaveTypeId: leaveTypes.id,
    startDate: leaveRequests.startDate,
    endDate: leaveRequests.endDate,
    halfDayStart: leaveRequests.halfDayStart,
    halfDayEnd: leaveRequests.halfDayEnd,
    status: leaveRequests.status,
    daysCount: leaveRequests.daysCount,
    reason: leaveRequests.reason
  }).from(leaveRequests).innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id)).innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id)).where(and(...conditions)).orderBy(leaveRequests.startDate);
  res.json(rows);
}));
router.get('/employees', wrap(async (req: any, res: any) => {
  let members = await db.select({
    id: teamMembers.id,
    name: teamMembers.name,
    email: teamMembers.email,
    position: teamMembers.position,
    status: teamMembers.status,
    showOnCalendar: teamMembers.showOnCalendar,
    avatarUrl: teamMembers.avatarUrl,
    timezone: teamMembers.timezone
  }).from(teamMembers).where(eq(teamMembers.status, 'active')).orderBy(teamMembers.name);
  if (req.query.clientId) {
    const rows = await db.select({
      assignment: clientServiceTeamMembers,
      service: clientServices
    }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).where(eq(clientServices.clientId, id(req.query.clientId)));
    members = members.filter(member => {
      const date = timezoneLocalDate(new Date(), member.timezone);
      return rows.some(r => r.assignment.teamMemberId === member.id && coversDate(r.assignment, date) && coversDate(r.service, date));
    });
  }
  res.json(members);
}));
router.get('/admin/balances/summary-all', wrap(async (_req: any, res: any) => res.json(await summaries())));
router.get('/admin/analytics/performance', wrap(async (_req: any, res: any) => {
  const rows = await summaries(),
    requests = await db.select().from(leaveRequests).where(isNull(leaveRequests.archivedAt));
  const balances = rows.flatMap(r => r.balances),
    utilization = balances.filter(b => b.totalAllocated + b.adjustments > 0).map(b => b.used / (b.totalAllocated + b.adjustments) * 100);
  res.json({
    totalEmployees: rows.length,
    totalActiveBalances: balances.length,
    totalPendingRequests: requests.filter(r => r.status === 'pending').length,
    totalApprovedRequestsThisYear: requests.filter(r => r.status === 'approved' && r.endDate >= `${new Date().getUTCFullYear()}-01-01`).length,
    avgBalanceUtilization: utilization.length ? Math.round(utilization.reduce((a, b) => a + b, 0) / utilization.length * 100) / 100 : 0,
    lastUpdated: new Date().toISOString()
  });
}));
router.get('/admin/balances', wrap(async (req: any, res: any) => {
  const conditions: any[] = [];
  if (req.query.employeeId) conditions.push(eq(leaveBalances.employeeId, id(req.query.employeeId)));
  if (req.query.cycleId) conditions.push(eq(leaveBalances.employmentCycleId, id(req.query.cycleId)));
  const rows = await db.select({
    balance: leaveBalances,
    employee: teamMembers,
    leaveType: leaveTypes,
    cycle: employmentCycles
  }).from(leaveBalances).innerJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id)).innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id)).innerJoin(employmentCycles, eq(leaveBalances.employmentCycleId, employmentCycles.id)).where(and(...conditions)).orderBy(teamMembers.name, leaveTypes.name);
  const contexts = new Map<number, any>();
  for (const row of rows) if (!contexts.has(row.employee.id)) contexts.set(row.employee.id, await loadLeaveContext(row.employee.id));
  res.json(rows.map(row => {
    const summary = balanceView(contexts.get(row.employee.id), row.leaveType, row.cycle.cycleStart);
    return {
      ...row,
      summary,
      allocationWarning: summary.allocationWarning,
      standardAllocation: summary.standardAllocation
    };
  }));
}));
async function updateBalance(tx: any, req: any, balanceId: number, values: any, addAdjustment = false) {
  const [initial] = await tx.select().from(leaveBalances).where(eq(leaveBalances.id, balanceId));
  if (!initial) throw new LeaveAdminError('Balance not found', 404);
  await lock(tx, initial.employeeId);
  const context = await loadLeaveContext(initial.employeeId, tx),
    before = context.balances.find((b: any) => b.id === balanceId),
    cycle = context.cycles.find((c: any) => c.id === before.employmentCycleId),
    type = context.types.find((t: any) => t.id === before.leaveTypeId);
  const totalDays = values.totalDays === undefined ? Number(before.totalDays) : days(values.totalDays);
  const adjustmentDays = values.adjustmentDays === undefined ? Number(before.adjustmentDays || 0) : days(values.adjustmentDays, true) + (addAdjustment ? Number(before.adjustmentDays || 0) : 0);
  if (totalDays + adjustmentDays < 0) throw new LeaveAdminError('Total available allocation cannot be negative');
  const after = {
    ...before,
    totalDays: String(totalDays),
    adjustmentDays: String(adjustmentDays),
    updatedAt: new Date()
  };
  const simulated = {
    ...context,
    balances: context.balances.map((b: any) => b.id === balanceId ? after : b)
  };
  const balance = summarizeLeave(simulated, type, cycle.cycleStart);
  if (balance.totalRemaining < 0 || balance.firstHalfRemaining < 0 || balance.secondHalfRemaining < 0) throw new LeaveAdminError('Allocation cannot be reduced below approved leave consumption', 409);
  await payrollOpen(tx, initial.employeeId, cycle.cycleStart, cycle.cycleEnd);
  const [saved] = await tx.update(leaveBalances).set({
    totalDays: after.totalDays,
    adjustmentDays: after.adjustmentDays,
    updatedAt: after.updatedAt
  }).where(eq(leaveBalances.id, balanceId)).returning();
  await audit(tx, req, 'leave_balance', saved.id, saved.employeeId, 'allocation_updated', before, saved);
  return saved;
}
router.put('/admin/balances/:balanceId', wrap(async (req: any, res: any) => res.json(await db.transaction(tx => updateBalance(tx, req, id(req.params.balanceId), req.body)))));
router.post('/admin/balances/bulk-update', wrap(async (req: any, res: any) => {
  if (!Array.isArray(req.body.updates) || !req.body.updates.length || req.body.updates.length > 500) throw new LeaveAdminError('Provide 1–500 balance updates');
  const updates = req.body.updates.map((u: any) => ({
    ...u,
    balanceId: id(u.balanceId)
  }));
  if (new Set(updates.map((u: any) => u.balanceId)).size !== updates.length) throw new LeaveAdminError('Each balance may occur only once');
  const result = await db.transaction(async tx => {
    const rows = await tx.select().from(leaveBalances).where(inArray(leaveBalances.id, updates.map((u: any) => u.balanceId)));
    for (const employeeId of [...new Set(rows.map(r => r.employeeId))].sort((a, b) => a - b)) await lock(tx, employeeId);
    const results = [];
    for (const update of updates) results.push(await updateBalance(tx, req, update.balanceId, update));
    return results;
  });
  res.json({
    updated: result
  });
}));
router.post('/balances/adjust', wrap(async (req: any, res: any) => {
  const employeeId = id(req.body.employeeId),
    typeId = id(req.body.leaveTypeId);
  days(req.body.adjustmentDays, true);
  const result = await db.transaction(async tx => {
    await lock(tx, employeeId);
    let context = await loadLeaveContext(employeeId, tx);
    const cycle = currentFor(context);
    await provision(tx, context, {
      startDate: cycle.cycleStart,
      endDate: cycle.cycleStart
    });
    context = await loadLeaveContext(employeeId, tx);
    const row = context.balances.find((b: any) => b.employmentCycleId === context.cycles.find((c: any) => c.cycleStart === cycle.cycleStart)?.id && b.leaveTypeId === typeId);
    if (!row) throw new LeaveAdminError('Leave type not found', 404);
    return updateBalance(tx, req, row.id, req.body, true);
  });
  res.json(result);
}));
async function initialize(req: any, employeeId: number) {
  return db.transaction(async tx => {
    await lock(tx, employeeId);
    let context = await loadLeaveContext(employeeId, tx);
    const date = req.body.cycleStart ? isoDate(req.body.cycleStart) : currentFor(context).cycleStart,
      cycle = employmentCycleForDate(context.member.startDate, date);
    if (date !== cycle.cycleStart) throw new LeaveAdminError(`Employment cycles follow the employee anniversary. Use ${cycle.cycleStart}.`);
    const existing = context.cycles.find((c: any) => c.cycleStart === cycle.cycleStart);
    if (req.body.leaveAllocations !== undefined && (!Array.isArray(req.body.leaveAllocations) || !req.body.leaveAllocations.length)) throw new LeaveAdminError('Leave allocations must be a nonempty array');
    if (existing && req.body.leaveAllocations?.length) throw new LeaveAdminError('This cycle already exists. Use its audited balance adjustment to change allocations.', 409);
    await provision(tx, context, {
      startDate: date,
      endDate: date
    });
    context = await loadLeaveContext(employeeId, tx);
    const saved = context.cycles.find((c: any) => c.cycleStart === date);
    if (req.body.leaveAllocations) {
      const seen = new Set<number>();
      for (const allocation of req.body.leaveAllocations) {
        const typeId = id(allocation.leaveTypeId);
        if (seen.has(typeId)) throw new LeaveAdminError('Duplicate leave type');
        seen.add(typeId);
        const row = context.balances.find((b: any) => b.employmentCycleId === saved.id && b.leaveTypeId === typeId);
        if (!row) throw new LeaveAdminError('Leave type not found');
        await updateBalance(tx, req, row.id, allocation);
      }
    }
    const balances = await tx.select().from(leaveBalances).where(eq(leaveBalances.employmentCycleId, saved.id));
    if (!existing) await audit(tx, req, 'employment_cycle', saved.id, employeeId, 'cycle_initialized', null, {
      cycle: saved,
      balances
    });
    return {
      cycle: saved,
      balances,
      usedSettings: true,
      cycleNumber: cycle.careerYear,
      leaveBalancesCreated: balances.length
    };
  });
}
router.post('/cycles/initialize', wrap(async (req: any, res: any) => res.json(await initialize(req, id(req.body.employeeId)))));
router.post('/admin/cycles', wrap(async (req: any, res: any) => {
  const result = await initialize(req, id(req.body.employeeId));
  res.json({
    ...result.cycle,
    cycleNumber: result.cycleNumber,
    leaveBalancesCreated: result.leaveBalancesCreated
  });
}));
router.post('/admin/initialize-balances/:employeeId', wrap(async (req: any, res: any) => res.json(await initialize(req, id(req.params.employeeId)))));
router.post('/admin/bulk-initialize-balances', wrap(async (req: any, res: any) => {
  const ids = req.body.employeeIds ? req.body.employeeIds.map(id) : (await db.select({
    id: teamMembers.id
  }).from(teamMembers)).map(r => r.id);
  if (ids.length > 5000) throw new LeaveAdminError('Too many employees');
  const results = [];
  for (const employeeId of [...new Set<number>(ids)]) try {
    const result = await initialize(req, employeeId);
    results.push({
      employeeId,
      success: true,
      ...result
    });
  } catch (error) {
    results.push({
      employeeId,
      success: false,
      error: (error as Error).message
    });
  }
  res.json({
    results,
    totalEmployees: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
}));
router.get('/admin/cycles', wrap(async (_req: any, res: any) => {
  const rows = await db.select({
    cycle: employmentCycles,
    employee: teamMembers
  }).from(employmentCycles).innerJoin(teamMembers, eq(employmentCycles.employeeId, teamMembers.id)).orderBy(desc(employmentCycles.cycleStart));
  res.json(rows.map(({
    cycle,
    employee
  }) => ({
    ...cycleView(cycle, employee),
    employeeName: employee.name
  })));
}));
router.get('/admin/cycles/employee/:employeeId', wrap(async (req: any, res: any) => {
  const context = await loadLeaveContext(id(req.params.employeeId)),
    today = todayFor(context);
  res.json({
    cycles: context.cycles.sort((a: any, b: any) => a.cycleStart.localeCompare(b.cycleStart)).map((c: any) => cycleView(c, context.member)),
    totalYears: Math.max(0, currentFor(context).careerYear - 1),
    totalCycles: context.cycles.length
  });
}));
router.put('/admin/cycles/:cycleId', wrap(async (req: any, res: any) => {
  const cycleId = id(req.params.cycleId);
  res.json(await db.transaction(async tx => {
    const [initial] = await tx.select().from(employmentCycles).where(eq(employmentCycles.id, cycleId));
    if (!initial) throw new LeaveAdminError('Cycle not found', 404);
    await lock(tx, initial.employeeId);
    const context = await loadLeaveContext(initial.employeeId, tx),
      before = context.cycles.find((c: any) => c.id === cycleId),
      canonical = employmentCycleForDate(context.member.startDate, req.body.cycleStart ? isoDate(req.body.cycleStart) : before.cycleStart);
    if (req.body.cycleStart && req.body.cycleStart !== before.cycleStart) throw new LeaveAdminError('An existing cycle cannot be moved. Initialize the requested anniversary cycle separately.', 409);
    if (canonical.cycleStart !== before.cycleStart) throw new LeaveAdminError('Historical cycle does not match employment start. Reconcile its allocation before correcting employment dates.', 409);
    const today = todayFor(context),
      isActive = canonical.cycleStart <= today && canonical.cycleEnd >= today;
    if (req.body.isActive !== undefined && req.body.isActive !== isActive) throw new LeaveAdminError('Current cycle is determined by employment dates; future or past cycles cannot be forced active');
    await payrollOpen(tx, initial.employeeId, canonical.cycleStart, canonical.cycleEnd);
    const [after] = await tx.update(employmentCycles).set({
      cycleEnd: canonical.cycleEnd,
      cycleMidpoint: canonical.cycleMidpoint,
      isActive
    }).where(eq(employmentCycles.id, cycleId)).returning();
    await audit(tx, req, 'employment_cycle', cycleId, initial.employeeId, 'cycle_corrected', before, after);
    return after;
  }));
}));
router.delete('/admin/cycles/:cycleId', wrap(async (req: any, res: any) => {
  const cycleId = id(req.params.cycleId);
  await db.transaction(async tx => {
    const [before] = await tx.select().from(employmentCycles).where(eq(employmentCycles.id, cycleId));
    if (!before) throw new LeaveAdminError('Cycle not found', 404);
    await lock(tx, before.employeeId);
    const context = await loadLeaveContext(before.employeeId, tx);
    if (context.balances.some((b: any) => b.employmentCycleId === cycleId) || context.requests.some((r: any) => r.startDate <= before.cycleEnd && r.endDate >= before.cycleStart)) throw new LeaveAdminError('A cycle with balances or leave history cannot be deleted', 409);
    await audit(tx, req, 'employment_cycle', cycleId, before.employeeId, 'empty_cycle_deleted', before, null);
    await tx.delete(employmentCycles).where(eq(employmentCycles.id, cycleId));
  });
  res.json({
    id: cycleId,
    message: 'Empty cycle removed; audit retained'
  });
}));
router.post('/admin/rollover-balances', wrap(async () => {
  throw new LeaveAdminError('Unused leave does not automatically roll over. Use an explicit audited balance adjustment for an approved individual exception.', 409);
}));
router.get('/admin/events', wrap(async (req: any, res: any) => {
  const conditions = req.query.employeeId ? [eq(leaveAdminEvents.employeeId, id(req.query.employeeId))] : [];
  res.json(await db.select().from(leaveAdminEvents).where(and(...conditions)).orderBy(desc(leaveAdminEvents.createdAt)).limit(500));
}));
async function settingsRows(connection: any = db) {
  return connection.select({
    id: leaveAllocationSettings.id,
    cycleNumber: leaveAllocationSettings.cycleNumber,
    leaveTypeId: leaveAllocationSettings.leaveTypeId,
    leaveTypeName: leaveTypes.name,
    allocatedDays: leaveAllocationSettings.allocatedDays,
    isDefault: leaveAllocationSettings.isDefault,
    createdAt: leaveAllocationSettings.createdAt,
    updatedAt: leaveAllocationSettings.updatedAt
  }).from(leaveAllocationSettings).innerJoin(leaveTypes, eq(leaveAllocationSettings.leaveTypeId, leaveTypes.id)).orderBy(leaveAllocationSettings.cycleNumber, leaveTypes.name);
}
router.get('/admin/allocation-settings', wrap(async (_req: any, res: any) => res.json(await settingsRows())));
router.get('/admin/allocation-settings/cycle/:cycleNumber', wrap(async (req: any, res: any) => {
  const year = id(req.params.cycleNumber),
    settings = await settingsRows(),
    types = await db.select().from(leaveTypes);
  res.json(types.map(type => ({
    leaveTypeId: type.id,
    leaveTypeName: type.name,
    cycleNumber: year,
    allocatedDays: configuredAllocation({
      settings
    }, type, year),
    isDefault: !settings.some((s: any) => s.leaveTypeId === type.id && s.cycleNumber === year)
  })));
}));
async function settingsLock(tx: any) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(7132, 0)`);
}
async function saveSetting(req: any, settingId?: number) {
  return db.transaction(async tx => {
    await settingsLock(tx);
    const rows = await tx.select().from(leaveAllocationSettings),
      existing = settingId ? rows.find(r => r.id === settingId) : null;
    if (settingId && !existing) throw new LeaveAdminError('Setting not found', 404);
    const cycleNumber = id(req.body.cycleNumber ?? existing?.cycleNumber),
      leaveTypeId = id(req.body.leaveTypeId ?? existing?.leaveTypeId),
      allocatedDays = days(req.body.allocatedDays ?? existing?.allocatedDays),
      isDefault = req.body.isDefault ?? existing?.isDefault ?? false;
    if (typeof isDefault !== 'boolean') throw new LeaveAdminError('Default flag must be boolean');
    const [type] = await tx.select().from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId));
    if (!type) throw new LeaveAdminError('Leave type not found', 404);
    const duplicates = rows.filter(r => r.cycleNumber === cycleNumber && r.leaveTypeId === leaveTypeId && r.id !== existing?.id);
    if (duplicates.length > 1) throw new LeaveAdminError('Duplicate allocation settings require explicit reconciliation', 409);
    const before = existing || duplicates[0] || null;
    if (existing && duplicates.length) throw new LeaveAdminError('A setting for this leave type and career year already exists', 409);
    if (isDefault) for (const other of rows.filter(r => r.leaveTypeId === leaveTypeId && r.isDefault && r.id !== before?.id)) {
      await tx.update(leaveAllocationSettings).set({
        isDefault: false,
        updatedAt: new Date()
      }).where(eq(leaveAllocationSettings.id, other.id));
      await audit(tx, req, 'leave_allocation_setting', other.id, null, 'default_unset', other, {
        ...other,
        isDefault: false
      });
    }
    const values = {
      cycleNumber,
      leaveTypeId,
      allocatedDays: String(allocatedDays),
      isDefault,
      updatedAt: new Date()
    };
    const [after] = before ? await tx.update(leaveAllocationSettings).set(values).where(eq(leaveAllocationSettings.id, before.id)).returning() : await tx.insert(leaveAllocationSettings).values(values).returning();
    await audit(tx, req, 'leave_allocation_setting', after.id, null, 'setting_saved', before, after);
    return after;
  });
}
router.post('/admin/allocation-settings', wrap(async (req: any, res: any) => res.json(await saveSetting(req))));
router.put('/admin/allocation-settings/:settingId', wrap(async (req: any, res: any) => res.json(await saveSetting(req, id(req.params.settingId)))));
router.delete('/admin/allocation-settings/:settingId', wrap(async (req: any, res: any) => {
  const settingId = id(req.params.settingId);
  await db.transaction(async tx => {
    await settingsLock(tx);
    const [before] = await tx.select().from(leaveAllocationSettings).where(eq(leaveAllocationSettings.id, settingId));
    if (!before) throw new LeaveAdminError('Setting not found', 404);
    await audit(tx, req, 'leave_allocation_setting', settingId, null, 'setting_removed', before, null);
    await tx.delete(leaveAllocationSettings).where(eq(leaveAllocationSettings.id, settingId));
  });
  res.json({
    success: true
  });
}));
router.post('/admin/allocation-settings/set-default', wrap(async (req: any, res: any) => {
  const year = id(req.body.cycleNumber);
  await db.transaction(async tx => {
    await settingsLock(tx);
    const rows = await tx.select().from(leaveAllocationSettings);
    if (!rows.some(r => r.cycleNumber === year)) throw new LeaveAdminError('Configure this career year before making it the default');
    for (const before of rows) {
      const isDefault = before.cycleNumber === year;
      if (before.isDefault !== isDefault) {
        await tx.update(leaveAllocationSettings).set({
          isDefault,
          updatedAt: new Date()
        }).where(eq(leaveAllocationSettings.id, before.id));
        await audit(tx, req, 'leave_allocation_setting', before.id, null, 'default_changed', before, {
          ...before,
          isDefault
        });
      }
    }
  });
  res.json({
    message: 'Default allocation updated for uninitialized cycles; saved individual balances are unchanged',
    cycleNumber: year
  });
}));
router.post('/admin/leave-types', wrap(async (req: any, res: any) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 100) throw new LeaveAdminError('Provide a leave type name');
  if (typeof req.body.isDeductible !== 'boolean' || typeof req.body.halfDaySupported !== 'boolean') throw new LeaveAdminError('Deductible and half-day flags must be boolean');
  const row = await db.transaction(async tx => {
    await settingsLock(tx);
    const types = await tx.select().from(leaveTypes);
    if (types.some(t => t.name.toLowerCase() === name.toLowerCase())) throw new LeaveAdminError('Leave type already exists', 409);
    const [after] = await tx.insert(leaveTypes).values({
      name,
      isDeductible: req.body.isDeductible,
      halfDaySupported: req.body.halfDaySupported
    }).returning();
    await audit(tx, req, 'leave_type', after.id, null, 'leave_type_created', null, after);
    return after;
  });
  res.json(row);
}));
export default router;
