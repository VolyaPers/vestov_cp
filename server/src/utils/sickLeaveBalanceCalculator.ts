import { db } from '../db/index.js'
import { employmentCycles, leaveBalances, leaveRequests, leaveTypes } from '../db/schema.js'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

export interface SickLeaveBalance {
  // Totals
  totalAllocated: number
  totalUsed: number
  totalRemaining: number

  // Metadata
  cycleStartDate: string
  cycleEndDate: string
  cycleId: number
}

/**
 * Calculate sick leave balance for an employee
 *
 * Rules:
 * 1. Default allocation: 7 days per employment cycle
 * 2. No 50/50 split - all days available throughout the entire cycle
 * 3. Can be used in any half of the year
 * 4. Unused sick days do NOT roll over to next cycle
 * 5. Unused sick days are NOT cashable
 */
export async function calculateSickLeaveBalance(
  employeeId: number,
  currentDate: Date = new Date()
): Promise<SickLeaveBalance | null> {
  // Get active employment cycle
  const cycles = await db
    .select()
    .from(employmentCycles)
    .where(
      and(
        eq(employmentCycles.employeeId, employeeId),
        eq(employmentCycles.isActive, true)
      )
    )
    .limit(1)

  if (cycles.length === 0) {
    return null // No active cycle
  }

  const cycle = cycles[0]

  // Get sick leave type
  const sickLeaveTypeResults = await db
    .select()
    .from(leaveTypes)
    .where(
      sql`LOWER(${leaveTypes.name}) IN ('sick leave', 'sick', 'sick day', 'sick days')`
    )
    .limit(1)

  if (sickLeaveTypeResults.length === 0) {
    throw new Error('Sick leave type not found')
  }

  const sickLeaveTypeId = sickLeaveTypeResults[0].id

  // Check if there's an allocation in leave_balances for this cycle
  const balances = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.employmentCycleId, cycle.id),
        eq(leaveBalances.leaveTypeId, sickLeaveTypeId)
      )
    )
    .limit(1)

  // Default sick leave allocation is 7 days per cycle
  let totalAllocated = 7
  if (balances.length > 0) {
    const totalDays = parseFloat(balances[0].totalDays || '7')
    const adjustmentDays = parseFloat(balances[0].adjustmentDays || '0')
    totalAllocated = totalDays + adjustmentDays
  }

  // Get all APPROVED sick leave requests for this cycle
  const requests = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.leaveTypeId, sickLeaveTypeId),
        eq(leaveRequests.status, 'approved'),
        gte(leaveRequests.startDate, cycle.cycleStart),
        lte(leaveRequests.startDate, cycle.cycleEnd)
      )
    )

  // Sum up all sick leave days used
  const totalUsed = requests.reduce((sum, r) => sum + parseFloat(r.daysCount), 0)
  const totalRemaining = Math.max(0, totalAllocated - totalUsed)

  return {
    totalAllocated,
    totalUsed,
    totalRemaining,
    cycleStartDate: cycle.cycleStart,
    cycleEndDate: cycle.cycleEnd,
    cycleId: cycle.id,
  }
}
