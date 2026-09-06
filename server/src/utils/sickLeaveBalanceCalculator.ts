import { db } from '../db/index.js';
import { isSickType, loadLeaveContext, summarizeLeave } from './vacationBalanceCalculator.js';
import { timezoneLocalDate } from './calendar.js';
export interface SickLeaveBalance {
  totalAllocated: number;
  totalUsed: number;
  totalRemaining: number;
  cycleStartDate: string;
  cycleEndDate: string;
  cycleId: number;
}
export async function calculateSickLeaveBalance(employeeId: number, currentDate: Date = new Date(), connection: any = db): Promise<SickLeaveBalance | null> {
  const context = await loadLeaveContext(employeeId, connection);
  const type = context.types.find((t: any) => isSickType(t.name));
  if (!type) return null;
  return summarizeLeave(context, type, timezoneLocalDate(currentDate, context.member.timezone));
}
