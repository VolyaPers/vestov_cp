import { db } from '../db/index.js'
import { employmentCycles, leaveBalances, leaveRequests, leaveTypes, teamMembers, leaveAllocationSettings } from '../db/schema.js'
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { calculateEmploymentMetrics } from './employment.js'
import { calculateDays } from './dateUtils.js'

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
  cycleNumber: number // For metadata only (which cycle in DB)
  careerYear: number // Career year based on time at company (used for UI logic)
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
 * Determine vacation allocation based on career year (time at company)
 * Year 1: 16 days
 * Year 2: 20 days
 * Year 3 and beyond: 24 days
 */
function getVacationAllocation(careerYear: number): number {
  if (careerYear === 1) return 16
  if (careerYear === 2) return 20
  return 24 // Year 3 and beyond
}

export async function calculateVacationBalance(
  employeeId: number,
  currentDate: Date = new Date()
): Promise<VacationBalance | null> {
  console.log(`[calculateVacationBalance] Called for employee ${employeeId}, currentDate: ${currentDate.toISOString().split('T')[0]}`)
  
  // Get team member to access startDate for career year calculation
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, employeeId))
    .limit(1)

  if (!member || !member.startDate) {
    throw new Error('Team member not found or missing start date')
  }

  // Calculate career year using the same logic as dashboard/roadmap (365-day calculation)
  const employment = calculateEmploymentMetrics(member.startDate)
  const careerYear = employment.careerYear

  // Calculate the current cycle based on employment anniversary (same logic as Dashboard)
  // This ensures we use the correct cycle that matches the career year
  const startDate = new Date(member.startDate)
  const currentYear = currentDate.getFullYear()
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const startDay = startDate.getDate()
  
  // Calculate how many full years since start date
  let yearsEmployed = currentYear - startYear
  const monthDiff = currentDate.getMonth() - startMonth
  const dayDiff = currentDate.getDate() - startDay

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    yearsEmployed--
  }

  // Calculate current cycle dates based on employment anniversary
  const expectedCycleStart = new Date(startDate)
  expectedCycleStart.setFullYear(startYear + yearsEmployed)

  const expectedCycleEnd = new Date(expectedCycleStart)
  expectedCycleEnd.setFullYear(expectedCycleStart.getFullYear() + 1)
  expectedCycleEnd.setDate(expectedCycleEnd.getDate() - 1) // End day before next cycle starts

  // Get all cycles for this employee
  const allCycles = await db
    .select()
    .from(employmentCycles)
    .where(eq(employmentCycles.employeeId, employeeId))
    .orderBy(employmentCycles.cycleStart)

  console.log(`[calculateVacationBalance] Found ${allCycles.length} cycles for employee ${employeeId}`)
  allCycles.forEach(c => {
    console.log(`[calculateVacationBalance] - Cycle ${c.id}: ${c.cycleStart} - ${c.cycleEnd}, isActive: ${c.isActive}`)
  })

  // Find the cycle that matches the expected cycle start date (based on anniversary)
  let cycle = allCycles.find(c => {
    const cStart = new Date(c.cycleStart)
    return cStart.getTime() === expectedCycleStart.getTime()
  })

  // If no exact match, try to create the cycle for the current date
  if (!cycle) {
    console.log(`[calculateVacationBalance] Expected cycle (${expectedCycleStart.toISOString().split('T')[0]}) not found, attempting to create it`)
    cycle = await createCycleForDate(employeeId, currentDate)
    if (cycle) {
      console.log(`[calculateVacationBalance] Successfully created cycle ${cycle.id} for date ${currentDate.toISOString().split('T')[0]}`)
    }
  }

  // If still no cycle, find the cycle that contains the current date
  if (!cycle) {
    cycle = allCycles.find(c => {
      const cStart = new Date(c.cycleStart)
      const cEnd = new Date(c.cycleEnd)
      return currentDate >= cStart && currentDate <= cEnd
    })
  }

  // If still no cycle, try to find the most recent cycle that starts before or on current date
  if (!cycle) {
    cycle = allCycles
      .filter(c => {
        const cStart = new Date(c.cycleStart)
        return currentDate >= cStart
      })
      .sort((a, b) => new Date(b.cycleStart).getTime() - new Date(a.cycleStart).getTime())[0]
  }

  // If still no cycle, use the most recent cycle overall (even if in the future)
  // This allows employees with future start dates to see their upcoming balance
  if (!cycle) {
    if (allCycles.length === 0) {
      console.log(`[calculateVacationBalance] No cycles found for employee ${employeeId}`)
      return null // No cycles found
    }
    cycle = allCycles[allCycles.length - 1]
  }

  if (!cycle) {
    return null // No cycle found
  }
  
  const cycleStart = new Date(cycle.cycleStart)
  const cycleMidpoint = new Date(cycle.cycleMidpoint)
  const cycleEnd = new Date(cycle.cycleEnd)

  // Determine which cycle number this is (for metadata purposes only)
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

  // Calculate total allocated days based on career year (16, 20, or 24 days)
  // This uses the same calculation as dashboard/roadmap for consistency
  const baseAllocation = getVacationAllocation(careerYear)

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
  // IMPORTANT: When a request is approved, its days are automatically deducted from available balance
  // because this query only counts requests with status 'approved'. If a request is cancelled or denied,
  // it's no longer counted here, so the days are automatically returned to the balance.
  // Only count vacations that fall within this cycle's date range
  // Vacations in future cycles should be counted in those cycles, not this one
  // Convert cycle dates to Date objects for comparison
  const cycleStartDate = new Date(cycle.cycleStart)
  const cycleEndDate = new Date(cycle.cycleEnd)
  
  // Get all approved vacation requests for this employee
  const allApprovedRequests = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.leaveTypeId, vacationTypeId),
        eq(leaveRequests.status, 'approved') // Only approved requests count as used days
      )
    )
  
  console.log(`[DEBUG] Total approved requests found: ${allApprovedRequests.length}`)
  allApprovedRequests.forEach(r => {
    console.log(`[DEBUG] - Request ${r.id}: ${r.startDate} - ${r.endDate}, ${r.daysCount} days, status: ${r.status}`)
  })
  
  // Filter requests that fall within this cycle's date range
  // We do this in JavaScript to ensure proper date comparison
  const requests = allApprovedRequests.filter(r => {
    const requestStart = new Date(r.startDate)
    const isInCycle = requestStart >= cycleStartDate && requestStart <= cycleEndDate
    if (!isInCycle) {
      console.log(`[DEBUG] Request ${r.id} (${r.startDate}) is OUTSIDE cycle ${cycle.id} (${cycleStartDate.toISOString().split('T')[0]} - ${cycleEndDate.toISOString().split('T')[0]})`)
    }
    return isInCycle
  })

  // Check if there are approved vacations outside this cycle
  // This helps identify if vacations were approved for future cycles
  // Find vacations that fall outside the current cycle
  const vacationsOutsideCycle = allApprovedRequests.filter(r => {
    const requestStart = new Date(r.startDate)
    return requestStart < cycleStartDate || requestStart > cycleEndDate
  })

  // If there are vacations outside the current cycle, check if they belong to another cycle
  if (vacationsOutsideCycle.length > 0) {
    // Get all cycles for this employee (not just active ones)
    const allCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, employeeId))
      .orderBy(employmentCycles.cycleStart)

    // Check if any of these vacations belong to other cycles
    for (const vacation of vacationsOutsideCycle) {
      const vacationStart = new Date(vacation.startDate)
      const belongsToCycle = allCycles.find(c => {
        const cStart = new Date(c.cycleStart)
        const cEnd = new Date(c.cycleEnd)
        return vacationStart >= cStart && vacationStart <= cEnd
      })

      if (!belongsToCycle) {
        // Vacation doesn't belong to any existing cycle
        // This is a data integrity issue - vacation approved for a date with no cycle
        console.warn(
          `Vacation request ${vacation.id} for employee ${employeeId} ` +
          `(date: ${vacation.startDate}) does not belong to any existing cycle. ` +
          `Current cycle: ${cycle.cycleStart} - ${cycle.cycleEnd}`
        )
      }
    }
  }

  // Total used days — weekday-only count from each request range (excludes weekends)
  const totalUsed = requests.reduce((sum, r) => {
    return sum + calculateDays(
      r.startDate,
      r.endDate,
      r.halfDayStart || false,
      r.halfDayEnd || false
    )
  }, 0)
  const totalRemaining = totalAllocated - totalUsed

  // Debug logging to understand why requests might not be counted
  console.log(`[DEBUG] Vacation Balance Calculation for Employee ${employeeId}`)
  console.log(`[DEBUG] Cycle: ${cycle.id} (${cycle.cycleStart} - ${cycle.cycleEnd}), isActive: ${cycle.isActive}`)
  console.log(`[DEBUG] Found ${requests.length} approved requests in this cycle`)
  console.log(`[DEBUG] Total allocated: ${totalAllocated}, Total used: ${totalUsed}, Total remaining: ${totalRemaining}`)
  if (requests.length > 0) {
    requests.forEach(r => {
      console.log(`[DEBUG] - Request ${r.id}: ${r.startDate} - ${r.endDate}, ${r.daysCount} days, status: ${r.status}`)
    })
  } else {
    // Check if there are approved requests that don't match this cycle
    const allApproved = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.leaveTypeId, vacationTypeId),
          eq(leaveRequests.status, 'approved')
        )
      )
    console.log(`[DEBUG] Total approved requests for employee: ${allApproved.length}`)
    allApproved.forEach(r => {
      console.log(`[DEBUG] - Request ${r.id}: ${r.startDate} - ${r.endDate}, ${r.daysCount} days (cycle: ${cycle.cycleStart} - ${cycle.cycleEnd})`)
    })
  }

  // 50/50 split ONLY applies from second year onwards (when allocation is 20 or 24 days)
  // Use careerYear to match dashboard/roadmap calculation
  const apply5050Split = careerYear >= 2

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
    // A request belongs to the half where its start date falls
    const firstHalfRequests = requests.filter(r => {
      const requestStart = new Date(r.startDate)
      return requestStart < cycleMidpoint
    })
    const secondHalfRequests = requests.filter(r => {
      const requestStart = new Date(r.startDate)
      return requestStart >= cycleMidpoint
    })

    // Sum up days used in each half (weekdays only)
    firstHalfUsed = firstHalfRequests.reduce((sum, r) => {
      return sum + calculateDays(
        r.startDate,
        r.endDate,
        r.halfDayStart || false,
        r.halfDayEnd || false
      )
    }, 0)
    secondHalfUsed = secondHalfRequests.reduce((sum, r) => {
      return sum + calculateDays(
        r.startDate,
        r.endDate,
        r.halfDayStart || false,
        r.halfDayEnd || false
      )
    }, 0)

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
    cycleNumber, // For metadata only
    careerYear, // Career year for UI logic (matches dashboard/roadmap)
    baseAllocation
  }
}

/**
 * Calculate the next employment cycle start date based on employee start date and a target date
 */
function calculateCycleStartForDate(employeeStartDate: Date, targetDate: Date): Date {
  const startYear = employeeStartDate.getFullYear()
  const startMonth = employeeStartDate.getMonth()
  const startDay = employeeStartDate.getDate()
  
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()
  const targetDay = targetDate.getDate()
  
  // Calculate which cycle year this date falls into
  // Cycles are based on anniversary dates
  let cycleYear = targetYear
  
  // If target date is before the anniversary in the target year, use previous year
  if (targetMonth < startMonth || (targetMonth === startMonth && targetDay < startDay)) {
    cycleYear = targetYear - 1
  }
  
  // Create cycle start date (anniversary date in the calculated year)
  const cycleStart = new Date(cycleYear, startMonth, startDay)
  
  return cycleStart
}

/**
 * Create an employment cycle for a specific date if it doesn't exist
 */
async function createCycleForDate(
  employeeId: number,
  date: Date
): Promise<typeof employmentCycles.$inferSelect | null> {
  try {
    // Get team member with start date
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, employeeId))
      .limit(1)

    if (!member || !member.startDate) {
      return null // No start date available
    }

    // Calculate which cycle should contain this date
    const employeeStartDate = new Date(member.startDate)
    const cycleStart = calculateCycleStartForDate(employeeStartDate, date)
    
    // Calculate end date (1 year from cycle start)
    const cycleEnd = new Date(cycleStart)
    cycleEnd.setFullYear(cycleStart.getFullYear() + 1)
    cycleEnd.setDate(cycleEnd.getDate() - 1) // End day before next cycle starts
    
    // Check if date is within this cycle
    if (date < cycleStart || date > cycleEnd) {
      return null // Date is outside the calculated cycle range
    }

    // Check if cycle already exists
    const existingCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, employeeId))
      .orderBy(employmentCycles.cycleStart)

    // Check if a cycle with this start date already exists
    const cycleExists = existingCycles.some(c => {
      const cStart = new Date(c.cycleStart)
      return cStart.getTime() === cycleStart.getTime()
    })

    if (cycleExists) {
      // Cycle exists, find and return it
      return existingCycles.find(c => {
        const cStart = new Date(c.cycleStart)
        return cStart.getTime() === cycleStart.getTime()
      }) || null
    }

    // Calculate midpoint (6 months from start) for 50/50 vacation split
    const midpointDate = new Date(cycleStart)
    midpointDate.setMonth(cycleStart.getMonth() + 6)
    const cycleMidpoint = midpointDate.toISOString().split('T')[0]

    // Check if this should be the active cycle
    // If the cycle start date is today or in the past, or if it's the most recent cycle, make it active
    const shouldBeActive = cycleStart <= new Date() || existingCycles.length === 0

    // Create employment cycle
    const [cycle] = await db
      .insert(employmentCycles)
      .values({
        employeeId,
        cycleStart: cycleStart.toISOString().split('T')[0],
        cycleEnd: cycleEnd.toISOString().split('T')[0],
        cycleMidpoint,
        isActive: shouldBeActive, // Activate if it's current/past or if it's the first cycle
      })
      .returning()

    // If this cycle should be active, deactivate other cycles
    if (shouldBeActive) {
      await db
        .update(employmentCycles)
        .set({ isActive: false })
        .where(
          and(
            eq(employmentCycles.employeeId, employeeId),
            sql`${employmentCycles.id} != ${cycle.id}`
          )
        )
    }

    // Get all leave types
    const allLeaveTypes = await db.select().from(leaveTypes)

    // Get default allocation settings or use hardcoded defaults
    const defaultSettings = await db
      .select()
      .from(leaveAllocationSettings)
      .where(eq(leaveAllocationSettings.isDefault, true))
      .limit(10)

    // Create leave balances for each leave type
    for (const leaveType of allLeaveTypes) {
      // Try to find default setting for this leave type
      const setting = defaultSettings.find(s => s.leaveTypeId === leaveType.id)
      
      // Default allocations if no setting found
      const defaultAllocation: Record<string, number> = {
        'Vacation': 20,
        'Vacation Leave': 20,
        'Sick Leave': 7,
        'Sick': 7,
        'Personal Leave': 5,
        'Personal': 5,
      }

      const totalDays = setting 
        ? parseFloat(setting.allocatedDays.toString())
        : (defaultAllocation[leaveType.name] || 0)

      await db.insert(leaveBalances).values({
        employeeId,
        employmentCycleId: cycle.id,
        leaveTypeId: leaveType.id,
        totalDays: totalDays.toString(),
        adjustmentDays: '0',
      })
    }

    console.log(`Auto-created employment cycle for employee ${employeeId} covering date ${date.toISOString().split('T')[0]}`)
    return cycle
  } catch (error) {
    console.error('Error creating cycle for date:', error)
    return null
  }
}

/**
 * Find the employment cycle that contains a specific date
 */
async function findCycleForDate(
  employeeId: number,
  date: Date
): Promise<typeof employmentCycles.$inferSelect | null> {
  const allCycles = await db
    .select()
    .from(employmentCycles)
    .where(eq(employmentCycles.employeeId, employeeId))
    .orderBy(employmentCycles.cycleStart)

  // Find the cycle that contains this date
  for (const cycle of allCycles) {
    const cycleStart = new Date(cycle.cycleStart)
    const cycleEnd = new Date(cycle.cycleEnd)
    if (date >= cycleStart && date <= cycleEnd) {
      return cycle
    }
  }

  return null
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
  // First, find which cycle contains the vacation date
  let cycleForVacation = await findCycleForDate(employeeId, requestStartDate)

  // If no cycle found, try to create one automatically based on employee start date
  if (!cycleForVacation) {
    cycleForVacation = await createCycleForDate(employeeId, requestStartDate)
    
    if (!cycleForVacation) {
      // Get team member to check if they have start date
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, employeeId))
        .limit(1)

      if (!member || !member.startDate) {
        return {
          allowed: false,
          reason: `The vacation date ${requestStartDate.toISOString().split('T')[0]} does not belong to any existing employment cycle. The employee needs a start date to automatically create cycles.`
        }
      }

      return {
        allowed: false,
        reason: `The vacation date ${requestStartDate.toISOString().split('T')[0]} does not belong to any existing employment cycle and could not be automatically created. Please create an employment cycle for this date range first.`
      }
    }
  }

  // Check if this is a future cycle
  const cycleStart = new Date(cycleForVacation.cycleStart)
  const cycleEnd = new Date(cycleForVacation.cycleEnd)
  const isFutureCycle = cycleStart > currentDate
  const isActiveCycle = cycleForVacation.isActive

  // If it's a future cycle or not active, we can't validate against current balance
  // But we should still allow it if the cycle exists (it was just created)
  if (isFutureCycle || !isActiveCycle) {
    // For future or inactive cycles, we'll allow the approval
    // Balance will be validated when that cycle becomes active
    return { allowed: true }
  }

  // For active current cycles, validate using the balance calculator
  const balance = await calculateVacationBalance(employeeId, currentDate)

  if (!balance) {
    // If no balance found but cycle exists and is active, allow it
    // This handles edge cases
    return { allowed: true }
  }

  // Check if the vacation date is within the balance cycle
  const balanceCycleStart = new Date(balance.cycleStartDate)
  const balanceCycleEnd = new Date(balance.cycleEndDate)
  
  // If vacation is in a different cycle than the balance, allow it if the cycle exists
  if (requestStartDate < balanceCycleStart || requestStartDate > balanceCycleEnd) {
    // Vacation is in a different cycle, but the cycle exists, so allow it
    return { allowed: true }
  }

  // Vacation is in the balance cycle, validate availability
  // If cycles don't match but vacation is in balance cycle, use balance for validation
  // This handles cases where multiple cycles might exist

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
