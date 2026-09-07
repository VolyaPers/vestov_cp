import { benefitFactor, assertEmployeeBenefits } from '../services/employmentPolicy.js';
import { db } from '../db/index.js';
import { employmentCycles, leaveBalances, leaveRequests, leaveTypes, teamMembers, leaveAllocationSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { employmentCycleForDate, isoDate, leaveDaySegments, timezoneLocalDate, type LeaveDates, daysBetween } from './calendar.js';
export interface VacationBalance {
  totalAllocated: number;
  totalUsed: number;
  totalRemaining: number;
  firstHalfAvailable: number;
  firstHalfUsed: number;
  firstHalfRemaining: number;
  secondHalfAvailable: number;
  secondHalfUsed: number;
  secondHalfRemaining: number;
  currentlyAvailable: number;
  lockedUntilSecondHalf: number;
  cashableAtYearEnd: number;
  willExpire: number;
  isFirstHalf: boolean;
  daysUntilSecondHalf: number;
  cycleStartDate: string;
  cycleMidpointDate: string;
  cycleEndDate: string;
  cycleId: number;
  cycleNumber: number;
  careerYear: number;
  baseAllocation: number;
  pendingDays?: number;
  allocationWarning?: string | null;
}
export const isVacationType = (name: string) => /^(vacation(?: leave)?|annual leave|paid time off|pto)$/i.test(name);
export const isSickType = (name: string) => /^(sick leave|sick|sick day|sick days)$/i.test(name);
export function defaultAllocation(name: string, year: number): number {
  return isVacationType(name) ? year === 1 ? 16 : year === 2 ? 20 : 24 : isSickType(name) ? 7 : /^personal( leave)?$/i.test(name) ? 5 : 0;
}
export async function loadLeaveContext(employeeId: number, connection: any = db) {
  const [member] = await connection.select().from(teamMembers).where(eq(teamMembers.id, employeeId));
  if (!member?.startDate) throw new Error('Employee profile and employment start date are required');
  const cycles = await connection.select().from(employmentCycles).where(eq(employmentCycles.employeeId, employeeId));
  const balances = await connection.select().from(leaveBalances).where(eq(leaveBalances.employeeId, employeeId));
  const types = await connection.select().from(leaveTypes);
  const requests = await connection.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId));
  const settings = await connection.select().from(leaveAllocationSettings);
  return {
    member,
    cycles,
    balances,
    types,
    requests,
    settings
  };
}
export function configuredAllocation(context: {
  settings?: any[];
}, type: any, year: number): number {
  const settings = context.settings || [];
  const exact = settings.filter(s => s.leaveTypeId === type.id && s.cycleNumber === year);
  const fallback = settings.filter(s => s.leaveTypeId === type.id && s.isDefault && year > s.cycleNumber);
  const matches = exact.length ? exact : fallback;
  if (new Set(matches.map(s => Number(s.allocatedDays))).size > 1) throw new Error(`Conflicting allocation settings for ${type.name}; administrator reconciliation is required`);
  return matches.length ? Number(matches[0].allocatedDays) : defaultAllocation(type.name, year);
}
/** Pure single source of allocation and consumption. A request is split at every actual date boundary. */
export function summarizeLeave(context: Awaited<ReturnType<typeof loadLeaveContext>>, type: any, targetDate: string, excludeRequestId?: number) {
  const {
    member,
    cycles,
    balances,
    requests
  } = context;
  const target = targetDate < member.startDate ? member.startDate : targetDate;
  const dates = employmentCycleForDate(member.startDate, target);
  const cycle = cycles.find((c: any) => c.cycleStart === dates.cycleStart);
  const row = cycle ? balances.find((b: any) => b.employmentCycleId === cycle.id && b.leaveTypeId === type.id) : null;
  const baseAllocation = configuredAllocation(context, type, dates.careerYear);
  const factor = benefitFactor(member.employmentType);
  const allocated = (row ? Number(row.totalDays) : baseAllocation) * factor;
  const adjustments = Number(row?.adjustmentDays || 0) * factor;
  const totalAllocated = allocated + adjustments;
  let firstHalfUsed = 0,
    secondHalfUsed = 0,
    pendingDays = 0;
  for (const request of requests) {
    if (request.id === excludeRequestId || request.leaveTypeId !== type.id || !['approved', 'pending'].includes(request.status)) continue;
    for (const day of leaveDaySegments(request)) {
      if (day.date < dates.cycleStart || day.date > dates.cycleEnd) continue;
      if (request.status === 'pending') pendingDays += day.units;else if (day.date < dates.cycleMidpoint) firstHalfUsed += day.units;else secondHalfUsed += day.units;
    }
  }
  const totalUsed = firstHalfUsed + secondHalfUsed,
    totalRemaining = totalAllocated - totalUsed;
  const split = isVacationType(type.name) && dates.careerYear >= 2;
  const firstHalfAvailable = split ? totalAllocated / 2 : totalAllocated;
  const secondHalfAvailable = split ? totalAllocated / 2 : totalAllocated;
  const firstHalfRemaining = split ? firstHalfAvailable - firstHalfUsed : totalRemaining;
  const secondHalfRemaining = split ? secondHalfAvailable - secondHalfUsed : totalRemaining;
  const isFirstHalf = targetDate < dates.cycleMidpoint;
  return {
    totalAllocated,
    totalUsed,
    totalRemaining,
    firstHalfAvailable,
    firstHalfUsed,
    firstHalfRemaining,
    secondHalfAvailable,
    secondHalfUsed,
    secondHalfRemaining,
    currentlyAvailable: targetDate < member.startDate ? 0 : Math.max(0, isFirstHalf ? firstHalfRemaining : secondHalfRemaining),
    lockedUntilSecondHalf: split && isFirstHalf ? Math.max(0, secondHalfRemaining) : 0,
    cashableAtYearEnd: isVacationType(type.name) ? Math.min(5 * factor, Math.max(0, totalRemaining)) : 0,
    willExpire: Math.max(0, totalRemaining - (isVacationType(type.name) ? 5 * factor : 0)),
    isFirstHalf,
    daysUntilSecondHalf: isFirstHalf ? Math.max(0, daysBetween(targetDate, dates.cycleMidpoint)) : 0,
    cycleStartDate: dates.cycleStart,
    cycleMidpointDate: dates.cycleMidpoint,
    cycleEndDate: dates.cycleEnd,
    cycleId: cycle?.id || 0,
    cycleNumber: dates.careerYear,
    careerYear: dates.careerYear,
    baseAllocation: baseAllocation * factor,
    benefitFactor: factor,
    pendingDays,
    adjustments,
    allocated,
    leaveType: type.name,
    leaveTypeId: type.id,
    allocationWarning: row && allocated !== baseAllocation * factor ? 'Saved individual allocation differs from the current career-year setting. Review it before making an explicit adjustment.' : null
  };
}
export async function calculateVacationBalance(employeeId: number, currentDate: Date = new Date(), connection: any = db): Promise<VacationBalance | null> {
  const context = await loadLeaveContext(employeeId, connection);
  const type = context.types.find((t: any) => isVacationType(t.name));
  if (!type) return null;
  return summarizeLeave(context, type, timezoneLocalDate(currentDate, context.member.timezone));
}
export async function assertLeaveRequestAllowed(connection: any, employeeId: number, typeId: number, request: LeaveDates, excludeRequestId?: number) {
  const context = await loadLeaveContext(employeeId, connection);
  assertEmployeeBenefits(context.member);
  const type = context.types.find((t: any) => t.id === typeId);
  if (!type) throw new Error('Leave type not found');
  if ((request.halfDayStart || request.halfDayEnd) && !type.halfDaySupported) throw new Error('This leave type does not support half days');
  const groups = new Map<string, {
    date: string;
    first: number;
    second: number;
  }>();
  for (const day of leaveDaySegments(request)) {
    const cycle = employmentCycleForDate(context.member.startDate, day.date);
    const group = groups.get(cycle.cycleStart) || {
      date: day.date,
      first: 0,
      second: 0
    };
    if (day.date < cycle.cycleMidpoint) group.first += day.units;else group.second += day.units;
    groups.set(cycle.cycleStart, group);
  }
  if (!type.isDeductible) return context;
  for (const group of groups.values()) {
    const balance = summarizeLeave(context, type, group.date, excludeRequestId);
    const split = isVacationType(type.name) && balance.careerYear >= 2;
    if (split ? group.first > balance.firstHalfRemaining || group.second > balance.secondHalfRemaining : group.first + group.second > balance.totalRemaining) throw new Error(`Insufficient ${type.name.toLowerCase()} balance for ${balance.cycleStartDate} – ${balance.cycleEndDate}`);
  }
  return context;
}
/** Compatibility wrapper for legacy callers; new request paths pass the exact date interval. */
export async function validateVacationRequest(employeeId: number, requestStartDate: Date, requestDays: number, currentDate: Date = new Date()): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const context = await loadLeaveContext(employeeId);
    const type = context.types.find((t: any) => isVacationType(t.name));
    if (!type) throw new Error('Vacation leave type not found');
    const startDate = isoDate(requestStartDate);
    const endDate = new Date(requestStartDate.getTime() + (Math.ceil(requestDays) - 1) * 86400000).toISOString().slice(0, 10);
    await assertLeaveRequestAllowed(db, employeeId, type.id, {
      startDate,
      endDate,
      halfDayEnd: requestDays % 1 !== 0
    });
    return {
      allowed: true
    };
  } catch (error) {
    return {
      allowed: false,
      reason: (error as Error).message
    };
  }
}
