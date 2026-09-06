/** Calendar dates are ISO YYYY-MM-DD values. Never round-trip local midnight through UTC. */
export const DAY_MS = 86_400_000;
export function isoDate(value: string | Date): string {
  const result = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) throw new Error('A valid date (YYYY-MM-DD) is required');
  return result;
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${isoDate(date)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(start: string, end: string): number {
  return (Date.parse(isoDate(end)) - Date.parse(isoDate(start))) / DAY_MS;
}
export function dateRange(start: string, end: string): string[] {
  const count = daysBetween(start, end);
  if (count < 0 || count > 3660) throw new Error('Date range must be ordered and no longer than 10 years');
  return Array.from({
    length: count + 1
  }, (_, i) => addDays(start, i));
}
export function weekday(date: string): number {
  return new Date(`${isoDate(date)}T12:00:00Z`).getUTCDay();
}
export function validTimezone(timezone?: string | null): string {
  const tz = timezone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz
    }).format(new Date());
  } catch {
    throw new Error('Invalid IANA timezone');
  }
  return tz;
}
export function timezoneLocalDate(now: Date = new Date(), timezone?: string | null): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validTime(time: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Time must use HH:MM (00:00–23:59)');
  return time;
}
export function timeMinutes(time: string): number {
  const [h, m] = validTime(time).split(':').map(Number);
  return h * 60 + m;
}
export function zonedDateTime(date: string, time: string, timezone?: string | null): Date {
  const tz = validTimezone(timezone);
  isoDate(date);
  validTime(time);
  const target = Date.parse(`${date}T${time}:00Z`);
  let instant = target;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  for (let n = 0; n < 4; n++) {
    const parts = fmt.formatToParts(new Date(instant));
    const get = (t: string) => parts.find(p => p.type === t)!.value;
    const wall = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    const correction = target - wall;
    if (correction === 0) return new Date(instant);
    instant += correction;
  }
  throw new Error('This local time does not exist because of a daylight-saving transition');
}
function anniversary(start: string, year: number): string {
  const [, month, day] = isoDate(start).split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function employmentCycleForDate(startDate: string, targetDate: string) {
  const start = isoDate(startDate);
  const target = isoDate(targetDate);
  if (target < start) throw new Error('Date is before employment start');
  let year = Number(target.slice(0, 4));
  if (anniversary(start, year) > target) year--;
  const cycleStart = anniversary(start, year);
  const cycleEnd = addDays(anniversary(start, year + 1), -1);
  const [y, m, d] = cycleStart.split('-').map(Number);
  const midMonth = m - 1 + 6;
  const midYear = y + Math.floor(midMonth / 12);
  const last = new Date(Date.UTC(midYear, midMonth % 12 + 1, 0)).getUTCDate();
  const cycleMidpoint = new Date(Date.UTC(midYear, midMonth % 12, Math.min(d, last))).toISOString().slice(0, 10);
  return {
    cycleStart,
    cycleEnd,
    cycleMidpoint,
    careerYear: year - Number(start.slice(0, 4)) + 1
  };
}
export interface LeaveDates {
  startDate: string;
  endDate: string;
  halfDayStart?: boolean | null;
  halfDayEnd?: boolean | null;
}
export function leaveDaySegments(request: LeaveDates): Array<{
  date: string;
  units: number;
  startHalf: number;
  endHalf: number;
}> {
  const dates = dateRange(request.startDate, request.endDate);
  if (dates.length === 1 && request.halfDayStart && request.halfDayEnd) throw new Error('Choose one half-day option for a single-day request');
  return dates.map((date, i) => {
    const startHalf = i === 0 && request.halfDayStart ? 1 : 0;
    const endHalf = i === dates.length - 1 && request.halfDayEnd ? 1 : 2;
    return {
      date,
      units: (endHalf - startHalf) / 2,
      startHalf,
      endHalf
    };
  });
}
export function leaveDays(request: LeaveDates): number {
  return leaveDaySegments(request).reduce((sum, day) => sum + day.units, 0);
}
export function leaveOverlaps(a: LeaveDates, b: LeaveDates): boolean {
  if (a.startDate > b.endDate || b.startDate > a.endDate) return false;
  const second = new Map(leaveDaySegments(b).map(day => [day.date, day]));
  return leaveDaySegments(a).some(day => {
    const other = second.get(day.date);
    return other && day.startHalf < other.endHalf && other.startHalf < day.endHalf;
  });
}
export interface EffectiveDayInput {
  date: string;
  timezone?: string | null;
  schedule?: {
    startTime: string;
    endTime: string;
    isActive?: boolean | null;
  } | null;
  override?: {
    startTime: string;
    endTime: string;
    isDayOff?: boolean | null;
  } | null;
  leaves?: Array<LeaveDates & {
    status?: string;
    leaveType?: string;
    leaveTypeName?: string;
  }>;
}
export function getEffectiveDay(input: EffectiveDayInput) {
  const date = isoDate(input.date);
  const timezone = validTimezone(input.timezone);
  const configured = input.override || (input.schedule?.isActive !== false ? input.schedule : null);
  const off = !!input.override?.isDayOff || !configured;
  const startTime = off ? null : validTime(configured!.startTime);
  const endTime = off ? null : validTime(configured!.endTime);
  const startAt = startTime ? zonedDateTime(date, startTime, timezone) : null;
  const endAt = endTime ? zonedDateTime(timeMinutes(endTime) <= timeMinutes(startTime!) ? addDays(date, 1) : date, endTime, timezone) : null;
  const scheduledMinutes = startAt && endAt ? Math.max(0, (endAt.getTime() - startAt.getTime()) / 60000) : 0;
  const leaveSlots = new Set<number>();
  const names = new Set<string>();
  for (const leave of input.leaves || []) {
    if (leave.status && leave.status !== 'approved') continue;
    if (leave.startDate > date || leave.endDate < date) continue;
    const segment = leaveDaySegments(leave).find(day => day.date === date);
    if (!segment) continue;
    for (let half = segment.startHalf; half < segment.endHalf; half++) leaveSlots.add(half);
    const name = leave.leaveType || leave.leaveTypeName;
    if (name) names.add(name);
  }
  const absenceUnits = leaveSlots.size / 2;
  const absenceMinutes = scheduledMinutes * absenceUnits;
  const expectedStartAt = startAt && !leaveSlots.has(1) && leaveSlots.has(0) ? new Date(startAt.getTime() + scheduledMinutes * 30000) : startAt;
  return {
    date,
    timezone,
    startTime,
    endTime,
    startAt: startAt?.toISOString() || null,
    endAt: endAt?.toISOString() || null,
    expectedStartAt: absenceUnits === 1 ? null : expectedStartAt?.toISOString() || null,
    scheduledMinutes,
    workingMinutes: scheduledMinutes - absenceMinutes,
    absenceMinutes,
    absenceUnits,
    isDayOff: off || absenceUnits === 1,
    isOverride: !!input.override,
    leaveType: [...names].join(', ') || null
  };
}

/** Actual work time subtracts the union of pauses, clipped to the shift interval. */
export function shiftWorkMinutes(shift: {
  startTime: Date | string;
  endTime?: Date | string | null;
}, breaks: Array<{
  startTime: Date | string;
  endTime?: Date | string | null;
}>, now = new Date()) {
  const start = new Date(shift.startTime).getTime(),
    end = new Date(shift.endTime || now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return {
    elapsedMinutes: 0,
    breakMinutes: 0,
    workingMinutes: 0
  };
  const intervals = breaks.map(pause => [Math.max(start, new Date(pause.startTime).getTime()), Math.min(end, new Date(pause.endTime || now).getTime())]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a, b) => a[0] - b[0]);
  let paused = 0,
    previousStart = 0,
    previousEnd = 0;
  for (const [a, b] of intervals) {
    if (a > previousEnd) {
      paused += previousEnd - previousStart;
      previousStart = a;
      previousEnd = b;
    } else previousEnd = Math.max(previousEnd, b);
  }
  paused += previousEnd - previousStart;
  return {
    elapsedMinutes: (end - start) / 60000,
    breakMinutes: paused / 60000,
    workingMinutes: (end - start - paused) / 60000
  };
}
