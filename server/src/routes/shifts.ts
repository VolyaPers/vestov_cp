import { Router } from 'express';
import { db } from '../db/index.js';
import { shifts, shiftBreaks, shiftSchedules, shiftScheduleOverrides, teamMembers, clientServices, serviceTypes, clientServiceTeamMembers, clients, leaveRequests, leaveTypes } from '../db/schema.js';
import { eq, and, isNull, desc, gte, lte, lt, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { resolveEmployeeId } from '../services/access.js';
import { resolveClientScope, coversDate, overlapsPeriod } from '../services/clientWorkspace.js';
import { notifyShiftEvent, notifyShiftOverride } from '../utils/slack.js';
import { emitShiftStarted, emitShiftEnded, emitBreakStarted, emitBreakEnded } from '../socket.js';
import { addDays, dateRange, getEffectiveDay, isoDate, timezoneLocalDate, validTime, validTimezone, weekday, zonedDateTime, shiftWorkMinutes } from '../utils/calendar.js';
const router = Router();
router.use(requireAuth);
class ShiftError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
const wrap = (fn: any) => (req: any, res: any) => Promise.resolve(fn(req, res)).catch((e: any) => {
  if (!res.headersSent) res.status(e.status || 400).json({
    error: e.message || 'Shift operation failed'
  });
});
const id = (value: any) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new ShiftError('Invalid identifier');
  return n;
};
const note = (value: any) => typeof value === 'string' ? value.trim().slice(0, 10000) || null : null;
function admin(req: any) {
  if (req.user.role !== 'admin') throw new ShiftError('Admin access required', 403);
}
async function employee(req: any) {
  const employeeId = await resolveEmployeeId(req.user);
  if (!employeeId) throw new ShiftError('Linked employee profile required', 403);
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
  return member;
}
async function lock(tx: any, employeeId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(7130, ${employeeId})`);
}
async function current(tx: any, employeeId: number) {
  const [shift] = await tx.select().from(shifts).where(and(eq(shifts.employeeId, employeeId), isNull(shifts.endTime))).orderBy(desc(shifts.startTime));
  return shift;
}
async function currentBreak(tx: any, shiftId: number) {
  const [pause] = await tx.select().from(shiftBreaks).where(and(eq(shiftBreaks.shiftId, shiftId), isNull(shiftBreaks.endTime)));
  return pause;
}
function notifyCommitted(input: any, serviceId: number | null) {
  void channelFor(serviceId).then(channelId => notifyShiftEvent({
    ...input,
    channelId
  })).catch(error => console.error('Shift notification failed after commit', error.message));
}
async function channelFor(serviceId: number | null) {
  if (!serviceId) return undefined;
  const [service] = await db.select({
    channel: clientServices.slackChannelId
  }).from(clientServices).where(eq(clientServices.id, serviceId));
  return service?.channel || undefined;
}
async function effectiveDay(tx: any, member: any, date: string) {
  const [schedule] = await tx.select().from(shiftSchedules).where(and(eq(shiftSchedules.employeeId, member.id), eq(shiftSchedules.dayOfWeek, weekday(date)), eq(shiftSchedules.isActive, true)));
  const [override] = await tx.select().from(shiftScheduleOverrides).where(and(eq(shiftScheduleOverrides.employeeId, member.id), eq(shiftScheduleOverrides.overrideDate, date)));
  const leaves = await tx.select({
    startDate: leaveRequests.startDate,
    endDate: leaveRequests.endDate,
    halfDayStart: leaveRequests.halfDayStart,
    halfDayEnd: leaveRequests.halfDayEnd,
    status: leaveRequests.status,
    leaveType: leaveTypes.name
  }).from(leaveRequests).innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id)).where(and(eq(leaveRequests.employeeId, member.id), eq(leaveRequests.status, 'approved'), lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date)));
  return {
    schedule,
    day: getEffectiveDay({
      date,
      timezone: member.timezone,
      schedule,
      override,
      leaves
    })
  };
}
async function startDay(tx: any, member: any, now: Date) {
  const date = timezoneLocalDate(now, member.timezone);
  const today = await effectiveDay(tx, member, date);
  const yesterday = await effectiveDay(tx, member, addDays(date, -1));
  if (yesterday.day.startAt && yesterday.day.endAt && new Date(yesterday.day.startAt) <= now && new Date(yesterday.day.endAt) > now) return yesterday;
  return today;
}
function monthRange(month?: any) {
  if (!month) {
    const date = timezoneLocalDate();
    return {
      start: date,
      end: date
    };
  }
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new ShiftError('Month must use YYYY-MM');
  const start = isoDate(`${month}-01`);
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const end = addDays(d.toISOString().slice(0, 10), -1);
  return {
    start,
    end
  };
}
async function scopedEmployeeIds(req: any, res: any): Promise<number[] | null> {
  if (req.user.role === 'admin' && !req.query.clientId) return null;
  const clientId = await resolveClientScope(req, res);
  if (clientId === null) return [];
  const range = monthRange(req.query.month);
  const rows = await db.select({
    assignment: clientServiceTeamMembers,
    service: clientServices,
    employee: teamMembers
  }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id)).where(eq(clientServices.clientId, clientId));
  return [...new Set(rows.filter(r => overlapsPeriod(r.assignment, range.start, range.end) && overlapsPeriod(r.service, range.start, range.end)).map(r => r.employee.id))];
}
const publicEmployee = (m: any) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  avatarUrl: m.avatarUrl,
  position: m.position,
  timezone: m.timezone,
  status: m.status
});
router.get('/current', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const shift = await current(db, member.id);
  res.json({
    shift: shift || null,
    hasActiveShift: !!shift,
    activeBreak: shift ? (await currentBreak(db, shift.id)) || null : null
  });
}));
router.get('/my-services', wrap(async (req: any, res: any) => {
  const employeeId = await resolveEmployeeId(req.user);
  if (!employeeId) return res.json({
    services: [],
    hasTeamMember: false
  });
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
  const today = timezoneLocalDate(new Date(), member.timezone);
  const rows = await db.select({
    assignment: clientServiceTeamMembers,
    service: clientServices,
    type: serviceTypes,
    client: clients
  }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).innerJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id)).innerJoin(clients, eq(clientServices.clientId, clients.id)).where(eq(clientServiceTeamMembers.teamMemberId, employeeId));
  res.json({
    hasTeamMember: true,
    employeeId,
    timezone: member.timezone,
    localDayOfWeek: weekday(today),
    localDate: today,
    services: rows.filter(r => coversDate(r.assignment, today) && coversDate(r.service, today)).map(r => ({
      serviceId: r.service.id,
      serviceName: r.type.name,
      clientName: r.client.name,
      employmentType: r.assignment.employmentType,
      workSchedule: r.assignment.workSchedule,
      serviceTitle: r.service.serviceTitle
    }))
  });
}));
router.post('/start', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const result = await db.transaction(async tx => {
    await lock(tx, member.id);
    const existing = await current(tx, member.id);
    if (existing) return {
      shift: existing,
      created: false
    };
    const now = new Date();
    const {
      schedule,
      day
    } = await startDay(tx, member, now);
    let serviceId: number | null = null;
    if (req.body.serviceId) {
      serviceId = id(req.body.serviceId);
      const rows = await tx.select({
        assignment: clientServiceTeamMembers,
        service: clientServices
      }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).where(and(eq(clientServiceTeamMembers.teamMemberId, member.id), eq(clientServiceTeamMembers.clientServiceId, serviceId)));
      if (!rows.some(r => coversDate(r.assignment, day.date) && coversDate(r.service, day.date))) throw new ShiftError('You are not assigned to this active service', 403);
    }
    const lateMinutes = day.expectedStartAt ? Math.max(0, Math.floor((now.getTime() - Date.parse(day.expectedStartAt)) / 60000)) : 0;
    const [shift] = await tx.insert(shifts).values({
      employeeId: member.id,
      scheduleId: schedule?.id || null,
      serviceId,
      startTime: now,
      status: 'active',
      isLate: lateMinutes > 5,
      lateMinutes,
      notes: note(req.body.comment),
      workDate: day.date,
      timezone: validTimezone(member.timezone),
      scheduledStartAt: day.expectedStartAt ? new Date(day.expectedStartAt) : null,
      scheduledEndAt: day.endAt ? new Date(day.endAt) : null
    } as any).returning();
    return {
      shift,
      created: true
    };
  });
  if (result.created) {
    const shift = result.shift;
    notifyCommitted({
      event: 'shift_started',
      employeeName: member.name,
      employeeEmail: member.email,
      shiftId: shift.id,
      comment: shift.notes || undefined,
      timestamp: shift.startTime
    }, shift.serviceId);
    emitShiftStarted({
      shiftId: shift.id,
      employeeId: member.id,
      employeeName: member.name,
      employeeEmail: member.email,
      serviceId: shift.serviceId || undefined,
      timestamp: shift.startTime.toISOString()
    });
  }
  res.json({
    shift: result.shift,
    message: result.created ? 'Shift started' : 'Shift is already active'
  });
}));
router.post('/end', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const result = await db.transaction(async tx => {
    await lock(tx, member.id);
    const shift = await current(tx, member.id);
    if (!shift) return null;
    const now = new Date();
    await tx.update(shiftBreaks).set({
      endTime: now
    }).where(and(eq(shiftBreaks.shiftId, shift.id), isNull(shiftBreaks.endTime)));
    const [ended] = await tx.update(shifts).set({
      endTime: now,
      status: 'completed',
      updatedAt: now
    }).where(and(eq(shifts.id, shift.id), isNull(shifts.endTime))).returning();
    return ended;
  });
  if (result) {
    notifyCommitted({
      event: 'shift_ended',
      employeeName: member.name,
      employeeEmail: member.email,
      shiftId: result.id,
      timestamp: result.endTime!
    }, result.serviceId);
    emitShiftEnded({
      shiftId: result.id,
      employeeId: member.id,
      employeeName: member.name,
      employeeEmail: member.email,
      timestamp: result.endTime!.toISOString()
    });
  }
  res.json({
    shift: result,
    message: result ? 'Shift ended' : 'No active shift'
  });
}));
router.post('/break/start', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const result = await db.transaction(async tx => {
    await lock(tx, member.id);
    const shift = await current(tx, member.id);
    if (!shift) throw new ShiftError('Start a shift before taking a break', 409);
    const existing = await currentBreak(tx, shift.id);
    if (existing) return {
      pause: existing,
      shift,
      created: false
    };
    const breakType = req.body.breakType || 'regular';
    if (!['regular', 'lunch', 'other'].includes(breakType)) throw new ShiftError('Invalid break type');
    const [pause] = await tx.insert(shiftBreaks).values({
      shiftId: shift.id,
      startTime: new Date(),
      breakType,
      notes: note(req.body.description ?? req.body.note ?? req.body.breakNote)
    }).returning();
    await tx.update(shifts).set({
      status: 'on_break',
      updatedAt: new Date()
    }).where(eq(shifts.id, shift.id));
    return {
      pause,
      shift,
      created: true
    };
  });
  if (result.created) {
    const {
      shift,
      pause
    } = result;
    notifyCommitted({
      event: 'break_started',
      employeeName: member.name,
      employeeEmail: member.email,
      shiftId: shift.id,
      breakType: pause.breakType,
      breakNote: pause.notes || undefined,
      timestamp: pause.startTime
    }, shift.serviceId);
    emitBreakStarted({
      breakId: pause.id,
      shiftId: shift.id,
      employeeId: member.id,
      employeeName: member.name,
      employeeEmail: member.email,
      breakType: pause.breakType,
      breakNote: pause.notes || undefined,
      timestamp: pause.startTime.toISOString()
    });
  }
  res.json({
    break: result.pause,
    message: result.created ? 'Break started' : 'Break is already active'
  });
}));
router.post('/break/end', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const result = await db.transaction(async tx => {
    await lock(tx, member.id);
    const shift = await current(tx, member.id);
    if (!shift) return null;
    const pause = await currentBreak(tx, shift.id);
    if (!pause) return null;
    const [ended] = await tx.update(shiftBreaks).set({
      endTime: new Date()
    }).where(and(eq(shiftBreaks.id, pause.id), isNull(shiftBreaks.endTime))).returning();
    await tx.update(shifts).set({
      status: 'active',
      updatedAt: new Date()
    }).where(and(eq(shifts.id, shift.id), isNull(shifts.endTime)));
    return {
      shift,
      pause: ended
    };
  });
  if (result) {
    const {
      shift,
      pause
    } = result;
    notifyCommitted({
      event: 'break_ended',
      employeeName: member.name,
      employeeEmail: member.email,
      shiftId: shift.id,
      timestamp: pause.endTime!
    }, shift.serviceId);
    emitBreakEnded({
      breakId: pause.id,
      shiftId: shift.id,
      employeeId: member.id,
      employeeName: member.name,
      employeeEmail: member.email,
      timestamp: pause.endTime!.toISOString()
    });
  }
  res.json({
    break: result?.pause || null,
    message: result ? 'Break ended' : 'No active break'
  });
}));
async function enrich(rows: any[], privateFields = true) {
  const ids = rows.map(r => r.shift?.id || r.id);
  const breaks = ids.length ? await db.select().from(shiftBreaks).where(inArray(shiftBreaks.shiftId, ids)) : [];
  return rows.map(row => {
    const shift = row.shift || row;
    const pauses = breaks.filter(b => b.shiftId === shift.id);
    const {
      breakMinutes,
      workingMinutes
    } = shiftWorkMinutes(shift, pauses);
    const base = privateFields ? shift : {
      id: shift.id,
      employeeId: shift.employeeId,
      serviceId: shift.serviceId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      workDate: shift.workDate,
      timezone: shift.timezone
    };
    return {
      ...base,
      ...(row.employee ? {
        employee: publicEmployee(row.employee)
      } : {}),
      breakMinutes,
      workingMinutes,
      activeBreak: pauses.find(b => !b.endTime) ? privateFields ? pauses.find(b => !b.endTime) : {
        id: pauses.find(b => !b.endTime)!.id,
        startTime: pauses.find(b => !b.endTime)!.startTime
      } : null,
      ...(privateFields ? {
        breaks: pauses
      } : {})
    };
  });
}
router.get('/history', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const conditions: any[] = [eq(shifts.employeeId, member.id)];
  if (req.query.startDate) conditions.push(gte(shifts.startTime, zonedDateTime(isoDate(req.query.startDate), '00:00', member.timezone)));
  if (req.query.endDate) conditions.push(lt(shifts.startTime, zonedDateTime(addDays(isoDate(req.query.endDate), 1), '00:00', member.timezone)));
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const rows = await db.select().from(shifts).where(and(...conditions)).orderBy(desc(shifts.startTime)).limit(limit);
  res.json({
    shifts: await enrich(rows)
  });
}));
router.get('/admin/active', wrap(async (req: any, res: any) => {
  admin(req);
  const rows = await db.select({
    shift: shifts,
    employee: teamMembers
  }).from(shifts).innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id)).where(isNull(shifts.endTime));
  res.json({
    shifts: await enrich(rows)
  });
}));
router.get('/admin/history', wrap(async (req: any, res: any) => {
  admin(req);
  const conditions: any[] = [];
  if (req.query.employeeId) conditions.push(eq(shifts.employeeId, id(req.query.employeeId)));
  if (req.query.startDate) conditions.push(gte(shifts.startTime, new Date(`${isoDate(req.query.startDate)}T00:00:00Z`)));
  if (req.query.endDate) conditions.push(lt(shifts.startTime, new Date(`${addDays(isoDate(req.query.endDate), 1)}T00:00:00Z`)));
  const rows = await db.select({
    shift: shifts,
    employee: teamMembers
  }).from(shifts).innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id)).where(and(...conditions)).orderBy(desc(shifts.startTime)).limit(Math.min(1000, Math.max(1, Number(req.query.limit) || 100)));
  const enriched = await enrich(rows);
  res.json({
    shifts: enriched.map((r, i) => ({
      shift: r,
      employee: publicEmployee(rows[i].employee)
    }))
  });
}));
router.get('/admin/late', wrap(async (req: any, res: any) => {
  admin(req);
  const now = new Date();
  const members = await db.select().from(teamMembers).where(sql`${teamMembers.status} <> 'inactive'`);
  const lateShifts: any[] = [],
    missedShifts: any[] = [];
  for (const member of members) {
    const {
      schedule,
      day
    } = await startDay(db, member, now);
    const midnight = zonedDateTime(day.date, '00:00', member.timezone);
    const end = day.endAt ? new Date(Math.max(Date.parse(day.endAt), zonedDateTime(addDays(day.date, 1), '00:00', member.timezone).getTime())) : zonedDateTime(addDays(day.date, 1), '00:00', member.timezone);
    const facts = await db.select().from(shifts).where(and(eq(shifts.employeeId, member.id), gte(shifts.startTime, midnight), lt(shifts.startTime, end)));
    const matching = facts.filter((shift: any) => !shift.workDate || shift.workDate === day.date);
    for (const shift of matching) if (shift.isLate) lateShifts.push({
      shift,
      employee: publicEmployee(member)
    });
    if (day.workingMinutes > 0 && day.expectedStartAt && now.getTime() > Date.parse(day.expectedStartAt) + 5 * 60000 && matching.length === 0) missedShifts.push({
      schedule: {
        ...schedule,
        startTime: day.startTime,
        endTime: day.endTime,
        workDate: day.date
      },
      employee: publicEmployee(member)
    });
  }
  res.json({
    lateShifts,
    missedShifts
  });
}));
router.get('/client/team', wrap(async (req: any, res: any) => {
  const clientId = await resolveClientScope(req, res);
  if (clientId === null) return;
  const rows = await db.select({
    assignment: clientServiceTeamMembers,
    service: clientServices,
    employee: teamMembers
  }).from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id)).innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id)).where(eq(clientServices.clientId, clientId));
  const assignments = rows.filter(r => {
    const today = timezoneLocalDate(new Date(), r.employee.timezone);
    return coversDate(r.assignment, today) && coversDate(r.service, today);
  });
  if (!assignments.length) return res.json({
    shifts: []
  });
  const facts = await db.select({
    shift: shifts,
    employee: teamMembers
  }).from(shifts).innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id)).where(and(inArray(shifts.employeeId, [...new Set(assignments.map(r => r.employee.id))]), isNull(shifts.endTime)));
  const visible = facts.filter(r => !r.shift.serviceId || assignments.some(a => a.assignment.teamMemberId === r.employee.id && a.service.id === r.shift.serviceId));
  res.json({
    shifts: await enrich(visible, false)
  });
}));
router.put('/timezone/me', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const timezone = validTimezone(req.body.timezone);
  await db.update(teamMembers).set({
    timezone,
    updatedAt: new Date()
  }).where(eq(teamMembers.id, member.id));
  res.json({
    timezone
  });
}));
async function readSchedules(employeeId: number) {
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
  if (!member) throw new ShiftError('Employee not found', 404);
  const schedules = await db.select().from(shiftSchedules).where(and(eq(shiftSchedules.employeeId, employeeId), eq(shiftSchedules.isActive, true))).orderBy(shiftSchedules.dayOfWeek);
  return {
    schedules,
    timezone: member.timezone,
    employeeName: member.name
  };
}
async function saveSchedules(employeeId: number, raw: any) {
  if (!Array.isArray(raw) || raw.length > 7) throw new ShiftError('Provide up to seven daily schedules');
  const days = new Set<number>();
  const validated = raw.map(s => {
    if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6 || days.has(s.dayOfWeek)) throw new ShiftError('Each weekday can occur once (0–6)');
    days.add(s.dayOfWeek);
    if (typeof s.isActive !== 'boolean') throw new ShiftError('isActive must be boolean');
    return {
      dayOfWeek: s.dayOfWeek,
      startTime: validTime(s.startTime),
      endTime: validTime(s.endTime),
      isActive: s.isActive
    };
  });
  await db.transaction(async tx => {
    await lock(tx, employeeId);
    const [member] = await tx.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
    if (!member) throw new ShiftError('Employee not found', 404);
    const existing = await tx.select().from(shiftSchedules).where(eq(shiftSchedules.employeeId, employeeId)).orderBy(desc(shiftSchedules.id));
    // Keep referenced IDs and history; disable removed weekdays instead of deleting FK targets.
    await tx.update(shiftSchedules).set({
      isActive: false,
      updatedAt: new Date()
    }).where(eq(shiftSchedules.employeeId, employeeId));
    for (const s of validated) {
      const row = existing.find(r => r.dayOfWeek === s.dayOfWeek && r.isActive) || existing.find(r => r.dayOfWeek === s.dayOfWeek);
      if (row) await tx.update(shiftSchedules).set({
        ...s,
        updatedAt: new Date()
      }).where(eq(shiftSchedules.id, row.id));else await tx.insert(shiftSchedules).values({
        ...s,
        employeeId
      });
    }
  });
  return readSchedules(employeeId);
}
router.get('/preferred/me', wrap(async (req: any, res: any) => res.json(await readSchedules((await employee(req)).id))));
router.put('/preferred/me', wrap(async (req: any, res: any) => res.json(await saveSchedules((await employee(req)).id, req.body.schedules))));
router.get('/preferred', wrap(async (req: any, res: any) => {
  const ids = await scopedEmployeeIds(req, res);
  if (res.headersSent) return;
  const conditions: any[] = [eq(shiftSchedules.isActive, true)];
  if (ids !== null) {
    if (!ids.length) return res.json({
      members: []
    });
    conditions.push(inArray(shiftSchedules.employeeId, ids));
  }
  const rows = await db.select({
    schedule: shiftSchedules,
    employee: teamMembers
  }).from(shiftSchedules).innerJoin(teamMembers, eq(shiftSchedules.employeeId, teamMembers.id)).where(and(...conditions)).orderBy(teamMembers.name, shiftSchedules.dayOfWeek);
  const map = new Map<number, any>();
  for (const row of rows) {
    if (!map.has(row.employee.id)) map.set(row.employee.id, {
      employee: publicEmployee(row.employee),
      schedules: []
    });
    map.get(row.employee.id).schedules.push(row.schedule);
  }
  res.json({
    members: [...map.values()]
  });
}));
router.get('/preferred/:employeeId', wrap(async (req: any, res: any) => {
  const employeeId = id(req.params.employeeId);
  const ids = await scopedEmployeeIds(req, res);
  if (res.headersSent) return;
  if (ids !== null && !ids.includes(employeeId)) throw new ShiftError('Employee is outside this client workspace', 403);
  res.json(await readSchedules(employeeId));
}));
router.put('/preferred/:employeeId', wrap(async (req: any, res: any) => {
  admin(req);
  res.json(await saveSchedules(id(req.params.employeeId), req.body.schedules));
}));
router.get('/admin/schedules/:employeeId', wrap(async (req: any, res: any) => {
  admin(req);
  res.json(await readSchedules(id(req.params.employeeId)));
}));
router.post('/admin/schedules', wrap(async (req: any, res: any) => {
  admin(req);
  const employeeId = id(req.body.employeeId);
  const old = await readSchedules(employeeId);
  const day = Number(req.body.dayOfWeek);
  const updated = await saveSchedules(employeeId, [...old.schedules.filter(s => s.dayOfWeek !== day), {
    dayOfWeek: day,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    isActive: true
  }]);
  res.json({
    schedule: updated.schedules.find(s => s.dayOfWeek === day)
  });
}));
async function calendarMembers(members: any[], start: string, end: string) {
  const ids = members.map(m => m.id);
  if (!ids.length) return [];
  const schedules = await db.select().from(shiftSchedules).where(and(inArray(shiftSchedules.employeeId, ids), eq(shiftSchedules.isActive, true)));
  const overrides = await db.select().from(shiftScheduleOverrides).where(and(inArray(shiftScheduleOverrides.employeeId, ids), gte(shiftScheduleOverrides.overrideDate, start), lte(shiftScheduleOverrides.overrideDate, end)));
  const leaves = await db.select({
    request: leaveRequests,
    type: leaveTypes
  }).from(leaveRequests).innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id)).where(and(inArray(leaveRequests.employeeId, ids), eq(leaveRequests.status, 'approved'), isNull(leaveRequests.archivedAt), lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start)));
  return members.map(member => ({
    employee: publicEmployee(member),
    days: dateRange(start, end).map(date => getEffectiveDay({
      date,
      timezone: member.timezone,
      schedule: date < member.startDate ? undefined : schedules.find(s => s.employeeId === member.id && s.dayOfWeek === weekday(date)),
      override: date < member.startDate ? undefined : overrides.find(o => o.employeeId === member.id && o.overrideDate === date),
      leaves: leaves.filter(l => l.request.employeeId === member.id).map(l => ({
        ...l.request,
        leaveType: l.type.name
      }))
    }))
  }));
}
router.get('/calendar/me', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const localDate = timezoneLocalDate(new Date(), member.timezone);
  const {
    start,
    end
  } = req.query.month ? monthRange(req.query.month) : {
    start: localDate,
    end: localDate
  };
  const [calendar] = await calendarMembers([member], start, end);
  res.json({
    employeeId: member.id,
    timezone: validTimezone(member.timezone),
    days: calendar.days
  });
}));
router.get('/calendar/all', wrap(async (req: any, res: any) => {
  admin(req);
  const {
      start,
      end
    } = monthRange(req.query.month),
    ids = await scopedEmployeeIds(req, res);
  if (res.headersSent) return;
  const conditions: any[] = [eq(teamMembers.status, 'active')];
  if (ids !== null) conditions.push(inArray(teamMembers.id, ids));
  const members = await db.select().from(teamMembers).where(and(...conditions));
  res.json({
    members: await calendarMembers(members, start, end)
  });
}));
router.get('/overrides/me', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const conditions: any[] = [eq(shiftScheduleOverrides.employeeId, member.id)];
  if (req.query.month) {
    const {
      start,
      end
    } = monthRange(req.query.month);
    conditions.push(gte(shiftScheduleOverrides.overrideDate, start), lte(shiftScheduleOverrides.overrideDate, end));
  }
  res.json({
    overrides: await db.select().from(shiftScheduleOverrides).where(and(...conditions))
  });
}));
router.put('/overrides/me/:date', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const date = isoDate(req.params.date);
  const isDayOff = req.body.isDayOff ?? false;
  if (typeof isDayOff !== 'boolean') throw new ShiftError('isDayOff must be boolean');
  const values = {
    startTime: isDayOff ? '00:00' : validTime(req.body.startTime),
    endTime: isDayOff ? '00:00' : validTime(req.body.endTime),
    isDayOff,
    updatedAt: new Date()
  };
  await db.transaction(async tx => {
    await lock(tx, member.id);
    const [existing] = await tx.select().from(shiftScheduleOverrides).where(and(eq(shiftScheduleOverrides.employeeId, member.id), eq(shiftScheduleOverrides.overrideDate, date)));
    if (existing) await tx.update(shiftScheduleOverrides).set(values).where(eq(shiftScheduleOverrides.id, existing.id));else await tx.insert(shiftScheduleOverrides).values({
      ...values,
      employeeId: member.id,
      overrideDate: date
    });
  });
  notifyShiftOverride({
    employeeName: member.name,
    employeeEmail: member.email,
    date,
    ...values,
    action: 'updated'
  }).catch(() => {});
  res.json({
    success: true
  });
}));
router.delete('/overrides/me/:date', wrap(async (req: any, res: any) => {
  const member = await employee(req);
  const date = isoDate(req.params.date);
  await db.transaction(async tx => {
    await lock(tx, member.id);
    await tx.delete(shiftScheduleOverrides).where(and(eq(shiftScheduleOverrides.employeeId, member.id), eq(shiftScheduleOverrides.overrideDate, date)));
  });
  notifyShiftOverride({
    employeeName: member.name,
    employeeEmail: member.email,
    date,
    startTime: '',
    endTime: '',
    isDayOff: false,
    action: 'removed'
  }).catch(() => {});
  res.json({
    success: true
  });
}));
router.get('/overrides/all', wrap(async (req: any, res: any) => {
  const ids = await scopedEmployeeIds(req, res);
  if (res.headersSent) return;
  const {
    start,
    end
  } = monthRange(req.query.month);
  const conditions: any[] = [gte(shiftScheduleOverrides.overrideDate, start), lte(shiftScheduleOverrides.overrideDate, end)];
  if (ids !== null) {
    if (!ids.length) return res.json({
      overrides: []
    });
    conditions.push(inArray(shiftScheduleOverrides.employeeId, ids));
  }
  const rows = await db.select({
    override: shiftScheduleOverrides,
    employee: teamMembers
  }).from(shiftScheduleOverrides).innerJoin(teamMembers, eq(shiftScheduleOverrides.employeeId, teamMembers.id)).where(and(...conditions));
  let visible = rows;
  if (req.user.role !== 'admin' || req.query.clientId) {
    const clientId = await resolveClientScope(req, res);
    if (clientId === null) return;
    const memberships = await db.select({ assignment: clientServiceTeamMembers, service: clientServices })
      .from(clientServiceTeamMembers).innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
      .where(eq(clientServices.clientId, clientId));
    visible = rows.filter(row => memberships.some(m => m.assignment.teamMemberId === row.employee.id &&
      overlapsPeriod(m.assignment, row.override.overrideDate, row.override.overrideDate) &&
      overlapsPeriod(m.service, row.override.overrideDate, row.override.overrideDate)));
  }
  res.json({
    overrides: visible.map(r => ({
      override: r.override,
      employee: publicEmployee(r.employee)
    }))
  });
}));
export default router;
