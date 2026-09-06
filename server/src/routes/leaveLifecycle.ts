import { Router } from 'express';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employmentCycles, leaveBalances, leaveRequests, leaveRequestEvents, leaveTypes, teamMembers, users, clientServices, clientServiceTeamMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveEmployeeId } from '../services/access.js';
import { assertLeaveRequestAllowed, calculateVacationBalance, configuredAllocation, isSickType, loadLeaveContext, summarizeLeave } from '../utils/vacationBalanceCalculator.js';
import { calculateSickLeaveBalance } from '../utils/sickLeaveBalanceCalculator.js';
import { employmentCycleForDate, isoDate, leaveDaySegments, leaveDays, leaveOverlaps, timezoneLocalDate } from '../utils/calendar.js';
import { getWorkflowAccess, queueWorkflowNotification, requireWorkflowCapability, workflowRecipients } from '../services/workflow.js';
import { SHORT_SICK_LEAVE_REASON, sickEpisodeDays } from '../services/leavePolicy.js';
const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user?.originalUserId && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return res.status(403).json({ error: 'Exit user preview before changing leave requests.' });
  next();
});
class LeaveError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
const wrap = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch((error: any) => res.status(error.status || 400).json({
  error: error.message || 'Leave operation failed'
}));
const id = (value: any) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new LeaveError('Invalid identifier');
  return n;
};
async function admin(req: any) {
  await requireWorkflowCapability(req.user, 'canApproveLeave');
}
async function ownEmployee(req: any, requested?: any) {
  const own = await resolveEmployeeId(req.user);
  if (requested !== undefined && (await getWorkflowAccess(req.user)).canApproveLeave) return id(requested);
  if (!own) throw new LeaveError('Employee access required', 403);
  if (requested !== undefined && id(requested) !== own) throw new LeaveError('You can only access your own employee record', 403);
  return own;
}
function readableEmployee(req: any, requested: any) {
  return req.user.role === 'admin' ? Promise.resolve(id(requested)) : ownEmployee(req, requested);
}
function adminRead(req: any) {
  if (req.user.role !== 'admin') throw new LeaveError('Admin access required', 403);
}
function inputDates(body: any, existing?: any) {
  const data = {
    startDate: isoDate(body.startDate ?? existing?.startDate),
    endDate: isoDate(body.endDate ?? existing?.endDate),
    halfDayStart: body.halfDayStart ?? existing?.halfDayStart ?? false,
    halfDayEnd: body.halfDayEnd ?? existing?.halfDayEnd ?? false
  };
  if (typeof data.halfDayStart !== 'boolean' || typeof data.halfDayEnd !== 'boolean') throw new LeaveError('Half-day values must be boolean');
  if (leaveDays(data) <= 0) throw new LeaveError('Choose at least half a working day for an absence');
  return data;
}
export async function lock(tx: any, employeeId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(7130, ${employeeId})`);
}
async function assertOpen(tx: any, request: any) {
  const {
    assertPayrollDatesOpen
  } = await import('../services/payroll.js');
  await assertPayrollDatesOpen(tx, request.employeeId, request.startDate, request.endDate);
}
export async function provision(tx: any, context: any, dates: any) {
  const today = timezoneLocalDate(new Date(), context.member.timezone);
  const cycles = new Map<string, ReturnType<typeof employmentCycleForDate>>();
  for (const day of leaveDaySegments(dates)) {
    const c = employmentCycleForDate(context.member.startDate, day.date);
    cycles.set(c.cycleStart, c);
  }
  for (const c of cycles.values()) {
    let row = context.cycles.find((r: any) => r.cycleStart === c.cycleStart);
    if (!row) {
      [row] = await tx.insert(employmentCycles).values({
        employeeId: context.member.id,
        cycleStart: c.cycleStart,
        cycleEnd: c.cycleEnd,
        cycleMidpoint: c.cycleMidpoint,
        isActive: c.cycleStart <= today && c.cycleEnd >= today
      }).returning();
    }
    for (const type of context.types) {
      const existing = context.balances.some((b: any) => b.employmentCycleId === row.id && b.leaveTypeId === type.id);
      if (!existing) await tx.insert(leaveBalances).values({
        employeeId: context.member.id,
        employmentCycleId: row.id,
        leaveTypeId: type.id,
        totalDays: String(configuredAllocation(context, type, c.careerYear)),
        adjustmentDays: '0'
      });
    }
  }
}
async function validate(tx: any, employeeId: number, leaveTypeId: number, dates: any, excludeId?: number) {
  const context = await assertLeaveRequestAllowed(tx, employeeId, leaveTypeId, dates, excludeId);
  if (context.requests.some((r: any) => r.id !== excludeId && ['pending', 'approved'].includes(r.status) && leaveOverlaps(r, dates))) throw new LeaveError('An overlapping pending or approved absence exists');
  return context;
}
async function audit(tx: any, request: any, actorId: number, before: any, note: string) {
  const [event] = await tx.insert(leaveRequestEvents).values({
    leaveRequestId: request.id,
    status: request.status,
    actorId,
    note: JSON.stringify({
      message: note,
      before,
      after: {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate,
        halfDayStart: request.halfDayStart,
        halfDayEnd: request.halfDayEnd,
        daysCount: request.daysCount,
        reason: request.reason,
        archivedAt: request.archivedAt
      }
    })
  }).returning({ id: leaveRequestEvents.id });
  return event.id;
}

function automaticSickApproval(context: any, leaveTypeId: number, dates: any, excludeRequestId?: number) {
  const sickTypeIds = context.types.filter((type: any) => isSickType(type.name)).map((type: any) => type.id);
  if (!sickTypeIds.includes(leaveTypeId)) return false;
  const totalDays = sickEpisodeDays(dates, context.requests, sickTypeIds, excludeRequestId);
  return totalDays > 0 && totalDays <= 2;
}

function isAutomaticSickRequest(request: any, type: any) {
  return isSickType(type?.name || '') && request.status === 'approved' && !request.decisionBy && request.decisionReason === SHORT_SICK_LEAVE_REASON;
}

async function notifyLeave(tx: any, request: any, context: any, eventId: number, action: string) {
  const employees = await tx.select({ id: users.id }).from(users).where(and(eq(users.teamMemberId, request.employeeId), eq(users.isActive, true)));
  const employeeIds = employees.map((user: any) => user.id);
  const managers = await workflowRecipients(tx);
  const type = context.types.find((type: any) => type.id === request.leaveTypeId);
  const automaticallyApproved = isAutomaticSickRequest(request, type);
  const status = action === 'archive' ? 'archived' : request.status;
  const body = `${context.member.name}: ${type?.name || 'Leave'}, ${request.startDate} – ${request.endDate} (${request.daysCount} working days). ${automaticallyApproved ? SHORT_SICK_LEAVE_REASON + '.' : `Status: ${status}.`}${request.status === 'pending' ? ' Awaiting Volodymyr or Patricia.' : ''}`;
  await queueWorkflowNotification(tx, {
    eventKey: `leave:${request.id}:event:${eventId}:employee`,
    recipientIds: employeeIds,
    title: automaticallyApproved ? 'Sick leave approved automatically' : `Leave request ${status}`,
    body,
    href: '/employee/vacations',
  });
  await queueWorkflowNotification(tx, {
    eventKey: `leave:${request.id}:event:${eventId}:managers`,
    recipientIds: managers.allIds.filter((userId: number) => !employeeIds.includes(userId)),
    title: request.status === 'pending' ? 'Leave request needs a decision' : `Leave ${status}: ${context.member.name}`,
    body,
    href: '/admin/vacation',
  });
}

async function create(req: any, explicitlyApprove = false) {
  if (explicitlyApprove) await admin(req);
  const employeeId = await ownEmployee(req, req.body.employeeId);
  const leaveTypeId = id(req.body.leaveTypeId);
  const dates = inputDates(req.body);
  return db.transaction(async tx => {
    await lock(tx, employeeId);
    const context = await validate(tx, employeeId, leaveTypeId, dates);
    const autoApprove = automaticSickApproval(context, leaveTypeId, dates);
    const approved = explicitlyApprove || autoApprove;
    if (approved) await assertOpen(tx, {
      ...dates,
      employeeId
    });
    await provision(tx, context, dates);
    const submittedAt = new Date();
    const [row] = await tx.insert(leaveRequests).values({
      ...dates,
      employeeId,
      leaveTypeId,
      daysCount: String(leaveDays(dates)),
      reason: String(req.body.reason || '').trim().slice(0, 10000) || null,
      requestedBy: req.user.id,
      status: approved ? 'approved' : 'pending',
      decisionRequestedAt: approved ? null : submittedAt,
      createdAt: submittedAt,
      decisionBy: explicitlyApprove ? req.user.id : null,
      decisionAt: approved ? new Date() : null,
      decisionReason: explicitlyApprove ? 'Approved by leave approver' : autoApprove ? SHORT_SICK_LEAVE_REASON : null
    }).returning();
    const eventId = await audit(tx, row, req.user.id, null, autoApprove && !explicitlyApprove ? 'Short sick leave automatically approved' : 'Request submitted');
    await notifyLeave(tx, row, context, eventId, 'created');
    return row;
  });
}
async function change(req: any, requestId: number, action: string) {
  const [initial] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestId));
  if (!initial) throw new LeaveError('Leave request not found', 404);
  const canApproveLeave = (await getWorkflowAccess(req.user)).canApproveLeave;
  if (!canApproveLeave) await ownEmployee(req, initial.employeeId);
  return db.transaction(async tx => {
    await lock(tx, initial.employeeId);
    const [existing] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, requestId));
    if (existing.archivedAt) throw new LeaveError('Request has been archived', 409);
    const context = await loadLeaveContext(existing.employeeId, tx);
    const today = timezoneLocalDate(new Date(), context.member.timezone);
    let values: any = {
      updatedAt: new Date()
    };
    if (action === 'edit') {
      if (!['pending', 'approved'].includes(existing.status)) throw new LeaveError('Closed requests are immutable; create a corrected request', 409);
      const existingType = context.types.find((type: any) => type.id === existing.leaveTypeId);
      if (!canApproveLeave && existing.status !== 'pending' && !isAutomaticSickRequest(existing, existingType)) throw new LeaveError('Only pending or automatically approved sick leave can be edited', 409);
      if (req.body.employeeId !== undefined && id(req.body.employeeId) !== existing.employeeId) throw new LeaveError('The employee of an existing request cannot be changed');
      const dates = inputDates(req.body, existing);
      const leaveTypeId = req.body.leaveTypeId === undefined ? existing.leaveTypeId : id(req.body.leaveTypeId);
      const updatedContext = await validate(tx, existing.employeeId, leaveTypeId, dates, existing.id);
      const unchangedCoverage = leaveTypeId === existing.leaveTypeId && dates.startDate === existing.startDate && dates.endDate === existing.endDate && dates.halfDayStart === existing.halfDayStart && dates.halfDayEnd === existing.halfDayEnd;
      const keepApproved = existing.status === 'approved' && (canApproveLeave || unchangedCoverage);
      const reviewedChange = keepApproved && canApproveLeave && !unchangedCoverage;
      const autoApprove = automaticSickApproval(updatedContext, leaveTypeId, dates, existing.id);
      const approved = keepApproved || autoApprove;
      const decisionRequestedAt = !approved && existing.status === 'approved' ? new Date() : existing.decisionRequestedAt;
      if (existing.status === 'approved') await assertOpen(tx, existing);
      if (existing.status === 'approved' || approved) {
        await assertOpen(tx, {
          ...dates,
          employeeId: existing.employeeId
        });
      }
      await provision(tx, updatedContext, dates);
      values = {
        ...values,
        ...dates,
        leaveTypeId,
        daysCount: String(leaveDays(dates)),
        reason: req.body.reason === undefined ? existing.reason : String(req.body.reason || '').trim().slice(0, 10000) || null,
        status: approved ? 'approved' : 'pending',
        decisionRequestedAt,
        decisionBy: reviewedChange ? req.user.id : keepApproved ? existing.decisionBy : null,
        decisionAt: reviewedChange ? new Date() : keepApproved ? existing.decisionAt : autoApprove ? new Date() : null,
        decisionReason: reviewedChange ? 'Updated and approved by leave approver' : keepApproved ? existing.decisionReason : autoApprove ? SHORT_SICK_LEAVE_REASON : null
      };
    } else if (action === 'approved' || action === 'denied') {
      await admin(req);
      if (existing.status !== 'pending') throw new LeaveError('Only pending requests can be decided', 409);
      if (action === 'approved') {
        await validate(tx, existing.employeeId, existing.leaveTypeId, existing, existing.id);
        await assertOpen(tx, existing);
      }
      values = {
        ...values,
        status: action,
        decisionBy: req.user.id,
        decisionAt: new Date(),
        decisionReason: String(req.body.decisionReason ?? req.body.reason ?? '').trim() || null
      };
    } else if (action === 'canceled' || action === 'archive') {
      if (action === 'archive' && !['pending', 'denied', 'canceled'].includes(existing.status)) throw new LeaveError('Cancel the approved request before archiving it', 409);
      if (action === 'canceled' && !['pending', 'approved'].includes(existing.status)) throw new LeaveError('Only pending or approved requests can be canceled', 409);
      if (existing.status === 'approved') {
        if (!canApproveLeave && existing.startDate <= today) throw new LeaveError('Only a leave approver can cancel an absence that has already started', 403);
        await assertOpen(tx, existing);
      }
      values = {
        ...values,
        status: existing.status === 'pending' || action === 'canceled' ? 'canceled' : existing.status,
        ...(action === 'archive' ? {
          archivedAt: new Date()
        } : {}),
        decisionReason: String(req.body?.reason || existing.decisionReason || '').trim() || null
      };
    } else throw new LeaveError('Invalid leave action');
    const [row] = await tx.update(leaveRequests).set(values).where(eq(leaveRequests.id, existing.id)).returning();
    const eventId = await audit(tx, row, req.user.id, existing, action);
    await notifyLeave(tx, row, context, eventId, action);
    return row;
  });
}
async function requestRows(req: any, employeeId?: number) {
  const conditions: any[] = [isNull(leaveRequests.archivedAt)];
  if (employeeId) conditions.push(eq(leaveRequests.employeeId, employeeId));
  if (req.query.status) conditions.push(eq(leaveRequests.status, String(req.query.status)));
  if (req.query.startDate && req.query.endDate) {
    conditions.push(sql`${leaveRequests.startDate} <= ${isoDate(String(req.query.endDate))} AND ${leaveRequests.endDate} >= ${isoDate(String(req.query.startDate))}`);
  }
  if (req.query.clientId) {
    adminRead(req);
    const assignments = await db.select({
      employeeId: clientServiceTeamMembers.teamMemberId
    }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).where(eq(clientServices.clientId, id(req.query.clientId)));
    if (!assignments.length) return [];
    conditions.push(inArray(leaveRequests.employeeId, assignments.map(a => a.employeeId)));
  }
  const rows = await db.select({
    request: leaveRequests,
    leaveType: leaveTypes,
    employee: teamMembers
  }).from(leaveRequests).innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id)).innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id)).where(and(...conditions));
  const actors = await db.select({
    id: users.id,
    username: users.username,
    fullName: users.fullName,
    email: users.email
  }).from(users).where(inArray(users.id, [...new Set(rows.flatMap(r => [r.request.requestedBy, r.request.decisionBy].filter(Boolean)))]));
  return rows.sort((a, b) => b.request.createdAt.getTime() - a.request.createdAt.getTime()).map(row => {
    const target = employmentCycleForDate(row.employee.startDate, row.request.startDate);
    const today = timezoneLocalDate(new Date(), row.employee.timezone);
    const current = employmentCycleForDate(row.employee.startDate, today < row.employee.startDate ? row.employee.startDate : today);
    return {
      ...row,
      requestedBy: actors.find(a => a.id === row.request.requestedBy) || null,
      decisionBy: actors.find(a => a.id === row.request.decisionBy) || null,
      isOldCycle: target.cycleEnd < current.cycleStart,
      isFutureCycle: target.cycleStart > current.cycleEnd,
      cycleInfo: {
        ...target,
        isActive: target.cycleStart <= today && target.cycleEnd >= today
      },
      canEdit: row.request.status === 'pending' || isAutomaticSickRequest(row.request, row.leaveType),
      canCancel: row.request.status === 'pending' || row.request.status === 'approved' && row.request.startDate > today,
      canArchive: ['canceled', 'denied'].includes(row.request.status)
    };
  });
}
router.get('/my-profile', wrap(async (req: any, res: any) => {
  const employeeId = await ownEmployee(req);
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
  res.json(member);
}));
router.get('/my-balance', wrap(async (req: any, res: any) => res.json(await calculateVacationBalance(await ownEmployee(req)))));
router.get('/my-sick-leave-balance', wrap(async (req: any, res: any) => res.json(await calculateSickLeaveBalance(await ownEmployee(req)))));
router.get('/sick-leave-balance/:employeeId', wrap(async (req: any, res: any) => res.json(await calculateSickLeaveBalance(await readableEmployee(req, req.params.employeeId)))));
router.get('/balance/:employeeId', wrap(async (req: any, res: any) => res.json(await calculateVacationBalance(await readableEmployee(req, req.params.employeeId)))));
router.get('/my-requests', wrap(async (req: any, res: any) => {
  const rows = await requestRows(req, await ownEmployee(req));
  res.json(rows.map(({
    request,
    leaveType,
    ...rest
  }: any) => ({
    ...request,
    totalDays: Number(request.daysCount),
    type: leaveType.name,
    decisionNote: request.decisionReason,
    ...rest
  })));
}));
router.get('/requests', wrap(async (req: any, res: any) => {
  adminRead(req);
  res.json(await requestRows(req, req.query.employeeId ? id(req.query.employeeId) : undefined));
}));
router.get('/requests/:employeeId', wrap(async (req: any, res: any) => res.json(await requestRows(req, await readableEmployee(req, req.params.employeeId)))));
router.get('/employment-cycle/:employeeId', wrap(async (req: any, res: any) => {
  const context = await loadLeaveContext(await readableEmployee(req, req.params.employeeId));
  const today = timezoneLocalDate(new Date(), context.member.timezone);
  const cycle = employmentCycleForDate(context.member.startDate, today < context.member.startDate ? context.member.startDate : today);
  res.json({
    ...cycle,
    id: context.cycles.find((c: any) => c.cycleStart === cycle.cycleStart)?.id || 0,
    employeeId: context.member.id,
    isActive: cycle.cycleStart <= today && cycle.cycleEnd >= today
  });
}));
router.get(['/balances/:employeeId', '/employees/:employeeId/balances', '/balances/summary/:employeeId'], wrap(async (req: any, res: any) => {
  const context = await loadLeaveContext(await readableEmployee(req, req.params.employeeId));
  const today = timezoneLocalDate(new Date(), context.member.timezone);
  const balances = context.types.map((type: any) => summarizeLeave(context, type, today));
  if (req.path.startsWith('/employees/')) return res.json(balances.map(b => ({
    leaveTypeName: b.leaveType,
    leaveTypeId: b.leaveTypeId,
    totalDays: String(b.allocated),
    usedDays: b.totalUsed,
    pendingDays: b.pendingDays,
    adjustmentDays: String(b.adjustments),
    availableDays: String(b.totalRemaining)
  })));
  const mapped = balances.map(b => ({
    leaveType: b.leaveType,
    leaveTypeId: b.leaveTypeId,
    totalAllocated: b.allocated,
    used: b.totalUsed,
    pending: b.pendingDays,
    adjustments: b.adjustments,
    available: b.totalRemaining
  }));
  if (req.path.startsWith('/balances/summary/')) return res.json(mapped);
  const cycle = balances[0];
  res.json({
    employmentCycle: cycle ? {
      id: cycle.cycleId,
      cycleStart: cycle.cycleStartDate,
      cycleEnd: cycle.cycleEndDate,
      cycleMidpoint: cycle.cycleMidpointDate
    } : null,
    balances: mapped
  });
}));
router.post('/requests', wrap(async (req: any, res: any) => res.json(await create(req))));
router.post('/admin/create-and-approve', wrap(async (req: any, res: any) => {
  await admin(req);
  res.json(await create(req, req.body.autoApprove === true));
}));
router.put('/requests/:requestId', wrap(async (req: any, res: any) => res.json(await change(req, id(req.params.requestId), 'edit'))));
router.put('/requests/:requestId/status', wrap(async (req: any, res: any) => {
  await admin(req);
  if (!['approved', 'denied'].includes(req.body.status)) throw new LeaveError('Invalid status');
  res.json(await change(req, id(req.params.requestId), req.body.status));
}));
router.put('/requests/:requestId/cancel', wrap(async (req: any, res: any) => res.json(await change(req, id(req.params.requestId), 'canceled'))));
router.delete('/requests/:requestId', wrap(async (req: any, res: any) => {
  await change(req, id(req.params.requestId), 'archive');
  res.json({
    success: true,
    message: 'Request archived; audit history retained'
  });
}));
router.post('/admin/requests/bulk-action', wrap(async (req: any, res: any) => {
  await admin(req);
  const {
    requestIds,
    action
  } = req.body;
  if (!Array.isArray(requestIds) || requestIds.length < 1 || requestIds.length > 500 || !['approve', 'deny', 'cancel'].includes(action)) throw new LeaveError('Invalid bulk action');
  const results = [];
  for (const requestId of [...new Set(requestIds)]) try {
    const row = await change(req, id(requestId), action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'canceled');
    results.push({
      requestId,
      success: true,
      newStatus: row.status
    });
  } catch (error) {
    results.push({
      requestId,
      success: false,
      error: (error as Error).message
    });
  }
  res.json({
    results,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
}));
router.delete('/admin/requests/bulk-delete', wrap(async (req: any, res: any) => {
  await admin(req);
  if (!Array.isArray(req.body.requestIds) || req.body.requestIds.length > 500) throw new LeaveError('Invalid request IDs');
  const results = [];
  for (const requestId of [...new Set(req.body.requestIds)]) try {
    await change(req, id(requestId), 'archive');
    results.push({
      requestId,
      success: true
    });
  } catch (error) {
    results.push({
      requestId,
      success: false,
      error: (error as Error).message
    });
  }
  res.json({
    results,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
}));
export default router;
