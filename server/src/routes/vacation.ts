import { Router } from 'express'
import { eq, and, or, between, gte, lte, sql, desc, asc, ne, inArray } from 'drizzle-orm'
import type { Request } from 'express'
import { db } from '../db/index.js'
import {
  employmentCycles,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  leaveRequestEvents,
  teamMembers,
  users,
  leaveAllocationSettings,
  clientUsers,
  clientServices,
  serviceTypes,
  clientServiceTeamMembers,
} from '../db/schema.js'
import { requireAuth as auth } from '../middleware/auth.js'
import { calculateVacationBalance, validateVacationRequest } from '../utils/vacationBalanceCalculator.js'
import { calculateDays } from '../utils/dateUtils.js'
import { calculateSickLeaveBalance } from '../utils/sickLeaveBalanceCalculator.js'
import { notifyVacationRequest } from '../utils/slack.js'
import { buildVacationRequestEmail, REQUEST_NOTIFICATION_EMAIL, sendEmail } from '../services/email.js'

const router = Router()

function notifyNewVacationRequest(options: {
  employeeName?: string | null
  employeeEmail?: string | null
  requestId: number
  leaveTypeName: string
  startDate: string
  endDate: string
  daysCount: number | string
  reason?: string | null
}) {
  notifyVacationRequest({
    employeeName: options.employeeName || null,
    employeeEmail: options.employeeEmail || 'unknown',
    requestId: options.requestId,
    leaveTypeName: options.leaveTypeName,
    startDate: options.startDate,
    endDate: options.endDate,
    daysCount: String(options.daysCount),
    reason: options.reason || null
  }).catch((err) => console.error('[SLACK] vacation notify failed:', err))

  sendEmail(buildVacationRequestEmail({
    to: REQUEST_NOTIFICATION_EMAIL,
    employeeName: options.employeeName || null,
    employeeEmail: options.employeeEmail || null,
    requestId: options.requestId,
    leaveTypeName: options.leaveTypeName,
    startDate: options.startDate,
    endDate: options.endDate,
    daysCount: options.daysCount,
    reason: options.reason || null,
  })).catch((err) => console.error('[email] vacation request notify failed:', err))
}

async function getActiveClientServiceTeamMemberIds(clientId: number) {
  const today = new Date().toISOString().split('T')[0]

  const activeServices = await db
    .select({
      id: clientServices.id,
      serviceCategory: serviceTypes.category,
    })
    .from(clientServices)
    .innerJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
    .where(and(
      eq(clientServices.clientId, clientId),
      eq(clientServices.isActive, true),
      or(
        sql`${clientServices.endDate} IS NULL`,
        gte(clientServices.endDate, today)
      )
    ))

  const relevantServiceIds = activeServices
    .filter(service =>
      service.serviceCategory === 'outsourcing' || service.serviceCategory === 'outstaffing'
    )
    .map(service => service.id)

  if (relevantServiceIds.length === 0) {
    return {
      serviceIds: [],
      teamMemberIds: [],
    }
  }

  const activeAssignments = await db
    .select({
      teamMemberId: clientServiceTeamMembers.teamMemberId,
    })
    .from(clientServiceTeamMembers)
    .where(and(
      inArray(clientServiceTeamMembers.clientServiceId, relevantServiceIds),
      eq(clientServiceTeamMembers.isActive, true),
      or(
        sql`${clientServiceTeamMembers.endDate} IS NULL`,
        gte(clientServiceTeamMembers.endDate, today)
      )
    ))

  return {
    serviceIds: relevantServiceIds,
    teamMemberIds: [...new Set(activeAssignments.map(assignment => assignment.teamMemberId))],
  }
}

// Get current employee profile (for logged-in team members)
router.get('/my-profile', auth, async (req: Request, res) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Try to get team member by teamMemberId first (more reliable)
    let member
    if ((user as any).teamMemberId) {
      try {
        const [foundMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (user as any).teamMemberId))
          .limit(1)
        member = foundMember
      } catch (error) {
        console.error('[GET /my-profile] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!member) {
      const [foundMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.email, user.email))
        .limit(1)
      member = foundMember
    }

    if (!member) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    res.json(member)
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

/**
 * Helper function to ensure default leave types exist in the database
 */
async function ensureDefaultLeaveTypes(): Promise<void> {
  const existingTypes = await db.select().from(leaveTypes)
  const typeNames = existingTypes.map(t => t.name.toLowerCase())

  const defaultTypes = [
    { name: 'Vacation', isDeductible: true, halfDaySupported: true },
    { name: 'Sick Leave', isDeductible: true, halfDaySupported: true },
    { name: 'Personal Leave', isDeductible: true, halfDaySupported: true },
  ]

  // Create types that don't exist
  const typesToCreate = defaultTypes.filter(
    type => !typeNames.includes(type.name.toLowerCase())
  )

  if (typesToCreate.length > 0) {
    try {
      await db.insert(leaveTypes).values(typesToCreate)
      console.log(`Created ${typesToCreate.length} missing leave type(s)`)
    } catch (error: unknown) {
      // If types already exist (race condition), that's fine
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (!errorMessage.includes('unique') && !errorCode.includes('23505')) {
        console.error('Error creating leave types:', error)
      }
    }
  }
}

/**
 * Helper function to automatically create an employment cycle based on employee start date
 */
async function autoCreateEmploymentCycle(employeeId: number): Promise<boolean> {
  try {
    // Ensure default leave types exist
    await ensureDefaultLeaveTypes()

    // Get team member with start date
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, employeeId))
      .limit(1)

    if (!member || !member.startDate) {
      return false // No start date available
    }

    // Check if cycle already exists
    const existingCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, employeeId))
      .limit(1)

    if (existingCycles.length > 0) {
      return false // Cycle already exists
    }

    // Create cycle based on start date
    const startDate = new Date(member.startDate)
    const cycleStart = startDate.toISOString().split('T')[0]

    // Calculate end date (1 year from start)
    const endDate = new Date(startDate)
    endDate.setFullYear(startDate.getFullYear() + 1)
    const cycleEnd = endDate.toISOString().split('T')[0]

    // Calculate midpoint (6 months from start) for 50/50 vacation split
    const midpointDate = new Date(startDate)
    midpointDate.setMonth(startDate.getMonth() + 6)
    const cycleMidpoint = midpointDate.toISOString().split('T')[0]

    // Determine if cycle should be active based on start date
    // If start date is in the future, mark as inactive
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0) // Reset time to compare dates only
    const startDateOnly = new Date(startDate)
    startDateOnly.setHours(0, 0, 0, 0)

    const isActive = startDateOnly <= currentDate

    // Create employment cycle
    const [cycle] = await db
      .insert(employmentCycles)
      .values({
        employeeId,
        cycleStart,
        cycleEnd,
        cycleMidpoint,
        isActive,
      })
      .returning()

    // Get all leave types (should exist now after ensureDefaultLeaveTypes)
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

    console.log(`Auto-created employment cycle for employee ${employeeId} based on start date ${cycleStart}`)
    return true
  } catch (error) {
    console.error('Error auto-creating employment cycle:', error)
    return false
  }
}

// Get vacation balance for current employee (50/50 milestone rule)
router.get('/my-balance', auth, async (req: Request, res) => {
  const user = req.user
  try {
    if (!user) {
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(401).json({ error: 'Authentication required' })
    }

    console.log(`[GET /my-balance] Request from user: ${user.email}, userId: ${user.id}, teamMemberId: ${(user as any).teamMemberId}`)

    // Ensure default leave types exist first
    await ensureDefaultLeaveTypes()

    // Try to get team member by teamMemberId first (more reliable)
    let member
    if ((user as any).teamMemberId) {
      try {
        const [foundMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (user as any).teamMemberId))
          .limit(1)
        member = foundMember
        if (member) {
          console.log(`[GET /my-balance] Found member by teamMemberId: ${member.id}, ${member.name}`)
        }
      } catch (error) {
        console.error('[GET /my-balance] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!member) {
      try {
        const [foundMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.email, user.email))
          .limit(1)
        member = foundMember
        if (member) {
          console.log(`[GET /my-balance] Found member by email: ${member.id}, ${member.name}`)
        }
      } catch (error) {
        console.error('[GET /my-balance] Error fetching by email:', error)
      }
    }

    if (!member) {
      console.log(`[GET /my-balance] Member not found for email: ${user.email}, teamMemberId: ${(user as any).teamMemberId}`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: 'Employee profile not found' })
    }

    console.log(`[GET /my-balance] Found member: ${member.id}, ${member.name}`)

    // First, check if employee has any cycles at all
    let existingCycles
    try {
      existingCycles = await db
        .select()
        .from(employmentCycles)
        .where(eq(employmentCycles.employeeId, member.id))
        .limit(1)
      console.log(`[GET /my-balance] Found ${existingCycles.length} existing cycle(s)`)
    } catch (dbError) {
      console.error('[GET /my-balance] Database error fetching cycles:', dbError)
      throw dbError
    }

    // If no cycles exist and employee has start date, try to auto-create cycle
    if (existingCycles.length === 0 && member.startDate) {
      console.log(`[GET /my-balance] Auto-creating employment cycle for member ${member.id}`)
      try {
        await autoCreateEmploymentCycle(member.id)
      } catch (cycleError) {
        console.error('[GET /my-balance] Error auto-creating cycle:', cycleError)
        // Don't fail if cycle creation fails, just log it
      }
    }

    let balance
    try {
      balance = await calculateVacationBalance(member.id)
      console.log(`[GET /my-balance] Balance calculated:`, balance ? 'success' : 'null')
    } catch (calcError) {
      console.error('[GET /my-balance] Error calculating balance:', calcError)
      const err = calcError as Error
      console.error('[GET /my-balance] Calculation error stack:', err.stack)
      throw calcError
    }

    if (!balance) {
      console.log(`[GET /my-balance] No balance calculated for member ${member.id}`)
      // Provide a more helpful error message
      if (member.startDate) {
        const startDate = new Date(member.startDate)
        const currentDate = new Date()
        if (startDate > currentDate) {
          const origin = req.headers.origin
          if (origin) {
            res.header('Access-Control-Allow-Origin', origin)
            res.header('Access-Control-Allow-Credentials', 'true')
          }
          return res.status(404).json({
            error: `Your employment cycle starts on ${startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}. Your vacation balance will be available once your employment begins.`
          })
        }
      }
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: 'Please contact an administrator to set up your employment cycle.' })
    }

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.json(balance)
  } catch (error) {
    const err = error as Error
    console.error('========================================')
    console.error('[GET /my-balance] ERROR:', err.message)
    console.error('[GET /my-balance] Stack:', err.stack)
    console.error('[GET /my-balance] User:', user ? { id: user.id, email: user.email } : 'no user')
    console.error('========================================')

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to fetch vacation balance' })
  }
})

// Get sick leave balance for current user
router.get('/my-sick-leave-balance', auth, async (req: Request, res) => {
  const user = req.user
  try {

    // Find team member by email
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, user.email))
      .limit(1)

    if (!member) {
      return res.status(404).json({ error: 'Employee profile not found' })
    }

    const balance = await calculateSickLeaveBalance(member.id)

    if (!balance) {
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    res.json(balance)
  } catch (error) {
    console.error('Error fetching sick leave balance:', error)
    res.status(500).json({ error: 'Failed to fetch sick leave balance' })
  }
})

// Get vacation balance for a specific employee (admin only, 50/50 milestone rule)
router.get('/balance/:employeeId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { employeeId } = req.params

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const balance = await calculateVacationBalance(parseInt(employeeId))

    if (!balance) {
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    res.json(balance)
  } catch (error) {
    console.error('Error fetching vacation balance:', error)
    res.status(500).json({ error: 'Failed to fetch vacation balance' })
  }
})

// Get current employee's vacation requests
router.get('/my-requests', auth, async (req: Request, res) => {
  try {
    const user = req.user
    if (!user) {
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(401).json({ error: 'Authentication required' })
    }

    console.log(`[GET /my-requests] Request from user: ${user.email}, userId: ${user.id}, teamMemberId: ${(user as any).teamMemberId}`)

    // Try to get team member by teamMemberId first (more reliable)
    let member
    if ((user as any).teamMemberId) {
      try {
        const [foundMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (user as any).teamMemberId))
          .limit(1)
        member = foundMember
        if (member) {
          console.log(`[GET /my-requests] Found member by teamMemberId: ${member.id}, ${member.name}`)
        }
      } catch (error) {
        console.error('[GET /my-requests] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!member) {
      const [foundMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.email, user.email))
        .limit(1)
      member = foundMember
      if (member) {
        console.log(`[GET /my-requests] Found member by email: ${member.id}, ${member.name}`)
      }
    }

    if (!member) {
      console.log(`[GET /my-requests] Member not found for email: ${user.email}, teamMemberId: ${(user as any).teamMemberId}`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.json([]) // Return empty array instead of 404 for better UX
    }

    // Get all leave requests for this employee
    const requests = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.employeeId, member.id))
      .orderBy(desc(leaveRequests.createdAt))

    // Get all cycles for this employee to determine which cycle each request belongs to
    const allCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, member.id))
      .orderBy(employmentCycles.cycleStart)

    // Get current cycle (the one that contains today's date or the most recent)
    const currentDate = new Date()
    const currentCycle = allCycles.find(c => {
      const cStart = new Date(c.cycleStart)
      const cEnd = new Date(c.cycleEnd)
      return currentDate >= cStart && currentDate <= cEnd
    }) || allCycles[allCycles.length - 1]

    // Get leave types separately and map them
    const leaveTypesData = await db.select().from(leaveTypes)
    const leaveTypeMap = new Map(leaveTypesData.map(lt => [lt.id, lt.name]))

    // Map requests to include leave type name and cycle information
    const requestsWithTypes = requests.map(req => {
      // Find which cycle this request belongs to
      const requestDate = new Date(req.startDate)
      const requestCycle = allCycles.find(c => {
        const cStart = new Date(c.cycleStart)
        const cEnd = new Date(c.cycleEnd)
        return requestDate >= cStart && requestDate <= cEnd
      })

      // Determine if this request is from a different cycle than the current one
      let isOldCycle = false
      let isFutureCycle = false

      if (requestCycle && currentCycle) {
        if (requestCycle.id !== currentCycle.id) {
          const requestCycleEnd = new Date(requestCycle.cycleEnd)
          const currentCycleStart = new Date(currentCycle.cycleStart)
          const currentCycleEnd = new Date(currentCycle.cycleEnd)

          // Old cycle: request cycle ended before current cycle started
          if (requestCycleEnd < currentCycleStart) {
            isOldCycle = true
          }
          // Future cycle: request cycle starts after current cycle ends
          else if (new Date(requestCycle.cycleStart) > currentCycleEnd) {
            isFutureCycle = true
          }
        }
      }

      return {
        id: req.id,
        employeeId: req.employeeId,
        leaveTypeId: req.leaveTypeId,
        startDate: req.startDate,
        endDate: req.endDate,
        halfDayStart: req.halfDayStart,
        halfDayEnd: req.halfDayEnd,
        totalDays: req.daysCount,
        reason: req.reason,
        status: req.status,
        decisionNote: req.decisionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        type: leaveTypeMap.get(req.leaveTypeId) || 'Unknown',
        cycleId: requestCycle?.id || null,
        isOldCycle: isOldCycle,
        isFutureCycle: isFutureCycle,
        cycleInfo: requestCycle ? {
          cycleStart: requestCycle.cycleStart,
          cycleEnd: requestCycle.cycleEnd,
          isActive: requestCycle.isActive
        } : null
      }
    })

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.json(requestsWithTypes)
  } catch (error) {
    console.error('[GET /my-requests] Error fetching leave requests:', error)
    const err = error as Error
    console.error('[GET /my-requests] Error stack:', err.stack)
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to fetch leave requests' })
  }
})

// Get current employment cycle for an employee
router.get('/employment-cycle/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params
    const currentDate = new Date().toISOString().split('T')[0]

    console.log(`[GET /employment-cycle/:employeeId] Request for employeeId: ${employeeId}`)

    const cycle = await db
      .select()
      .from(employmentCycles)
      .where(
        and(
          eq(employmentCycles.employeeId, parseInt(employeeId)),
          eq(employmentCycles.isActive, true),
          lte(employmentCycles.cycleStart, currentDate),
          gte(employmentCycles.cycleEnd, currentDate)
        )
      )
      .limit(1)

    if (cycle.length === 0) {
      console.log(`[GET /employment-cycle/:employeeId] No active cycle found for employeeId: ${employeeId}`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.json(cycle[0])
  } catch (error) {
    console.error('[GET /employment-cycle/:employeeId] Error fetching employment cycle:', error)
    const err = error as Error
    console.error('[GET /employment-cycle/:employeeId] Error stack:', err.stack)
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to fetch employment cycle' })
  }
})

// Get leave balances for an employee
router.get('/balances/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params

    // Get current cycle
    const currentDate = new Date().toISOString().split('T')[0]
    const cycle = await db
      .select()
      .from(employmentCycles)
      .where(
        and(
          eq(employmentCycles.employeeId, parseInt(employeeId)),
          eq(employmentCycles.isActive, true),
          lte(employmentCycles.cycleStart, currentDate),
          gte(employmentCycles.cycleEnd, currentDate)
        )
      )
      .limit(1)

    if (cycle.length === 0) {
      console.log(`[GET /balances/:employeeId] No active cycle found for employeeId: ${employeeId}`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    // Get balances for this cycle
    const balances = await db
      .select({
        leaveType: leaveTypes,
        balance: leaveBalances,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveBalances.employeeId, parseInt(employeeId)),
          eq(leaveBalances.employmentCycleId, cycle[0].id)
        )
      )

    // Calculate used and pending days for each leave type
    const balancesWithUsage = await Promise.all(
      balances.map(async ({ leaveType, balance }) => {
        // Get approved requests
        const approvedRequests = await db
          .select({
            daysCount: leaveRequests.daysCount,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, parseInt(employeeId)),
              eq(leaveRequests.leaveTypeId, leaveType.id),
              eq(leaveRequests.status, 'approved'),
              gte(leaveRequests.startDate, cycle[0].cycleStart),
              lte(leaveRequests.endDate, cycle[0].cycleEnd)
            )
          )

        // Get pending requests
        const pendingRequests = await db
          .select({
            daysCount: leaveRequests.daysCount,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, parseInt(employeeId)),
              eq(leaveRequests.leaveTypeId, leaveType.id),
              eq(leaveRequests.status, 'pending'),
              gte(leaveRequests.startDate, cycle[0].cycleStart),
              lte(leaveRequests.endDate, cycle[0].cycleEnd)
            )
          )

        const usedDays = approvedRequests.reduce((sum, r) => sum + parseFloat(r.daysCount.toString()), 0)
        const pendingDays = pendingRequests.reduce((sum, r) => sum + parseFloat(r.daysCount.toString()), 0)
        const totalAllocated = parseFloat(balance.totalDays.toString())
        const adjustments = parseFloat(balance.adjustmentDays?.toString() || '0')
        const available = totalAllocated + adjustments - usedDays

        return {
          leaveType: leaveType.name,
          leaveTypeId: leaveType.id,
          totalAllocated,
          used: usedDays,
          pending: pendingDays,
          adjustments,
          available,
        }
      })
    )

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.json({
      employmentCycle: cycle[0],
      balances: balancesWithUsage,
    })
  } catch (error) {
    console.error('[GET /balances/:employeeId] Error fetching leave balances:', error)
    const err = error as Error
    console.error('[GET /balances/:employeeId] Error stack:', err.stack)
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to fetch leave balances' })
  }
})

// Alternative endpoint path for leave balances (used by TeamMemberDetails frontend)
router.get('/employees/:employeeId/balances', auth, async (req, res) => {
  try {
    const { employeeId } = req.params

    // Get current cycle
    const currentDate = new Date().toISOString().split('T')[0]
    const cycle = await db
      .select()
      .from(employmentCycles)
      .where(
        and(
          eq(employmentCycles.employeeId, parseInt(employeeId)),
          eq(employmentCycles.isActive, true),
          lte(employmentCycles.cycleStart, currentDate),
          gte(employmentCycles.cycleEnd, currentDate)
        )
      )
      .limit(1)

    if (cycle.length === 0) {
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    // Get balances for this cycle
    const balances = await db
      .select({
        leaveType: leaveTypes,
        balance: leaveBalances,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveBalances.employeeId, parseInt(employeeId)),
          eq(leaveBalances.employmentCycleId, cycle[0].id)
        )
      )

    // Calculate used and pending days for each leave type
    const balancesWithUsage = await Promise.all(
      balances.map(async ({ leaveType, balance }) => {
        // Get approved requests
        const approvedRequests = await db
          .select({
            daysCount: leaveRequests.daysCount,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, parseInt(employeeId)),
              eq(leaveRequests.leaveTypeId, leaveType.id),
              eq(leaveRequests.status, 'approved'),
              gte(leaveRequests.startDate, cycle[0].cycleStart),
              lte(leaveRequests.endDate, cycle[0].cycleEnd)
            )
          )

        // Get pending requests
        const pendingRequests = await db
          .select({
            daysCount: leaveRequests.daysCount,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, parseInt(employeeId)),
              eq(leaveRequests.leaveTypeId, leaveType.id),
              eq(leaveRequests.status, 'pending'),
              gte(leaveRequests.startDate, cycle[0].cycleStart),
              lte(leaveRequests.endDate, cycle[0].cycleEnd)
            )
          )

        const usedDays = approvedRequests.reduce((sum, r) => sum + parseFloat(r.daysCount.toString()), 0)
        const pendingDays = pendingRequests.reduce((sum, r) => sum + parseFloat(r.daysCount.toString()), 0)
        const totalAllocated = parseFloat(balance.totalDays.toString())
        const adjustments = parseFloat(balance.adjustmentDays?.toString() || '0')
        const available = totalAllocated + adjustments - usedDays

        return {
          leaveTypeName: leaveType.name,
          leaveTypeId: leaveType.id,
          totalDays: totalAllocated.toString(),
          usedDays: usedDays,
          pendingDays: pendingDays,
          adjustmentDays: adjustments.toString(),
          availableDays: available.toString(),
        }
      })
    )

    res.json(balancesWithUsage)
  } catch (error) {
    console.error('Error fetching employee leave balances:', error)
    res.status(500).json({ error: 'Failed to fetch leave balances' })
  }
})

// Get leave requests history for an employee
router.get('/requests/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params
    const { status, cycleId } = req.query

    let conditions = [eq(leaveRequests.employeeId, parseInt(employeeId))]

    if (status) {
      conditions.push(eq(leaveRequests.status, status as string))
    }

    const query = db
      .select({
        request: leaveRequests,
        leaveType: leaveTypes,
        requestedBy: {
          id: sql`requestedByUser.id`,
          username: sql`requestedByUser.username`,
          fullName: sql`requestedByUser.full_name`,
          email: sql`requestedByUser.email`,
        },
        decisionBy: {
          id: sql`decisionByUser.id`,
          username: sql`decisionByUser.username`,
          fullName: sql`decisionByUser.full_name`,
          email: sql`decisionByUser.email`,
        },
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .innerJoin(sql`users AS requestedByUser`, eq(leaveRequests.requestedBy, sql`requestedByUser.id`))
      .leftJoin(sql`users AS decisionByUser`, eq(leaveRequests.decisionBy, sql`decisionByUser.id`))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveRequests.createdAt))

    const requests = await query

    // Get all cycles for this employee to determine which cycle each request belongs to
    const allCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, parseInt(employeeId)))
      .orderBy(employmentCycles.cycleStart)

    // Get current cycle (the one that contains today's date or the most recent)
    const currentDate = new Date()
    const currentCycle = allCycles.find(c => {
      const cStart = new Date(c.cycleStart)
      const cEnd = new Date(c.cycleEnd)
      return currentDate >= cStart && currentDate <= cEnd
    }) || allCycles[allCycles.length - 1]

    // Add cycle information to each request
    interface RequestWithDetails {
      request: typeof leaveRequests.$inferSelect
      leaveType: typeof leaveTypes.$inferSelect
      requestedBy: { id: number; username: string; fullName: string; email: string }
      decisionBy: { id: number; username: string; fullName: string; email: string } | null
    }

    const requestsWithCycleInfo = requests.map((item: RequestWithDetails) => {
      const requestDate = new Date(item.request.startDate)
      const requestCycle = allCycles.find(c => {
        const cStart = new Date(c.cycleStart)
        const cEnd = new Date(c.cycleEnd)
        return requestDate >= cStart && requestDate <= cEnd
      })

      // Determine if this request is from a different cycle than the current one
      let isOldCycle = false
      let isFutureCycle = false

      if (requestCycle && currentCycle) {
        if (requestCycle.id !== currentCycle.id) {
          const requestCycleEnd = new Date(requestCycle.cycleEnd)
          const currentCycleStart = new Date(currentCycle.cycleStart)
          const currentCycleEnd = new Date(currentCycle.cycleEnd)

          // Old cycle: request cycle ended before current cycle started
          if (requestCycleEnd < currentCycleStart) {
            isOldCycle = true
          }
          // Future cycle: request cycle starts after current cycle ends
          else if (new Date(requestCycle.cycleStart) > currentCycleEnd) {
            isFutureCycle = true
          }
        }
      }

      return {
        ...item,
        cycleId: requestCycle?.id || null,
        isOldCycle: isOldCycle,
        isFutureCycle: isFutureCycle,
        cycleInfo: requestCycle ? {
          cycleStart: requestCycle.cycleStart,
          cycleEnd: requestCycle.cycleEnd,
          isActive: requestCycle.isActive
        } : null
      }
    })

    res.json(requestsWithCycleInfo)
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    res.status(500).json({ error: 'Failed to fetch leave requests' })
  }
})

// Get all leave requests (admin view)
router.get('/requests', auth, async (req, res) => {
  try {
    const user = (req as any).user

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { status, employeeId, startDate, endDate, clientId } = req.query

    let conditions = []

    if (status) {
      conditions.push(eq(leaveRequests.status, status as string))
    }

    if (employeeId) {
      conditions.push(eq(leaveRequests.employeeId, parseInt(employeeId as string)))
    }

    if (startDate && endDate) {
      conditions.push(
        or(
          between(leaveRequests.startDate, startDate as string, endDate as string),
          between(leaveRequests.endDate, startDate as string, endDate as string)
        )
      )
    }

    if (clientId) {
      const parsedClientId = parseInt(clientId as string)

      if (Number.isNaN(parsedClientId)) {
        return res.status(400).json({ error: 'Invalid client ID' })
      }

      const { teamMemberIds } = await getActiveClientServiceTeamMemberIds(parsedClientId)

      if (teamMemberIds.length === 0) {
        return res.json([])
      }

      conditions.push(inArray(leaveRequests.employeeId, teamMemberIds))
    }

    const requests = await db
      .select({
        request: leaveRequests,
        leaveType: leaveTypes,
        employee: teamMembers,
        requestedBy: {
          id: sql`requestedByUser.id`,
          username: sql`requestedByUser.username`,
          fullName: sql`requestedByUser.full_name`,
          email: sql`requestedByUser.email`,
        },
        decisionBy: {
          id: sql`decisionByUser.id`,
          username: sql`decisionByUser.username`,
          fullName: sql`decisionByUser.full_name`,
          email: sql`decisionByUser.email`,
        },
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .innerJoin(sql`users AS requestedByUser`, eq(leaveRequests.requestedBy, sql`requestedByUser.id`))
      .leftJoin(sql`users AS decisionByUser`, eq(leaveRequests.decisionBy, sql`decisionByUser.id`))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveRequests.createdAt))

    res.json(requests)
  } catch (error) {
    console.error('Error fetching all leave requests:', error)
    res.status(500).json({ error: 'Failed to fetch leave requests' })
  }
})

// Submit a leave request
router.post('/requests', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
      reason,
    } = req.body

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }

    // Calculate days (weekdays only — weekends excluded)
    const daysCount = calculateDays(
      new Date(startDate),
      new Date(endDate),
      halfDayStart || false,
      halfDayEnd || false
    )

    if (daysCount <= 0) {
      return res.status(400).json({
        error: 'Selected date range has no working days (weekends are not counted). Please choose weekdays.'
      })
    }

    // Validate vacation balance for vacation/PTO requests (50/50 rule)
    // Get vacation leave type to check if this is a vacation request
    const vacationTypes = await db
      .select()
      .from(leaveTypes)
      .where(
        sql`LOWER(${leaveTypes.name}) IN ('vacation', 'annual leave', 'paid time off', 'pto')`
      )
      .limit(1)

    if (vacationTypes.length > 0 && leaveTypeId === vacationTypes[0].id) {
      // This is a vacation request - validate against 50/50 rule
      const validation = await validateVacationRequest(
        employeeId,
        startDate,
        daysCount,
        new Date(),
        endDate,
        halfDayStart || false,
        halfDayEnd || false
      )

      if (!validation.allowed) {
        return res.status(400).json({
          error: validation.reason || 'Insufficient vacation days available'
        })
      }
    }

    // Validate sick leave balance (no 50/50 rule, just total cycle limit)
    const sickLeaveTypes = await db
      .select()
      .from(leaveTypes)
      .where(
        sql`LOWER(${leaveTypes.name}) IN ('sick leave', 'sick', 'sick day', 'sick days')`
      )
      .limit(1)

    if (sickLeaveTypes.length > 0 && leaveTypeId === sickLeaveTypes[0].id) {
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

      if (cycles.length > 0) {
        const cycle = cycles[0]

        // Get total sick leave used in this cycle
        const sickLeaveRequests = await db
          .select()
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, employeeId),
              eq(leaveRequests.leaveTypeId, sickLeaveTypes[0].id),
              eq(leaveRequests.status, 'approved'),
              gte(leaveRequests.startDate, cycle.cycleStart),
              lte(leaveRequests.startDate, cycle.cycleEnd)
            )
          )

        const totalSickLeaveUsed = sickLeaveRequests.reduce(
          (sum, req) => sum + parseFloat(req.daysCount),
          0
        )

        // Check if there's an allocation in leave_balances for this cycle
        const balances = await db
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.employeeId, employeeId),
              eq(leaveBalances.employmentCycleId, cycle.id),
              eq(leaveBalances.leaveTypeId, sickLeaveTypes[0].id)
            )
          )
          .limit(1)

        // Default sick leave allocation is 7 days per cycle
        let totalSickLeaveAllocation = 7
        if (balances.length > 0) {
          const allocatedDays = parseFloat(balances[0].totalDays || '7')
          const adjustmentDays = parseFloat(balances[0].adjustmentDays || '0')
          totalSickLeaveAllocation = allocatedDays + adjustmentDays
        }

        const remainingSickLeave = totalSickLeaveAllocation - totalSickLeaveUsed

        if (daysCount > remainingSickLeave) {
          return res.status(400).json({
            error: `Insufficient sick leave. You have ${remainingSickLeave.toFixed(1)} days remaining out of ${totalSickLeaveAllocation} days for this employment cycle.`
          })
        }
      }
    }

    // Check for overlapping requests
    // Only check for pending or approved requests (exclude denied and cancelled)
    // Two date ranges overlap if: start1 <= end2 AND start2 <= end1
    const overlapping = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.leaveTypeId, leaveTypeId),
          or(
            eq(leaveRequests.status, 'pending'),
            eq(leaveRequests.status, 'approved')
          ),
          // Simplified overlap check: (existing_start <= new_end) AND (existing_end >= new_start)
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate)
        )
      )

    if (overlapping.length > 0) {
      return res.status(400).json({
        error: 'Overlapping leave request exists for the same dates and leave type'
      })
    }

    // Create the request
    const [newRequest] = await db
      .insert(leaveRequests)
      .values({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        halfDayStart: halfDayStart || false,
        halfDayEnd: halfDayEnd || false,
        daysCount: daysCount.toString(),
        reason,
        requestedBy: user.id,
        status: 'pending',
      })
      .returning()

    // Create audit event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: newRequest.id,
      status: 'pending',
      actorId: user.id,
      note: 'Request submitted',
    })

    // Get leave type name and employee info for Slack notification
    const leaveType = await db
      .select({ name: leaveTypes.name })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, leaveTypeId))
      .limit(1)

    const employee = await db
      .select({ name: teamMembers.name, email: teamMembers.email })
      .from(teamMembers)
      .where(eq(teamMembers.id, employeeId))
      .limit(1)

    if (leaveType.length > 0 && employee.length > 0) {
      notifyNewVacationRequest({
        employeeName: employee[0].name || null,
        employeeEmail: employee[0].email,
        requestId: newRequest.id,
        leaveTypeName: leaveType[0].name,
        startDate,
        endDate,
        daysCount: daysCount.toString(),
        reason: reason || null
      })
    }

    res.json(newRequest)
  } catch (error) {
    console.error('Error creating leave request:', error)
    res.status(500).json({ error: 'Failed to create leave request' })
  }
})

// Create and auto-approve a leave request (for admin calendar)
router.post('/admin/create-and-approve', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
      autoApprove,
    } = req.body

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }

    // Calculate days (weekdays only — weekends excluded)
    const daysCount = calculateDays(
      new Date(startDate),
      new Date(endDate),
      false,
      false
    )

    if (daysCount <= 0) {
      return res.status(400).json({
        error: 'Selected date range has no working days (weekends are not counted). Please choose weekdays.'
      })
    }

    // Check for overlapping requests
    // Only check for pending or approved requests (exclude denied and cancelled)
    // Two date ranges overlap if: start1 <= end2 AND start2 <= end1
    const overlapping = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.leaveTypeId, leaveTypeId),
          or(
            eq(leaveRequests.status, 'pending'),
            eq(leaveRequests.status, 'approved')
          ),
          // Simplified overlap check: (existing_start <= new_end) AND (existing_end >= new_start)
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate)
        )
      )

    if (overlapping.length > 0) {
      return res.status(400).json({
        error: 'Overlapping leave request exists for the same dates and leave type'
      })
    }

    // Create the request with auto-approval
    const [newRequest] = await db
      .insert(leaveRequests)
      .values({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        halfDayStart: false,
        halfDayEnd: false,
        daysCount: daysCount.toString(),
        reason,
        requestedBy: user.id,
        status: autoApprove ? 'approved' : 'pending',
        decisionBy: autoApprove ? user.id : null,
        decisionAt: autoApprove ? new Date() : null,
        decisionReason: autoApprove ? 'Auto-approved by admin from calendar' : null,
      })
      .returning()

    // Create audit event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: newRequest.id,
      status: autoApprove ? 'approved' : 'pending',
      actorId: user.id,
      note: autoApprove ? 'Auto-approved by admin from calendar' : 'Request submitted',
    })

    const leaveType = await db
      .select({ name: leaveTypes.name })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, leaveTypeId))
      .limit(1)

    const employee = await db
      .select({ name: teamMembers.name, email: teamMembers.email })
      .from(teamMembers)
      .where(eq(teamMembers.id, employeeId))
      .limit(1)

    if (leaveType.length > 0 && employee.length > 0) {
      notifyNewVacationRequest({
        employeeName: employee[0].name || null,
        employeeEmail: employee[0].email,
        requestId: newRequest.id,
        leaveTypeName: leaveType[0].name,
        startDate,
        endDate,
        daysCount: daysCount.toString(),
        reason: reason || null
      })
    }

    res.json(newRequest)
  } catch (error) {
    console.error('Error creating leave request:', error)
    res.status(500).json({ error: 'Failed to create leave request' })
  }
})

// Update leave request details
router.put('/requests/:requestId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { requestId } = req.params
    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
      reason,
    } = req.body

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update leave requests' })
    }

    // Get existing request
    const existing = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .limit(1)

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }

    // Use provided dates or existing dates
    const finalStartDate = startDate || existing[0].startDate
    const finalEndDate = endDate || existing[0].endDate
    const finalLeaveTypeId = leaveTypeId !== undefined ? parseInt(leaveTypeId) : existing[0].leaveTypeId
    const finalEmployeeId = employeeId !== undefined ? parseInt(employeeId) : existing[0].employeeId

    // Check for overlapping requests (excluding the current request being updated)
    const overlapping = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, finalEmployeeId),
          eq(leaveRequests.leaveTypeId, finalLeaveTypeId),
          ne(leaveRequests.id, parseInt(requestId)), // Exclude the current request
          or(
            eq(leaveRequests.status, 'pending'),
            eq(leaveRequests.status, 'approved')
          ),
          // Simplified overlap check: (existing_start <= new_end) AND (existing_end >= new_start)
          lte(leaveRequests.startDate, finalEndDate),
          gte(leaveRequests.endDate, finalStartDate)
        )
      )

    if (overlapping.length > 0) {
      return res.status(400).json({
        error: 'Overlapping leave request exists for the same dates and leave type'
      })
    }

    // Calculate days if dates are provided
    let daysCount = existing[0].daysCount
    if (startDate && endDate) {
      const computedDays = calculateDays(
        new Date(startDate),
        new Date(endDate),
        halfDayStart !== undefined ? halfDayStart : existing[0].halfDayStart || false,
        halfDayEnd !== undefined ? halfDayEnd : existing[0].halfDayEnd || false
      )
      if (computedDays <= 0) {
        return res.status(400).json({
          error: 'Selected date range has no working days (weekends are not counted). Please choose weekdays.'
        })
      }
      daysCount = computedDays.toString()
    }

    // Update the request
    const updated = await db
      .update(leaveRequests)
      .set({
        employeeId: employeeId !== undefined ? parseInt(employeeId) : existing[0].employeeId,
        leaveTypeId: leaveTypeId !== undefined ? parseInt(leaveTypeId) : existing[0].leaveTypeId,
        startDate: startDate || existing[0].startDate,
        endDate: endDate || existing[0].endDate,
        halfDayStart: halfDayStart !== undefined ? halfDayStart : existing[0].halfDayStart,
        halfDayEnd: halfDayEnd !== undefined ? halfDayEnd : existing[0].halfDayEnd,
        reason: reason !== undefined ? reason : existing[0].reason,
        daysCount,
      })
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .returning()

    // Create audit event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: parseInt(requestId),
      status: existing[0].status,
      actorId: user.id,
      note: 'Request details updated by admin',
    })

    res.json(updated[0])
  } catch (error) {
    console.error('Error updating leave request:', error)
    res.status(500).json({ error: 'Failed to update leave request' })
  }
})

// Get calendar events (approved leave requests for calendar display)
router.get('/calendar-events', auth, async (req, res) => {
  try {
    // Get all approved leave requests with employee and leave type info
    const approvedRequests = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: teamMembers.name,
        leaveType: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
        daysCount: leaveRequests.daysCount,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
      })
      .from(leaveRequests)
      .leftJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(eq(leaveRequests.status, 'approved'))
      .orderBy(desc(leaveRequests.startDate))

    res.json(approvedRequests)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    res.status(500).json({ error: 'Failed to fetch calendar events' })
  }
})

// Update leave request status (approve/deny)
router.put('/requests/:requestId/status', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { requestId } = req.params
    const { status, decisionReason } = req.body

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Validate status
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Get the request
    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .limit(1)

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be updated' })
    }

    // If approving, validate based on leave type
    if (status === 'approved') {
      console.log(`[APPROVE REQUEST] Approving request ${requestId} for employee ${request.employeeId}`)
      console.log(`[APPROVE REQUEST] Request details: ${request.startDate} - ${request.endDate}, ${request.daysCount} days`)

      // Determine the leave type to apply the correct validation
      const vacationTypes = await db
        .select()
        .from(leaveTypes)
        .where(
          sql`LOWER(${leaveTypes.name}) IN ('vacation', 'annual leave', 'paid time off', 'pto')`
        )
        .limit(1)

      const sickLeaveTypes = await db
        .select()
        .from(leaveTypes)
        .where(
          sql`LOWER(${leaveTypes.name}) IN ('sick leave', 'sick', 'sick day', 'sick days')`
        )
        .limit(1)

      const isVacationRequest = vacationTypes.length > 0 && request.leaveTypeId === vacationTypes[0].id
      const isSickLeaveRequest = sickLeaveTypes.length > 0 && request.leaveTypeId === sickLeaveTypes[0].id

      if (isVacationRequest) {
        // Vacation request - validate using 50/50 milestone rule
        const validation = await validateVacationRequest(
          request.employeeId,
          request.startDate,
          parseFloat(request.daysCount.toString()),
          new Date(),
          request.endDate,
          request.halfDayStart || false,
          request.halfDayEnd || false
        )

        if (!validation.allowed) {
          console.log(`[APPROVE REQUEST] Vacation validation failed: ${validation.reason}`)
          return res.status(400).json({
            error: validation.reason || 'Insufficient vacation days available'
          })
        }
      } else if (isSickLeaveRequest) {
        // Sick leave request - validate against sick leave balance (7 days/cycle, no 50/50 rule)
        const cycles = await db
          .select()
          .from(employmentCycles)
          .where(
            and(
              eq(employmentCycles.employeeId, request.employeeId),
              eq(employmentCycles.isActive, true)
            )
          )
          .limit(1)

        if (cycles.length > 0) {
          const cycle = cycles[0]

          const sickLeaveRequestsInCycle = await db
            .select()
            .from(leaveRequests)
            .where(
              and(
                eq(leaveRequests.employeeId, request.employeeId),
                eq(leaveRequests.leaveTypeId, sickLeaveTypes[0].id),
                eq(leaveRequests.status, 'approved'),
                gte(leaveRequests.startDate, cycle.cycleStart),
                lte(leaveRequests.startDate, cycle.cycleEnd)
              )
            )

          const totalSickLeaveUsed = sickLeaveRequestsInCycle.reduce(
            (sum, req) => sum + parseFloat(req.daysCount),
            0
          )

          const balances = await db
            .select()
            .from(leaveBalances)
            .where(
              and(
                eq(leaveBalances.employeeId, request.employeeId),
                eq(leaveBalances.employmentCycleId, cycle.id),
                eq(leaveBalances.leaveTypeId, sickLeaveTypes[0].id)
              )
            )
            .limit(1)

          let totalSickLeaveAllocation = 7
          if (balances.length > 0) {
            const allocatedDays = parseFloat(balances[0].totalDays || '7')
            const adjustmentDays = parseFloat(balances[0].adjustmentDays || '0')
            totalSickLeaveAllocation = allocatedDays + adjustmentDays
          }

          const remainingSickLeave = totalSickLeaveAllocation - totalSickLeaveUsed
          const requestedDays = parseFloat(request.daysCount.toString())

          if (requestedDays > remainingSickLeave) {
            console.log(`[APPROVE REQUEST] Sick leave validation failed: ${remainingSickLeave} days remaining`)
            return res.status(400).json({
              error: `Insufficient sick leave. Employee has ${remainingSickLeave.toFixed(1)} days remaining out of ${totalSickLeaveAllocation} days for this employment cycle.`
            })
          }
        }
      }

      console.log(`[APPROVE REQUEST] Validation passed, updating request status to approved`)

      // Find the cycle that contains the leave date (only activate cycles for vacation requests)
      if (isVacationRequest) {
        const vacationDate = new Date(request.startDate)
        const allCycles = await db
          .select()
          .from(employmentCycles)
          .where(eq(employmentCycles.employeeId, request.employeeId))
          .orderBy(employmentCycles.cycleStart)

        const cycleForVacation = allCycles.find(c => {
          const cStart = new Date(c.cycleStart)
          const cEnd = new Date(c.cycleEnd)
          return vacationDate >= cStart && vacationDate <= cEnd
        })

        // If the vacation is in a future cycle, activate that cycle and deactivate older ones
        if (cycleForVacation && !cycleForVacation.isActive) {
          const cycleStart = new Date(cycleForVacation.cycleStart)
          const currentDate = new Date()

          // If cycle is in the future or starts today, activate it
          if (cycleStart >= currentDate || cycleStart.toDateString() === currentDate.toDateString()) {
            // Deactivate all other cycles for this employee
            await db
              .update(employmentCycles)
              .set({ isActive: false })
              .where(eq(employmentCycles.employeeId, request.employeeId))

            // Activate the cycle for this vacation
            await db
              .update(employmentCycles)
              .set({ isActive: true })
              .where(eq(employmentCycles.id, cycleForVacation.id))

            console.log(`Activated cycle ${cycleForVacation.id} for employee ${request.employeeId} due to approved vacation`)
          }
        }
      }
    }

    // Update the request
    console.log(`[APPROVE REQUEST] Updating request ${requestId} status to ${status}`)
    const [updatedRequest] = await db
      .update(leaveRequests)
      .set({
        status,
        decisionBy: user.id,
        decisionAt: new Date(),
        decisionReason,
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .returning()

    console.log(`[APPROVE REQUEST] Request updated successfully:`, {
      id: updatedRequest.id,
      status: updatedRequest.status,
      employeeId: updatedRequest.employeeId,
      startDate: updatedRequest.startDate,
      daysCount: updatedRequest.daysCount
    })

    // Create audit event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: parseInt(requestId),
      status,
      actorId: user.id,
      note: decisionReason || `Request ${status}`,
    })

    // Verify the request was actually updated by querying it again
    const [verifiedRequest] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .limit(1)

    console.log(`[APPROVE REQUEST] Verified request status in DB:`, {
      id: verifiedRequest.id,
      status: verifiedRequest.status,
      employeeId: verifiedRequest.employeeId,
      startDate: verifiedRequest.startDate,
      daysCount: verifiedRequest.daysCount
    })

    res.json(updatedRequest)
  } catch (error) {
    console.error('Error updating leave request:', error)
    res.status(500).json({ error: 'Failed to update leave request' })
  }
})

// Cancel a leave request
router.put('/requests/:requestId/cancel', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { requestId } = req.params
    const { reason } = req.body

    // Get the request
    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .limit(1)

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Check permissions
    const isOwner = request.requestedBy === user.id
    const isAdmin = user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    // Check if can be canceled
    if (request.status === 'canceled') {
      return res.status(400).json({ error: 'Request is already canceled' })
    }

    // Update the request
    const [updatedRequest] = await db
      .update(leaveRequests)
      .set({
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .returning()

    // Create audit event
    await db.insert(leaveRequestEvents).values({
      leaveRequestId: parseInt(requestId),
      status: 'canceled',
      actorId: user.id,
      note: reason || 'Request canceled',
    })

    res.json(updatedRequest)
  } catch (error) {
    console.error('Error canceling leave request:', error)
    res.status(500).json({ error: 'Failed to cancel leave request' })
  }
})

// Delete leave request
router.delete('/requests/:requestId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { requestId } = req.params

    // Get the request
    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))
      .limit(1)

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' })
    }

    // Check permissions - only admin or owner can delete
    const isOwner = request.requestedBy === user.id
    const isAdmin = user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    // Only allow deletion of pending or denied requests
    if (request.status === 'approved') {
      return res.status(400).json({
        error: 'Cannot delete approved requests. Please cancel the request first.'
      })
    }

    // Delete audit events first (foreign key constraint)
    await db
      .delete(leaveRequestEvents)
      .where(eq(leaveRequestEvents.leaveRequestId, parseInt(requestId)))

    // Delete the request
    await db
      .delete(leaveRequests)
      .where(eq(leaveRequests.id, parseInt(requestId)))

    res.json({ success: true, message: 'Leave request deleted successfully' })
  } catch (error) {
    console.error('Error deleting leave request:', error)
    res.status(500).json({ error: 'Failed to delete leave request' })
  }
})

// Adjust leave balance
router.post('/balances/adjust', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { employeeId, leaveTypeId, adjustmentDays, reason } = req.body

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Get current cycle
    const currentDate = new Date().toISOString().split('T')[0]
    const [cycle] = await db
      .select()
      .from(employmentCycles)
      .where(
        and(
          eq(employmentCycles.employeeId, employeeId),
          eq(employmentCycles.isActive, true),
          lte(employmentCycles.cycleStart, currentDate),
          gte(employmentCycles.cycleEnd, currentDate)
        )
      )
      .limit(1)

    if (!cycle) {
      return res.status(404).json({ error: 'No active employment cycle found' })
    }

    // Get or create balance
    let [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.employmentCycleId, cycle.id),
          eq(leaveBalances.leaveTypeId, leaveTypeId)
        )
      )
      .limit(1)

    if (balance) {
      // Update existing balance
      const currentAdjustment = parseFloat(balance.adjustmentDays?.toString() || '0')
      const newAdjustment = currentAdjustment + parseFloat(adjustmentDays)

      const updatedBalance = await db
        .update(leaveBalances)
        .set({
          adjustmentDays: newAdjustment.toString(),
          updatedAt: new Date(),
        })
        .where(eq(leaveBalances.id, balance.id))
        .returning()

      balance = updatedBalance[0]
    } else {
      // Create new balance
      const newBalance = await db
        .insert(leaveBalances)
        .values({
          employeeId,
          employmentCycleId: cycle.id,
          leaveTypeId,
          totalDays: '0',
          adjustmentDays: adjustmentDays.toString(),
        })
        .returning()

      balance = newBalance[0]
    }

    res.json(balance)
  } catch (error) {
    console.error('Error adjusting leave balance:', error)
    res.status(500).json({ error: 'Failed to adjust leave balance' })
  }
})

// Get team calendar
router.get('/calendar', auth, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query

    let conditions = []

    if (startDate && endDate) {
      conditions.push(
        or(
          between(leaveRequests.startDate, startDate as string, endDate as string),
          between(leaveRequests.endDate, startDate as string, endDate as string),
          and(
            lte(leaveRequests.startDate, startDate as string),
            gte(leaveRequests.endDate, endDate as string)
          )
        )
      )
    }

    if (status) {
      conditions.push(eq(leaveRequests.status, status as string))
    } else {
      // Default to approved and pending
      conditions.push(
        or(
          eq(leaveRequests.status, 'approved'),
          eq(leaveRequests.status, 'pending')
        )
      )
    }

    const events = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: teamMembers.name,
        avatarUrl: teamMembers.avatarUrl,
        leaveType: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
        status: leaveRequests.status,
        daysCount: leaveRequests.daysCount,
      })
      .from(leaveRequests)
      .innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(leaveRequests.startDate))

    res.json(events)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    res.status(500).json({ error: 'Failed to fetch calendar events' })
  }
})

// Get leave types
router.get('/leave-types', auth, async (req, res) => {
  try {
    const types = await db.select().from(leaveTypes)
    res.json(types)
  } catch (error) {
    console.error('Error fetching leave types:', error)
    res.status(500).json({ error: 'Failed to fetch leave types' })
  }
})

// Initialize leave balances for a new employment cycle
router.post('/cycles/initialize', auth, async (req, res) => {
  try {
    const user = (req as any).user
    const { employeeId, cycleStart, leaveAllocations, cycleNumber } = req.body

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Validate start date
    const startDate = new Date(cycleStart)
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid cycle start date' })
    }

    // Automatically calculate end date as 1 year from start date
    const endDate = new Date(startDate)
    endDate.setFullYear(startDate.getFullYear() + 1)
    const cycleEnd = endDate.toISOString().split('T')[0]

    // Calculate midpoint (6 months from start) for 50/50 vacation split
    const midpointDate = new Date(startDate)
    midpointDate.setMonth(startDate.getMonth() + 6)
    const cycleMidpoint = midpointDate.toISOString().split('T')[0]

    // Create employment cycle
    const [cycle] = await db
      .insert(employmentCycles)
      .values({
        employeeId,
        cycleStart,
        cycleEnd,
        cycleMidpoint,
        isActive: true,
      })
      .returning()

    // Deactivate previous cycles
    await db
      .update(employmentCycles)
      .set({ isActive: false })
      .where(
        and(
          eq(employmentCycles.employeeId, employeeId),
          eq(employmentCycles.isActive, true),
          sql`${employmentCycles.id} != ${cycle.id}`
        )
      )

    let finalLeaveAllocations = leaveAllocations || []

    // If no allocations provided but cycleNumber is specified, use allocation settings
    if ((!leaveAllocations || leaveAllocations.length === 0) && cycleNumber) {
      // Try to get settings for the specific cycle
      let allocationSettings = await db
        .select({
          leaveTypeId: leaveAllocationSettings.leaveTypeId,
          allocatedDays: leaveAllocationSettings.allocatedDays,
        })
        .from(leaveAllocationSettings)
        .where(eq(leaveAllocationSettings.cycleNumber, cycleNumber))

      // If no settings for the specific cycle, use default settings
      if (allocationSettings.length === 0) {
        allocationSettings = await db
          .select({
            leaveTypeId: leaveAllocationSettings.leaveTypeId,
            allocatedDays: leaveAllocationSettings.allocatedDays,
          })
          .from(leaveAllocationSettings)
          .where(eq(leaveAllocationSettings.isDefault, true))
      }

      // Convert allocation settings to leave allocations format
      finalLeaveAllocations = allocationSettings.map(setting => ({
        leaveTypeId: setting.leaveTypeId,
        totalDays: parseFloat(setting.allocatedDays.toString()),
        adjustmentDays: 0,
      }))

      // If still no allocations, use default hardcoded values
      if (finalLeaveAllocations.length === 0) {
        const leaveTypesData = await db.select().from(leaveTypes)
        const defaultAllocation = {
          'Vacation Leave': 25,
          'Sick Leave': 10,
          'Personal Leave': 5,
        }

        finalLeaveAllocations = leaveTypesData.map(leaveType => ({
          leaveTypeId: leaveType.id,
          totalDays: defaultAllocation[leaveType.name] || 0,
          adjustmentDays: 0,
        }))
      }
    }

    // Create leave balances
    const balances = await Promise.all(
      finalLeaveAllocations.map(async (allocation: any) => {
        const [balance] = await db
          .insert(leaveBalances)
          .values({
            employeeId,
            employmentCycleId: cycle.id,
            leaveTypeId: allocation.leaveTypeId,
            totalDays: allocation.totalDays.toString(),
            adjustmentDays: (allocation.adjustmentDays || 0).toString(),
          })
          .returning()
        return balance
      })
    )

    res.json({ cycle, balances, usedSettings: finalLeaveAllocations.length > 0 })
  } catch (error) {
    console.error('Error initializing employment cycle:', error)
    res.status(500).json({ error: 'Failed to initialize employment cycle' })
  }
})

// LEAVE BALANCE MANAGEMENT ROUTES

// Get all leave balances for admin management
router.get('/admin/balances', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeId, cycleId } = req.query
    let conditions = []

    if (employeeId) {
      conditions.push(eq(leaveBalances.employeeId, parseInt(employeeId as string)))
    }
    if (cycleId) {
      conditions.push(eq(leaveBalances.employmentCycleId, parseInt(cycleId as string)))
    }

    const balances = await db
      .select({
        balance: leaveBalances,
        employee: teamMembers,
        leaveType: leaveTypes,
        cycle: employmentCycles,
      })
      .from(leaveBalances)
      .innerJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id))
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .innerJoin(employmentCycles, eq(leaveBalances.employmentCycleId, employmentCycles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(teamMembers.name, leaveTypes.name)

    res.json(balances)
  } catch (error) {
    console.error('Error fetching admin balances:', error)
    res.status(500).json({ error: 'Failed to fetch leave balances' })
  }
})

// Update leave balance
router.put('/admin/balances/:balanceId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { balanceId } = req.params
    const { totalDays, adjustmentDays } = req.body

    const [updatedBalance] = await db
      .update(leaveBalances)
      .set({
        totalDays: totalDays.toString(),
        adjustmentDays: adjustmentDays.toString(),
        updatedAt: new Date(),
      })
      .where(eq(leaveBalances.id, parseInt(balanceId)))
      .returning()

    if (!updatedBalance) {
      return res.status(404).json({ error: 'Leave balance not found' })
    }

    res.json(updatedBalance)
  } catch (error) {
    console.error('Error updating leave balance:', error)
    res.status(500).json({ error: 'Failed to update leave balance' })
  }
})

// Bulk update leave balances for all employees
router.post('/admin/balances/bulk-update', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { updates } = req.body // Array of { balanceId, totalDays, adjustmentDays }

    const results = await Promise.all(
      updates.map(async (update: any) => {
        const [updatedBalance] = await db
          .update(leaveBalances)
          .set({
            totalDays: update.totalDays.toString(),
            adjustmentDays: update.adjustmentDays.toString(),
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, update.balanceId))
          .returning()
        return updatedBalance
      })
    )

    res.json({ updated: results.filter(Boolean) })
  } catch (error) {
    console.error('Error bulk updating leave balances:', error)
    res.status(500).json({ error: 'Failed to bulk update leave balances' })
  }
})

// EMPLOYMENT CYCLE MANAGEMENT ROUTES

// Get all employment cycles
router.get('/admin/cycles', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const cycles = await db
      .select({
        id: employmentCycles.id,
        employeeId: employmentCycles.employeeId,
        employeeName: teamMembers.name,
        cycleStart: employmentCycles.cycleStart,
        cycleEnd: employmentCycles.cycleEnd,
        isActive: employmentCycles.isActive,
        createdAt: employmentCycles.createdAt,
      })
      .from(employmentCycles)
      .innerJoin(teamMembers, eq(employmentCycles.employeeId, teamMembers.id))
      .orderBy(desc(employmentCycles.cycleStart))

    res.json(cycles)
  } catch (error) {
    console.error('Error fetching employment cycles:', error)
    res.status(500).json({ error: 'Failed to fetch employment cycles' })
  }
})


// Create new employment cycle
router.post('/admin/cycles', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeId, cycleStart, isActive } = req.body

    // Validate start date
    const startDate = new Date(cycleStart)
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid cycle start date' })
    }

    // Automatically calculate end date as 1 year from start date
    const endDate = new Date(startDate)
    endDate.setFullYear(startDate.getFullYear() + 1)

    const cycleEnd = endDate.toISOString().split('T')[0] // Format as YYYY-MM-DD

    // Calculate midpoint (6 months from start) for 50/50 vacation split
    const midpointDate = new Date(startDate)
    midpointDate.setMonth(startDate.getMonth() + 6)
    const cycleMidpoint = midpointDate.toISOString().split('T')[0]

    // Check for overlapping cycles
    const overlappingCycles = await db
      .select()
      .from(employmentCycles)
      .where(and(
        eq(employmentCycles.employeeId, employeeId),
        or(
          and(
            lte(employmentCycles.cycleStart, cycleStart),
            gte(employmentCycles.cycleEnd, cycleStart)
          ),
          and(
            lte(employmentCycles.cycleStart, cycleEnd),
            gte(employmentCycles.cycleEnd, cycleEnd)
          ),
          and(
            gte(employmentCycles.cycleStart, cycleStart),
            lte(employmentCycles.cycleEnd, cycleEnd)
          )
        )
      ))

    if (overlappingCycles.length > 0) {
      return res.status(400).json({ error: 'Employment cycle overlaps with existing cycle' })
    }

    // If this is set as active, deactivate other cycles for this employee
    if (isActive) {
      await db
        .update(employmentCycles)
        .set({ isActive: false })
        .where(eq(employmentCycles.employeeId, employeeId))
    }

    const [newCycle] = await db
      .insert(employmentCycles)
      .values({
        employeeId,
        cycleStart,
        cycleEnd,
        cycleMidpoint,
        isActive: isActive ?? false,
      })
      .returning()

    // Automatically create leave balances based on allocation settings
    // First, determine which cycle number this is for the employee
    const employeeCycles = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, employeeId))
      .orderBy(employmentCycles.cycleStart)

    const cycleNumber = employeeCycles.length

    // Get all leave types
    const allLeaveTypes = await db
      .select()
      .from(leaveTypes)

    // For each leave type, find the appropriate allocation setting
    const leaveBalancesToCreate = await Promise.all(
      allLeaveTypes.map(async (leaveType) => {
        // First try to find specific settings for this cycle number
        let allocationSetting = await db
          .select()
          .from(leaveAllocationSettings)
          .where(
            and(
              eq(leaveAllocationSettings.cycleNumber, cycleNumber),
              eq(leaveAllocationSettings.leaveTypeId, leaveType.id)
            )
          )
          .limit(1)

        // If no specific setting found, try to find the default setting for this leave type
        if (allocationSetting.length === 0) {
          allocationSetting = await db
            .select()
            .from(leaveAllocationSettings)
            .where(
              and(
                eq(leaveAllocationSettings.leaveTypeId, leaveType.id),
                eq(leaveAllocationSettings.isDefault, true)
              )
            )
            .limit(1)
        }

        // If still no setting found, use a fallback based on leave type
        let allocatedDays = '0'
        if (allocationSetting.length > 0) {
          allocatedDays = allocationSetting[0].allocatedDays.toString()
        } else {
          // Fallback allocations
          if (leaveType.name.toLowerCase().includes('vacation')) {
            allocatedDays = '25.0' // Default vacation days
          } else if (leaveType.name.toLowerCase().includes('sick')) {
            allocatedDays = '10.0' // Default sick days
          }
        }

        return {
          employeeId: employeeId,
          employmentCycleId: newCycle.id,
          leaveTypeId: leaveType.id,
          totalDays: allocatedDays,
          adjustmentDays: '0.0',
        }
      })
    )

    // Insert all leave balances
    if (leaveBalancesToCreate.length > 0) {
      await db
        .insert(leaveBalances)
        .values(leaveBalancesToCreate)
    }

    res.json({
      ...newCycle,
      cycleNumber,
      leaveBalancesCreated: leaveBalancesToCreate.length
    })
  } catch (error) {
    console.error('Error creating employment cycle:', error)
    res.status(500).json({ error: 'Failed to create employment cycle' })
  }
})

// Get all employment cycles for an employee
router.get('/admin/cycles/employee/:employeeId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeId } = req.params

    const cycles = await db
      .select({
        id: employmentCycles.id,
        cycleStart: employmentCycles.cycleStart,
        cycleEnd: employmentCycles.cycleEnd,
        isActive: employmentCycles.isActive,
        createdAt: employmentCycles.createdAt,
      })
      .from(employmentCycles)
      .where(eq(employmentCycles.employeeId, parseInt(employeeId)))
      .orderBy(employmentCycles.cycleStart)

    // Calculate total years of employment
    if (cycles.length > 0) {
      const firstCycle = cycles[0]
      const lastCycle = cycles[cycles.length - 1]

      const startDate = new Date(firstCycle.cycleStart)
      const endDate = new Date(lastCycle.cycleEnd)
      const MS_PER_DAY = 1000 * 60 * 60 * 24
      const totalYears = Math.floor((endDate.getTime() - startDate.getTime()) / (365 * MS_PER_DAY))

      res.json({
        cycles,
        totalYears,
        totalCycles: cycles.length
      })
    } else {
      res.json({
        cycles: [],
        totalYears: 0,
        totalCycles: 0
      })
    }
  } catch (error) {
    console.error('Error fetching employment cycles:', error)
    res.status(500).json({ error: 'Failed to fetch employment cycles' })
  }
})

// Update employment cycle
router.put('/admin/cycles/:cycleId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { cycleId } = req.params
    const { cycleStart, isActive } = req.body

    // Get current cycle
    const [currentCycle] = await db
      .select()
      .from(employmentCycles)
      .where(eq(employmentCycles.id, parseInt(cycleId)))

    if (!currentCycle) {
      return res.status(404).json({ error: 'Employment cycle not found' })
    }

    // If cycleStart is provided, automatically calculate cycleEnd as 1 year later
    let cycleEnd
    if (cycleStart) {
      const startDate = new Date(cycleStart)
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid cycle start date' })
      }

      const endDate = new Date(startDate)
      endDate.setFullYear(startDate.getFullYear() + 1)
      cycleEnd = endDate.toISOString().split('T')[0]
    }

    // If this is set as active, deactivate other cycles for this employee
    if (isActive) {
      await db
        .update(employmentCycles)
        .set({ isActive: false })
        .where(and(
          eq(employmentCycles.employeeId, currentCycle.employeeId),
          ne(employmentCycles.id, parseInt(cycleId))
        ))
    }

    const [updatedCycle] = await db
      .update(employmentCycles)
      .set({
        ...(cycleStart && { cycleStart }),
        ...(cycleEnd && { cycleEnd }),
        ...(isActive !== undefined && { isActive }),
      })
      .where(eq(employmentCycles.id, parseInt(cycleId)))
      .returning()

    res.json(updatedCycle)
  } catch (error) {
    console.error('Error updating employment cycle:', error)
    res.status(500).json({ error: 'Failed to update employment cycle' })
  }
})

// Delete employment cycle
router.delete('/admin/cycles/:cycleId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { cycleId } = req.params

    // Check if cycle has associated leave balances
    const associatedBalances = await db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.employmentCycleId, parseInt(cycleId)))

    if (associatedBalances.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete employment cycle with associated leave balances'
      })
    }

    const [deletedCycle] = await db
      .delete(employmentCycles)
      .where(eq(employmentCycles.id, parseInt(cycleId)))
      .returning()

    if (!deletedCycle) {
      return res.status(404).json({ error: 'Employment cycle not found' })
    }

    res.json({ message: 'Employment cycle deleted successfully', id: deletedCycle.id })
  } catch (error) {
    console.error('Error deleting employment cycle:', error)
    res.status(500).json({ error: 'Failed to delete employment cycle' })
  }
})

// AUTOMATIC BALANCE INITIALIZATION

// Initialize leave balances for new employee
router.post('/admin/initialize-balances/:employeeId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeId } = req.params
    const { employmentCycleId, defaultDays = {} } = req.body

    // Get the employee's active employment cycle if not specified
    let cycleId = employmentCycleId
    if (!cycleId) {
      const [activeCycle] = await db
        .select()
        .from(employmentCycles)
        .where(and(
          eq(employmentCycles.employeeId, parseInt(employeeId)),
          eq(employmentCycles.isActive, true)
        ))

      if (!activeCycle) {
        return res.status(400).json({ error: 'No active employment cycle found for employee' })
      }
      cycleId = activeCycle.id
    }

    // Get all leave types
    const leaveTypesList = await db.select().from(leaveTypes)

    // Check if balances already exist
    const existingBalances = await db
      .select()
      .from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, parseInt(employeeId)),
        eq(leaveBalances.employmentCycleId, cycleId)
      ))

    if (existingBalances.length > 0) {
      return res.status(400).json({ error: 'Leave balances already exist for this cycle' })
    }

    // Default days allocation (can be customized per company policy)
    const defaultAllocation = {
      'Vacation Leave': 25, // 25 days per year
      'Sick Leave': 15,     // 15 days per year
      'Personal Leave': 5,  // 5 days per year
      ...defaultDays
    }

    // Create balance records for each leave type
    const balancePromises = leaveTypesList.map(async (leaveType) => {
      const allocatedDays = defaultAllocation[leaveType.name] || 0

      return db.insert(leaveBalances).values({
        employeeId: parseInt(employeeId),
        employmentCycleId: cycleId,
        leaveTypeId: leaveType.id,
        totalDays: allocatedDays.toString(),
        adjustmentDays: '0',
      }).returning()
    })

    const results = await Promise.all(balancePromises)
    const createdBalances = results.map(result => result[0]).filter(Boolean)

    res.json({
      message: 'Leave balances initialized successfully',
      balances: createdBalances,
      employeeId: parseInt(employeeId),
      employmentCycleId: cycleId
    })
  } catch (error) {
    console.error('Error initializing leave balances:', error)
    res.status(500).json({ error: 'Failed to initialize leave balances' })
  }
})

// Bulk initialize balances for multiple employees
router.post('/admin/bulk-initialize-balances', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeIds, defaultDays = {} } = req.body

    if (!employeeIds || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Employee IDs are required' })
    }

    // Default days allocation
    const defaultAllocation = {
      'Vacation Leave': 25,
      'Sick Leave': 15,
      'Personal Leave': 5,
      ...defaultDays
    }

    const results = []

    for (const employeeId of employeeIds) {
      try {
        // Get active employment cycle for this employee
        const [activeCycle] = await db
          .select()
          .from(employmentCycles)
          .where(and(
            eq(employmentCycles.employeeId, employeeId),
            eq(employmentCycles.isActive, true)
          ))

        if (!activeCycle) {
          results.push({
            employeeId,
            success: false,
            error: 'No active employment cycle found'
          })
          continue
        }

        // Check if balances already exist
        const existingBalances = await db
          .select()
          .from(leaveBalances)
          .where(and(
            eq(leaveBalances.employeeId, employeeId),
            eq(leaveBalances.employmentCycleId, activeCycle.id)
          ))

        if (existingBalances.length > 0) {
          results.push({
            employeeId,
            success: false,
            error: 'Leave balances already exist'
          })
          continue
        }

        // Get all leave types
        const leaveTypesList = await db.select().from(leaveTypes)

        // Create balance records
        const balancePromises = leaveTypesList.map(async (leaveType) => {
          const allocatedDays = defaultAllocation[leaveType.name] || 0

          return db.insert(leaveBalances).values({
            employeeId,
            employmentCycleId: activeCycle.id,
            leaveTypeId: leaveType.id,
            totalDays: allocatedDays.toString(),
            adjustmentDays: '0',
          }).returning()
        })

        const balanceResults = await Promise.all(balancePromises)
        const createdBalances = balanceResults.map(result => result[0]).filter(Boolean)

        results.push({
          employeeId,
          success: true,
          balances: createdBalances,
          employmentCycleId: activeCycle.id
        })
      } catch (error) {
        results.push({
          employeeId,
          success: false,
          error: error.message
        })
      }
    }

    res.json({
      message: 'Bulk balance initialization completed',
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })
  } catch (error) {
    console.error('Error bulk initializing leave balances:', error)
    res.status(500).json({ error: 'Failed to bulk initialize leave balances' })
  }
})

// Rollover unused balances to new cycle
router.post('/admin/rollover-balances', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { fromCycleId, toCycleId, rolloverPolicy = {} } = req.body

    // Default rollover policy
    const defaultPolicy = {
      'Vacation Leave': { maxRollover: 5, carryOverPercentage: 100 }, // Carry 100% up to 5 days
      'Sick Leave': { maxRollover: 0, carryOverPercentage: 0 },       // No sick leave rollover
      'Personal Leave': { maxRollover: 2, carryOverPercentage: 50 },  // Carry 50% up to 2 days
      ...rolloverPolicy
    }

    // Get balances from the old cycle
    const oldBalances = await db
      .select({
        employeeId: leaveBalances.employeeId,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        totalDays: leaveBalances.totalDays,
        adjustmentDays: leaveBalances.adjustmentDays,
        usedDays: sql<number>`COALESCE(SUM(CASE WHEN ${leaveRequests.status} = 'approved' THEN ${leaveRequests.daysCount} ELSE 0 END), 0)`,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .leftJoin(leaveRequests, and(
        eq(leaveRequests.employeeId, leaveBalances.employeeId),
        eq(leaveRequests.leaveTypeId, leaveBalances.leaveTypeId)
      ))
      .where(eq(leaveBalances.employmentCycleId, fromCycleId))
      .groupBy(
        leaveBalances.employeeId,
        leaveBalances.leaveTypeId,
        leaveTypes.name,
        leaveBalances.totalDays,
        leaveBalances.adjustmentDays
      )

    const rolloverResults = []

    for (const balance of oldBalances) {
      const totalAllocated = parseFloat(balance.totalDays) + parseFloat(balance.adjustmentDays || '0')
      const remainingDays = totalAllocated - balance.usedDays
      const policy = defaultPolicy[balance.leaveTypeName] || { maxRollover: 0, carryOverPercentage: 0 }

      let rolloverDays = 0
      if (remainingDays > 0 && policy.carryOverPercentage > 0) {
        const calculatedRollover = (remainingDays * policy.carryOverPercentage) / 100
        rolloverDays = Math.min(calculatedRollover, policy.maxRollover)
      }

      // Check if balance already exists for new cycle
      const [existingBalance] = await db
        .select()
        .from(leaveBalances)
        .where(and(
          eq(leaveBalances.employeeId, balance.employeeId),
          eq(leaveBalances.employmentCycleId, toCycleId),
          eq(leaveBalances.leaveTypeId, balance.leaveTypeId)
        ))

      if (existingBalance) {
        // Update existing balance with rollover
        const currentAdjustment = parseFloat(existingBalance.adjustmentDays || '0')
        const newAdjustment = currentAdjustment + rolloverDays

        await db
          .update(leaveBalances)
          .set({
            adjustmentDays: newAdjustment.toString(),
            updatedAt: new Date()
          })
          .where(eq(leaveBalances.id, existingBalance.id))

        rolloverResults.push({
          employeeId: balance.employeeId,
          leaveType: balance.leaveTypeName,
          remainingDays,
          rolloverDays,
          action: 'updated_adjustment'
        })
      } else {
        // Create new balance with rollover as adjustment
        const defaultAllocation = {
          'Vacation Leave': 25,
          'Sick Leave': 15,
          'Personal Leave': 5
        }

        await db.insert(leaveBalances).values({
          employeeId: balance.employeeId,
          employmentCycleId: toCycleId,
          leaveTypeId: balance.leaveTypeId,
          totalDays: (defaultAllocation[balance.leaveTypeName] || 0).toString(),
          adjustmentDays: rolloverDays.toString(),
        })

        rolloverResults.push({
          employeeId: balance.employeeId,
          leaveType: balance.leaveTypeName,
          remainingDays,
          rolloverDays,
          action: 'created_new_balance'
        })
      }
    }

    res.json({
      message: 'Balance rollover completed',
      fromCycleId,
      toCycleId,
      results: rolloverResults,
      totalRolloverRecords: rolloverResults.length
    })
  } catch (error) {
    console.error('Error rolling over balances:', error)
    res.status(500).json({ error: 'Failed to rollover balances' })
  }
})

// LEAVE TYPE MANAGEMENT ROUTES

// Get all leave types
router.get('/leave-types', auth, async (req, res) => {
  try {
    const leaveTypesData = await db
      .select()
      .from(leaveTypes)
      .orderBy(leaveTypes.name)

    res.json(leaveTypesData)
  } catch (error) {
    console.error('Error fetching leave types:', error)
    res.status(500).json({ error: 'Failed to fetch leave types' })
  }
})

// Create leave type (admin only)
router.post('/admin/leave-types', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { name, isDeductible, halfDaySupported } = req.body

    const [newLeaveType] = await db
      .insert(leaveTypes)
      .values({
        name,
        isDeductible: isDeductible ?? true,
        halfDaySupported: halfDaySupported ?? true,
      })
      .returning()

    res.json(newLeaveType)
  } catch (error) {
    console.error('Error creating leave type:', error)
    res.status(500).json({ error: 'Failed to create leave type' })
  }
})

// PERFORMANCE OPTIMIZATIONS

// Get optimized balance summary (cached calculation)
router.get('/balances/summary/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params

    // Single optimized query to get all balance data
    const result = await db
      .select({
        leaveType: leaveTypes.name,
        leaveTypeId: leaveTypes.id,
        totalDays: leaveBalances.totalDays,
        adjustmentDays: leaveBalances.adjustmentDays,
        usedDays: sql<number>`COALESCE(SUM(CASE WHEN ${leaveRequests.status} = 'approved' THEN ${leaveRequests.daysCount} ELSE 0 END), 0)`,
        pendingDays: sql<number>`COALESCE(SUM(CASE WHEN ${leaveRequests.status} = 'pending' THEN ${leaveRequests.daysCount} ELSE 0 END), 0)`,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .innerJoin(employmentCycles, eq(leaveBalances.employmentCycleId, employmentCycles.id))
      .leftJoin(leaveRequests, and(
        eq(leaveRequests.employeeId, leaveBalances.employeeId),
        eq(leaveRequests.leaveTypeId, leaveBalances.leaveTypeId),
        gte(leaveRequests.startDate, employmentCycles.cycleStart),
        lte(leaveRequests.endDate, employmentCycles.cycleEnd)
      ))
      .where(and(
        eq(leaveBalances.employeeId, parseInt(employeeId)),
        eq(employmentCycles.isActive, true)
      ))
      .groupBy(
        leaveTypes.name,
        leaveTypes.id,
        leaveBalances.totalDays,
        leaveBalances.adjustmentDays
      )

    const balancesWithUsage = result.map(row => ({
      leaveType: row.leaveType,
      leaveTypeId: row.leaveTypeId,
      totalAllocated: parseFloat(row.totalDays.toString()),
      used: row.usedDays,
      pending: row.pendingDays,
      adjustments: parseFloat(row.adjustmentDays?.toString() || '0'),
      available: parseFloat(row.totalDays.toString()) + parseFloat(row.adjustmentDays?.toString() || '0') - row.usedDays,
    }))

    res.json(balancesWithUsage)
  } catch (error) {
    console.error('Error fetching optimized balance summary:', error)
    res.status(500).json({ error: 'Failed to fetch balance summary' })
  }
})

// Get optimized balance summary for all employees (admin only)
router.get('/admin/balances/summary-all', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Single optimized query to get all balance data for all employees
    const result = await db
      .select({
        employeeId: leaveBalances.employeeId,
        employeeName: teamMembers.name,
        leaveType: leaveTypes.name,
        leaveTypeId: leaveTypes.id,
        totalDays: leaveBalances.totalDays,
        adjustmentDays: leaveBalances.adjustmentDays,
        usedDays: sql<number>`COALESCE(SUM(CASE WHEN ${leaveRequests.status} = 'approved' THEN ${leaveRequests.daysCount} ELSE 0 END), 0)`,
        pendingDays: sql<number>`COALESCE(SUM(CASE WHEN ${leaveRequests.status} = 'pending' THEN ${leaveRequests.daysCount} ELSE 0 END), 0)`,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .innerJoin(employmentCycles, eq(leaveBalances.employmentCycleId, employmentCycles.id))
      .innerJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id))
      .leftJoin(leaveRequests, and(
        eq(leaveRequests.employeeId, leaveBalances.employeeId),
        eq(leaveRequests.leaveTypeId, leaveBalances.leaveTypeId),
        gte(leaveRequests.startDate, employmentCycles.cycleStart),
        lte(leaveRequests.endDate, employmentCycles.cycleEnd)
      ))
      .where(eq(employmentCycles.isActive, true))
      .groupBy(
        leaveBalances.employeeId,
        teamMembers.name,
        leaveTypes.name,
        leaveTypes.id,
        leaveBalances.totalDays,
        leaveBalances.adjustmentDays
      )
      .orderBy(teamMembers.name, leaveTypes.name)

    // Group by employee for easier frontend consumption
    const groupedByEmployee = result.reduce((acc, row) => {
      if (!acc[row.employeeId]) {
        acc[row.employeeId] = {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          balances: []
        }
      }

      acc[row.employeeId].balances.push({
        leaveType: row.leaveType,
        leaveTypeId: row.leaveTypeId,
        totalAllocated: parseFloat(row.totalDays.toString()),
        used: row.usedDays,
        pending: row.pendingDays,
        adjustments: parseFloat(row.adjustmentDays?.toString() || '0'),
        available: parseFloat(row.totalDays.toString()) + parseFloat(row.adjustmentDays?.toString() || '0') - row.usedDays,
      })

      return acc
    }, {} as Record<number, any>)

    res.json(Object.values(groupedByEmployee))
  } catch (error) {
    console.error('Error fetching all employee balance summaries:', error)
    res.status(500).json({ error: 'Failed to fetch balance summaries' })
  }
})

// Get optimized team calendar view (efficient calendar data loading)
router.get('/admin/calendar/optimized', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' })
    }

    // Single optimized query for calendar view
    const calendarData = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: teamMembers.name,
        employeeAvatar: teamMembers.avatarUrl,
        leaveType: leaveTypes.name,
        status: leaveRequests.status,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        daysCount: leaveRequests.daysCount,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
        reason: leaveRequests.reason,
      })
      .from(leaveRequests)
      .innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(
        or(
          eq(leaveRequests.status, 'approved'),
          eq(leaveRequests.status, 'pending')
        ),
        gte(leaveRequests.startDate, startDate as string),
        lte(leaveRequests.endDate, endDate as string)
      ))
      .orderBy(leaveRequests.startDate, teamMembers.name)

    res.json(calendarData)
  } catch (error) {
    console.error('Error fetching optimized calendar data:', error)
    res.status(500).json({ error: 'Failed to fetch calendar data' })
  }
})

// Get performance metrics and statistics
router.get('/admin/analytics/performance', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Efficient single-query analytics
    const [
      totalEmployees,
      totalActiveBalances,
      totalPendingRequests,
      totalApprovedRequests,
      avgBalanceUtilization
    ] = await Promise.all([
      // Total employees with active cycles
      db
        .select({ count: sql<number>`count(DISTINCT ${teamMembers.id})` })
        .from(teamMembers)
        .innerJoin(employmentCycles, and(
          eq(employmentCycles.employeeId, teamMembers.id),
          eq(employmentCycles.isActive, true)
        )),

      // Total active leave balances
      db
        .select({ count: sql<number>`count(*)` })
        .from(leaveBalances)
        .innerJoin(employmentCycles, and(
          eq(leaveBalances.employmentCycleId, employmentCycles.id),
          eq(employmentCycles.isActive, true)
        )),

      // Pending requests count
      db
        .select({ count: sql<number>`count(*)` })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, 'pending')),

      // Approved requests this year
      db
        .select({ count: sql<number>`count(*)` })
        .from(leaveRequests)
        .where(and(
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.startDate, new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
        )),

      // Average balance utilization
      db
        .select({
          avgUtilization: sql<number>`
            AVG(
              CASE
                WHEN (${leaveBalances.totalDays}::float + COALESCE(${leaveBalances.adjustmentDays}::float, 0)) > 0
                THEN (
                  COALESCE(
                    SUM(CASE WHEN ${leaveRequests.status} = 'approved' THEN ${leaveRequests.daysCount}::float ELSE 0 END), 0
                  ) / (${leaveBalances.totalDays}::float + COALESCE(${leaveBalances.adjustmentDays}::float, 0))
                ) * 100
                ELSE 0
              END
            )
          `
        })
        .from(leaveBalances)
        .innerJoin(employmentCycles, and(
          eq(leaveBalances.employmentCycleId, employmentCycles.id),
          eq(employmentCycles.isActive, true)
        ))
        .leftJoin(leaveRequests, and(
          eq(leaveRequests.employeeId, leaveBalances.employeeId),
          eq(leaveRequests.leaveTypeId, leaveBalances.leaveTypeId),
          eq(leaveRequests.status, 'approved')
        ))
        .groupBy(leaveBalances.id, leaveBalances.totalDays, leaveBalances.adjustmentDays)
    ])

    res.json({
      totalEmployees: totalEmployees[0].count,
      totalActiveBalances: totalActiveBalances[0].count,
      totalPendingRequests: totalPendingRequests[0].count,
      totalApprovedRequestsThisYear: totalApprovedRequests[0].count,
      avgBalanceUtilization: Math.round((avgBalanceUtilization[0].avgUtilization || 0) * 100) / 100,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching performance analytics:', error)
    res.status(500).json({ error: 'Failed to fetch performance analytics' })
  }
})

// BULK OPERATIONS

// Bulk approve/deny leave requests
router.post('/admin/requests/bulk-action', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { requestIds, action, reason } = req.body

    if (!requestIds || requestIds.length === 0) {
      return res.status(400).json({ error: 'Request IDs are required' })
    }

    if (!['approve', 'deny', 'cancel'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve, deny, or cancel' })
    }

    const results = []

    for (const requestId of requestIds) {
      try {
        let updateData: any = {
          updatedAt: new Date()
        }

        if (action === 'approve') {
          updateData = {
            ...updateData,
            status: 'approved',
            decisionBy: user.id,
            decisionAt: new Date(),
            decisionReason: reason
          }
        } else if (action === 'deny') {
          updateData = {
            ...updateData,
            status: 'denied',
            decisionBy: user.id,
            decisionAt: new Date(),
            decisionReason: reason
          }
        } else if (action === 'cancel') {
          updateData = {
            ...updateData,
            status: 'canceled'
          }
        }

        const [updatedRequest] = await db
          .update(leaveRequests)
          .set(updateData)
          .where(eq(leaveRequests.id, requestId))
          .returning()

        if (updatedRequest) {
          // Create audit trail event
          await db.insert(leaveRequestEvents).values({
            leaveRequestId: requestId,
            status: action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'canceled',
            actorId: user.id,
            note: reason || `Leave request ${action}d via bulk action`,
          })

          results.push({
            requestId,
            success: true,
            action,
            newStatus: updatedRequest.status
          })
        } else {
          results.push({
            requestId,
            success: false,
            error: 'Request not found'
          })
        }
      } catch (error) {
        results.push({
          requestId,
          success: false,
          error: error.message
        })
      }
    }

    res.json({
      message: `Bulk ${action} operation completed`,
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })
  } catch (error) {
    console.error(`Error performing bulk ${req.body.action} operation:`, error)
    res.status(500).json({ error: `Failed to perform bulk ${req.body.action} operation` })
  }
})

// Bulk delete leave requests (admin only, for cancelled requests)
router.delete('/admin/requests/bulk-delete', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { requestIds } = req.body

    if (!requestIds || requestIds.length === 0) {
      return res.status(400).json({ error: 'Request IDs are required' })
    }

    const results = []

    for (const requestId of requestIds) {
      try {
        // Check if request exists and is in a deletable state
        const [existingRequest] = await db
          .select()
          .from(leaveRequests)
          .where(eq(leaveRequests.id, requestId))

        if (!existingRequest) {
          results.push({
            requestId,
            success: false,
            error: 'Request not found'
          })
          continue
        }

        if (!['canceled', 'denied'].includes(existingRequest.status)) {
          results.push({
            requestId,
            success: false,
            error: 'Can only delete canceled or denied requests'
          })
          continue
        }

        // Delete associated events first
        await db
          .delete(leaveRequestEvents)
          .where(eq(leaveRequestEvents.leaveRequestId, requestId))

        // Delete the request
        await db
          .delete(leaveRequests)
          .where(eq(leaveRequests.id, requestId))

        results.push({
          requestId,
          success: true
        })
      } catch (error) {
        results.push({
          requestId,
          success: false,
          error: error.message
        })
      }
    }

    res.json({
      message: 'Bulk delete operation completed',
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })
  } catch (error) {
    console.error('Error performing bulk delete operation:', error)
    res.status(500).json({ error: 'Failed to perform bulk delete operation' })
  }
})

// Get all team members for dropdown selection
router.get('/employees', auth, async (req, res) => {
  try {
    const { clientId } = req.query
    let employeeConditions = [eq(teamMembers.status, 'active')]

    if (clientId) {
      const parsedClientId = parseInt(clientId as string)

      if (Number.isNaN(parsedClientId)) {
        return res.status(400).json({ error: 'Invalid client ID' })
      }

      const { teamMemberIds } = await getActiveClientServiceTeamMemberIds(parsedClientId)

      if (teamMemberIds.length === 0) {
        return res.json([])
      }

      employeeConditions.push(inArray(teamMembers.id, teamMemberIds))
    }

    const employees = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        position: teamMembers.position,
        status: teamMembers.status,
        showOnCalendar: teamMembers.showOnCalendar,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(teamMembers)
      .where(and(...employeeConditions))
      .orderBy(teamMembers.name)

    res.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    res.status(500).json({ error: 'Failed to fetch employees' })
  }
})

// LEAVE ALLOCATION SETTINGS ROUTES

// Get all leave allocation settings
router.get('/admin/allocation-settings', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const settings = await db
      .select({
        id: leaveAllocationSettings.id,
        cycleNumber: leaveAllocationSettings.cycleNumber,
        leaveTypeId: leaveAllocationSettings.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        allocatedDays: leaveAllocationSettings.allocatedDays,
        isDefault: leaveAllocationSettings.isDefault,
        createdAt: leaveAllocationSettings.createdAt,
        updatedAt: leaveAllocationSettings.updatedAt,
      })
      .from(leaveAllocationSettings)
      .innerJoin(leaveTypes, eq(leaveAllocationSettings.leaveTypeId, leaveTypes.id))
      .orderBy(
        leaveAllocationSettings.cycleNumber,
        leaveTypes.name
      )

    res.json(settings)
  } catch (error) {
    console.error('Error fetching allocation settings:', error)
    res.status(500).json({ error: 'Failed to fetch allocation settings' })
  }
})

// Create or update leave allocation setting
router.post('/admin/allocation-settings', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { cycleNumber, leaveTypeId, allocatedDays, isDefault } = req.body

    // Validate input
    if (!cycleNumber || !leaveTypeId || allocatedDays === undefined) {
      return res.status(400).json({
        error: 'Cycle number, leave type ID, and allocated days are required'
      })
    }

    // Check if setting already exists
    const [existingSetting] = await db
      .select()
      .from(leaveAllocationSettings)
      .where(
        and(
          eq(leaveAllocationSettings.cycleNumber, cycleNumber),
          eq(leaveAllocationSettings.leaveTypeId, leaveTypeId)
        )
      )
      .limit(1)

    if (existingSetting) {
      // Update existing setting
      const [updatedSetting] = await db
        .update(leaveAllocationSettings)
        .set({
          allocatedDays: allocatedDays.toString(),
          isDefault: isDefault || false,
          updatedAt: new Date(),
        })
        .where(eq(leaveAllocationSettings.id, existingSetting.id))
        .returning()

      res.json(updatedSetting)
    } else {
      // Create new setting
      const [newSetting] = await db
        .insert(leaveAllocationSettings)
        .values({
          cycleNumber,
          leaveTypeId,
          allocatedDays: allocatedDays.toString(),
          isDefault: isDefault || false,
        })
        .returning()

      res.json(newSetting)
    }
  } catch (error) {
    console.error('Error creating/updating allocation setting:', error)
    res.status(500).json({ error: 'Failed to create/update allocation setting' })
  }
})

// Update leave allocation setting
router.put('/admin/allocation-settings/:settingId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { settingId } = req.params
    const { allocatedDays, isDefault } = req.body

    const [updatedSetting] = await db
      .update(leaveAllocationSettings)
      .set({
        allocatedDays: allocatedDays.toString(),
        isDefault: isDefault || false,
        updatedAt: new Date(),
      })
      .where(eq(leaveAllocationSettings.id, parseInt(settingId)))
      .returning()

    if (!updatedSetting) {
      return res.status(404).json({ error: 'Allocation setting not found' })
    }

    res.json(updatedSetting)
  } catch (error) {
    console.error('Error updating allocation setting:', error)
    res.status(500).json({ error: 'Failed to update allocation setting' })
  }
})

// Delete leave allocation setting
router.delete('/admin/allocation-settings/:settingId', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { settingId } = req.params

    const [deletedSetting] = await db
      .delete(leaveAllocationSettings)
      .where(eq(leaveAllocationSettings.id, parseInt(settingId)))
      .returning()

    if (!deletedSetting) {
      return res.status(404).json({ error: 'Allocation setting not found' })
    }

    res.json({ message: 'Allocation setting deleted successfully', id: deletedSetting.id })
  } catch (error) {
    console.error('Error deleting allocation setting:', error)
    res.status(500).json({ error: 'Failed to delete allocation setting' })
  }
})

// Get allocation settings for a specific cycle (used when creating employment cycles)
router.get('/admin/allocation-settings/cycle/:cycleNumber', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { cycleNumber } = req.params

    // First, try to get settings for the specific cycle
    let settings = await db
      .select({
        id: leaveAllocationSettings.id,
        cycleNumber: leaveAllocationSettings.cycleNumber,
        leaveTypeId: leaveAllocationSettings.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        allocatedDays: leaveAllocationSettings.allocatedDays,
        isDefault: leaveAllocationSettings.isDefault,
      })
      .from(leaveAllocationSettings)
      .innerJoin(leaveTypes, eq(leaveAllocationSettings.leaveTypeId, leaveTypes.id))
      .where(eq(leaveAllocationSettings.cycleNumber, parseInt(cycleNumber)))
      .orderBy(leaveTypes.name)

    // If no settings found for the specific cycle, look for default settings
    if (settings.length === 0) {
      settings = await db
        .select({
          id: leaveAllocationSettings.id,
          cycleNumber: leaveAllocationSettings.cycleNumber,
          leaveTypeId: leaveAllocationSettings.leaveTypeId,
          leaveTypeName: leaveTypes.name,
          allocatedDays: leaveAllocationSettings.allocatedDays,
          isDefault: leaveAllocationSettings.isDefault,
        })
        .from(leaveAllocationSettings)
        .innerJoin(leaveTypes, eq(leaveAllocationSettings.leaveTypeId, leaveTypes.id))
        .where(eq(leaveAllocationSettings.isDefault, true))
        .orderBy(leaveTypes.name)
    }

    // If still no settings, get all leave types with zero allocation
    if (settings.length === 0) {
      const leaveTypesData = await db.select().from(leaveTypes)
      settings = leaveTypesData.map(leaveType => ({
        id: null,
        cycleNumber: parseInt(cycleNumber),
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        allocatedDays: '0',
        isDefault: false,
      }))
    }

    res.json(settings)
  } catch (error) {
    console.error('Error fetching allocation settings for cycle:', error)
    res.status(500).json({ error: 'Failed to fetch allocation settings for cycle' })
  }
})

// Set default allocation settings (marks settings as default for future cycles)
router.post('/admin/allocation-settings/set-default', auth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { cycleNumber } = req.body

    if (!cycleNumber) {
      return res.status(400).json({ error: 'Cycle number is required' })
    }

    // First, unmark all existing default settings
    await db
      .update(leaveAllocationSettings)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(leaveAllocationSettings.isDefault, true))

    // Mark settings from the specified cycle as default
    const updatedSettings = await db
      .update(leaveAllocationSettings)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(leaveAllocationSettings.cycleNumber, cycleNumber))
      .returning()

    res.json({
      message: `Settings from cycle ${cycleNumber} are now marked as default`,
      updatedSettings,
    })
  } catch (error) {
    console.error('Error setting default allocation settings:', error)
    res.status(500).json({ error: 'Failed to set default allocation settings' })
  }
})

// Get vacation requests for client's team (developers in active services)
router.get('/client/team', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      return res.status(403).json({ error: 'Unauthorized. Client access only.' })
    }

    // Get client ID from client_users table
    const [clientUserRecord] = await db
      .select({ clientId: clientUsers.clientId })
      .from(clientUsers)
      .where(and(
        eq(clientUsers.userId, req.user.id),
        eq(clientUsers.isActive, true)
      ))
      .limit(1)

    if (!clientUserRecord) {
      console.log('[GET /client/team] No client association found for user:', req.user.id)
      return res.status(400).json({ error: 'Client association not found' })
    }

    const clientId = clientUserRecord.clientId
    console.log('[GET /client/team] Client ID:', clientId, 'User:', req.user.email)

    const { serviceIds, teamMemberIds } = await getActiveClientServiceTeamMemberIds(clientId)

    console.log('[GET /client/team] Found', serviceIds.length, 'active outsourcing/outstaffing services')

    if (serviceIds.length === 0) {
      return res.json({ vacations: [], message: 'No active outsourcing/outstaffing services found' })
    }

    // Query to get vacation requests for team members in these services
    if (teamMemberIds.length === 0) {
      return res.json({ vacations: [] })
    }

    const teamVacations = await db
      .select({
        request: leaveRequests,
        employee: teamMembers
      })
      .from(leaveRequests)
      .innerJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
      .where(
        and(
          inArray(leaveRequests.employeeId, teamMemberIds),
          // Only show approved requests (ongoing or upcoming vacations)
          eq(leaveRequests.status, 'approved')
        )
      )
      .orderBy(desc(leaveRequests.startDate))

    // Format the response
    const vacationsWithDetails = teamVacations.map(({ request, employee }) => ({
      ...request,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        avatarUrl: employee.avatarUrl,
        position: employee.position
      }
    }))

    console.log('[GET /client/team] Returning', vacationsWithDetails.length, 'vacations')
    res.json({ vacations: vacationsWithDetails })
  } catch (error) {
    console.error('Error fetching client team vacations:', error)
    res.status(500).json({ error: 'Failed to fetch team vacations' })
  }
})

// Get team members with work schedules for client
router.get('/client/team/schedules', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      return res.status(403).json({ error: 'Unauthorized. Client access only.' })
    }

    // Get client ID from user
    const [clientUserRecord] = await db
      .select({
        clientId: clientUsers.clientId,
      })
      .from(clientUsers)
      .where(eq(clientUsers.userId, req.user.id))
      .limit(1)

    if (!clientUserRecord) {
      return res.status(400).json({ error: 'Client association not found' })
    }

    const clientId = clientUserRecord.clientId

    const { serviceIds } = await getActiveClientServiceTeamMemberIds(clientId)

    if (serviceIds.length === 0) {
      return res.json({ teamMembers: [] })
    }

    // Get team members assigned to these services with their work schedules
    const developersList = await db
      .select({
        id: clientServiceTeamMembers.id,
        teamMemberId: clientServiceTeamMembers.teamMemberId,
        workSchedule: clientServiceTeamMembers.workSchedule,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        position: teamMembers.position,
      })
      .from(clientServiceTeamMembers)
      .leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .where(and(
        inArray(clientServiceTeamMembers.clientServiceId, serviceIds),
        eq(clientServiceTeamMembers.isActive, true)
      ))

    res.json({ teamMembers: developersList })
  } catch (error) {
    console.error('Error fetching team schedules:', error)
    res.status(500).json({ error: 'Failed to fetch team schedules' })
  }
})

export default router
