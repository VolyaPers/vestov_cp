import { db } from '../db'
import { employmentCycles, leaveBalances, leaveRequests, leaveTypes } from '../db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

export interface VacationBalance {
  // Totals
  totalAllocated: number
  totalUsed: number
  totalRemaining: number

  // First Half
  firstHalfAvailable: number
  firstHalfUsed: number
  firstHalfRemaining: number

  // Second Half
  secondHalfAvailable: number
  secondHalfUsed: number
  secondHalfRemaining: number

  // Currently Available (respects half boundaries)
  currentlyAvailable: number
  lockedUntilSecondHalf: number

  // Financial
  cashableAtYearEnd: number  // Max 5 days can be paid out
  willExpire: number         // Days beyond 5 that will expire

  // Metadata
  isFirstHalf: boolean
  daysUntilSecondHalf: number
  cycleStartDate: string
  cycleMidpointDate: string
  cycleEndDate: string
  cycleId: number
  cycleNumber: number
  baseAllocation: number
}

/**
 * Calculate vacation balance for an employee based on 50/50 milestone rule
 *
 * Rules:
 * 1. Total allocation split 50/50 between first and second half of cycle
 * 2. Each half has STRICT 50% usage limit - unused days from first half do NOT increase second half availability
 * 3. Unused days from both halves are tracked for financial purposes (cashout/expiry)
 * 4. At year end, up to 5 unused days can be paid out
 * 5. Any days beyond 5 will expire
 */
/**
 * Determine vacation allocation based on employment cycle number
 * 1st year: 16 days
 * 2nd year: 20 days
 * 3rd year and beyond: 24 days
 */
function getVacationAllocation(cycleNumber: number): number {
  if (cycleNumber === 1) return 16
  if (cycleNumber === 2) return 20
  return 24 // 3rd year and beyond
}

export async function calculateVacationBalance(
  employeeId: number,
  currentDate: Date = new Date()
): Promise<VacationBalance | null> {
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
  const cycleStart = new Date(cycle.cycleStart)
  const cycleMidpoint = new Date(cycle.cycleMidpoint)
  const cycleEnd = new Date(cycle.cycleEnd)

  // Determine which cycle number this is (1st, 2nd, 3rd, etc.)
  const allEmployeeCycles = await db
    .select()
    .from(employmentCycles)
    .where(eq(employmentCycles.employeeId, employeeId))
    .orderBy(employmentCycles.cycleStart)

  const cycleNumber = allEmployeeCycles.findIndex(c => c.id === cycle.id) + 1

  // Determine which half we're in
  const isFirstHalf = currentDate < cycleMidpoint

  // Get vacation leave type (assuming name is 'Vacation' or 'Annual Leave')
  const vacationTypes = await db
    .select()
    .from(leaveTypes)
    .where(
      sql`LOWER(${leaveTypes.name}) IN ('vacation', 'annual leave', 'paid time off', 'pto')`
    )
    .limit(1)

  if (vacationTypes.length === 0) {
    throw new Error('Vacation leave type not found')
  }

  const vacationTypeId = vacationTypes[0].id

  // Calculate total allocated days based on cycle number (16, 20, or 24 days)
  const baseAllocation = getVacationAllocation(cycleNumber)

  // Check for any adjustments in the leave balances table
  let adjustmentDays = 0
  const balances = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.employmentCycleId, cycle.id),
        eq(leaveBalances.leaveTypeId, vacationTypeId)
      )
    )
    .limit(1)

  if (balances.length > 0) {
    adjustmentDays = parseFloat(balances[0].adjustmentDays || '0')
  }

  const totalAllocated = baseAllocation + adjustmentDays

  // Get all APPROVED vacation requests for this cycle
  const requests = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.leaveTypeId, vacationTypeId),
        eq(leaveRequests.status, 'approved'),
        gte(leaveRequests.startDate, cycle.cycleStart),
        lte(leaveRequests.startDate, cycle.cycleEnd)
      )
    )

  // Total used days
  const totalUsed = requests.reduce((sum, r) => sum + parseFloat(r.daysCount), 0)
  const totalRemaining = totalAllocated - totalUsed

  // 50/50 split ONLY applies from second year onwards (when allocation is 20 or 24 days)
  const apply5050Split = cycleNumber >= 2

  let firstHalfAvailable: number
  let firstHalfUsed: number
  let firstHalfRemaining: number
  let secondHalfAvailable: number
  let secondHalfUsed: number
  let secondHalfRemaining: number
  let currentlyAvailable: number
  let lockedUntilSecondHalf: number

  if (apply5050Split) {
    // 50/50 split logic (2nd year onwards)
    const halfAllocation = totalAllocated / 2

    // Split requests by half based on start date
    const firstHalfRequests = requests.filter(r => new Date(r.startDate) < cycleMidpoint)
    const secondHalfRequests = requests.filter(r => new Date(r.startDate) >= cycleMidpoint)

    // Sum up days used in each half
    firstHalfUsed = firstHalfRequests.reduce((sum, r) => sum + parseFloat(r.daysCount), 0)
    secondHalfUsed = secondHalfRequests.reduce((sum, r) => sum + parseFloat(r.daysCount), 0)

    // Calculate remaining days in first half
    firstHalfRemaining = Math.max(0, halfAllocation - firstHalfUsed)

    // Second half has STRICT 50% limit - no rollover for usage
    secondHalfAvailable = halfAllocation
    secondHalfRemaining = Math.max(0, secondHalfAvailable - secondHalfUsed)

    firstHalfAvailable = halfAllocation

    // Currently available depends on which half we're in - STRICT 50% LIMIT
    currentlyAvailable = isFirstHalf ? firstHalfRemaining : secondHalfRemaining

    // In first half: remaining days are locked until second half
    lockedUntilSecondHalf = isFirstHalf ? firstHalfRemaining : 0
  } else {
    // First year: No 50/50 split - all days available anytime
    firstHalfAvailable = totalAllocated
    firstHalfUsed = totalUsed
    firstHalfRemaining = totalRemaining
    secondHalfAvailable = 0
    secondHalfUsed = 0
    secondHalfRemaining = 0
    currentlyAvailable = totalRemaining
    lockedUntilSecondHalf = 0
  }

  // Financial calculations
  const cashableAtYearEnd = Math.min(5, totalRemaining)
  const willExpire = Math.max(0, totalRemaining - 5)

  // Days until second half
  const daysUntilSecondHalf = isFirstHalf
    ? Math.ceil((cycleMidpoint.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0

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

    currentlyAvailable,
    lockedUntilSecondHalf,

    cashableAtYearEnd,
    willExpire,

    isFirstHalf,
    daysUntilSecondHalf,
    cycleStartDate: cycle.cycleStart,
    cycleMidpointDate: cycle.cycleMidpoint,
    cycleEndDate: cycle.cycleEnd,
    cycleId: cycle.id,
    cycleNumber,
    baseAllocation
  }
}

/**
 * Validate if a vacation request can be approved based on 50/50 rule
 */
export async function validateVacationRequest(
  employeeId: number,
  requestStartDate: Date,
  requestDays: number,
  currentDate: Date = new Date()
): Promise<{ allowed: boolean; reason?: string }> {
  const balance = await calculateVacationBalance(employeeId, currentDate)

  if (!balance) {
    return { allowed: false, reason: 'No active employment cycle found' }
  }

  // Determine which half the request falls into
  const midpoint = new Date(balance.cycleMidpointDate)
  const isRequestInFirstHalf = requestStartDate < midpoint

  // Check availability in the appropriate half
  const availableInRequestedHalf = isRequestInFirstHalf
    ? balance.firstHalfRemaining
    : balance.secondHalfRemaining

  if (requestDays > availableInRequestedHalf) {
    const halfName = isRequestInFirstHalf ? 'first half' : 'second half'
    const dateRange = isRequestInFirstHalf
      ? `${balance.cycleStartDate} - ${balance.cycleMidpointDate}`
      : `${balance.cycleMidpointDate} - ${balance.cycleEndDate}`

    return {
      allowed: false,
      reason: `Only ${availableInRequestedHalf.toFixed(1)} days available in ${halfName} (${dateRange}). You have ${balance.totalRemaining.toFixed(1)} total days, but ${balance.lockedUntilSecondHalf.toFixed(1)} are locked until the second half starts.`
    }
  }

  return { allowed: true }
}
