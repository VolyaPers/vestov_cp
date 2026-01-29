import { Router } from 'express'
import { db } from '../db/index.js'
import { shifts, shiftBreaks, shiftSchedules, teamMembers, clientUsers, clientServices, serviceTypes, clientServiceTeamMembers } from '../db/schema.js'
import { eq, and, isNull, desc, gte, lte, sql } from 'drizzle-orm'
import { notifyShiftEvent } from '../utils/slack.js'
import { emitShiftStarted, emitShiftEnded, emitBreakStarted, emitBreakEnded } from '../socket.js'

const router = Router()

// Helper function to check if shift started late
function checkIfLate(scheduleTime: string, actualTime: Date): { isLate: boolean; lateMinutes: number } {
  const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number)
  const actualDate = new Date(actualTime)
  const scheduledDate = new Date(actualDate)
  scheduledDate.setHours(scheduleHour, scheduleMinute, 0, 0)

  const diffMs = actualDate.getTime() - scheduledDate.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  return {
    isLate: diffMinutes > 5, // 5 minute grace period
    lateMinutes: Math.max(0, diffMinutes)
  }
}

// Helper function to get employee by user email
async function getEmployeeByUser(email: string | undefined | null) {
  if (!email) {
    console.error('[getEmployeeByUser] No email provided')
    return undefined
  }

  try {
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, email))

    return members[0]
  } catch (error) {
    console.error('[getEmployeeByUser] Error fetching employee:', error)
    throw error
  }
}

// Get current active shift for logged-in employee
router.get('/current', async (req, res) => {
  try {
    if (!req.user) {
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(401).json({ error: 'Not authenticated' })
    }

    console.log(`[GET /shifts/current] Request from user: ${req.user.email}, userId: ${req.user.id}, teamMemberId: ${(req.user as any).teamMemberId}`)

    // Try to get employee by teamMemberId first (more reliable)
    let employee
    if ((req.user as any).teamMemberId) {
      try {
        const [member] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (req.user as any).teamMemberId))
          .limit(1)
        employee = member
        console.log(`[GET /shifts/current] Found employee by teamMemberId: ${employee?.id}, ${employee?.name}`)
      } catch (error) {
        console.error('[GET /shifts/current] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!employee) {
      employee = await getEmployeeByUser(req.user.email!)
      if (employee) {
        console.log(`[GET /shifts/current] Found employee by email: ${employee.id}, ${employee.name}`)
      }
    }

    if (!employee) {
      console.log(`[GET /shifts/current] Employee not found for email: ${req.user.email}, teamMemberId: ${(req.user as any).teamMemberId}`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.json({ shift: null, hasActiveShift: false }) // Return empty instead of 404 for better UX
    }

    console.log(`[GET /shifts/current] Found employee: ${employee.id}, ${employee.name}`)

    // Find active shift (status = 'active' or 'on_break', and end_time is null)
    let activeShifts
    try {
      activeShifts = await db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.employeeId, employee.id),
            isNull(shifts.endTime)
          )
        )
        .orderBy(desc(shifts.startTime))
        .limit(1)
      console.log(`[GET /shifts/current] Found ${activeShifts.length} active shift(s)`)
    } catch (dbError) {
      console.error('[GET /shifts/current] Database error fetching shifts:', dbError)
      throw dbError
    }

    const activeShift = activeShifts[0]

    if (!activeShift) {
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.json({ shift: null, hasActiveShift: false })
    }

    // Get active break if any
    let activeBreaks
    try {
      activeBreaks = await db
        .select()
        .from(shiftBreaks)
        .where(
          and(
            eq(shiftBreaks.shiftId, activeShift.id),
            isNull(shiftBreaks.endTime)
          )
        )
        .orderBy(desc(shiftBreaks.startTime))
        .limit(1)
    } catch (dbError) {
      console.error('[GET /shifts/current] Database error fetching breaks:', dbError)
      // Don't fail if breaks query fails, just return empty
      activeBreaks = []
    }

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    return res.json({
      shift: activeShift,
      activeBreak: activeBreaks[0] || null,
      hasActiveShift: true
    })
  } catch (error) {
    const err = error as Error
    console.error('========================================')
    console.error('[GET /shifts/current] ERROR:', err.message)
    console.error('[GET /shifts/current] Stack:', err.stack)
    console.error('[GET /shifts/current] User:', req.user ? { id: req.user.id, email: req.user.email } : 'no user')
    console.error('========================================')

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to fetch current shift' })
  }
})

// Get employee's active service assignments
router.get('/my-services', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Try to get employee by teamMemberId first (more reliable)
    let employee
    if ((req.user as any).teamMemberId) {
      try {
        const [member] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (req.user as any).teamMemberId))
          .limit(1)
        employee = member
        if (employee) {
          console.log(`[GET /my-services] Found employee by teamMemberId: ${employee.id}, ${employee.name}`)
        }
      } catch (error) {
        console.error('[GET /my-services] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!employee) {
      employee = await getEmployeeByUser(req.user.email!)
      if (employee) {
        console.log(`[GET /my-services] Found employee by email: ${employee.id}, ${employee.name}`)
      }
    }

    if (!employee) {
      console.log(`[GET /my-services] Employee not found for email: ${req.user.email}, teamMemberId: ${(req.user as any).teamMemberId}`)
      // Return empty services with flag indicating no team_member record
      return res.json({ services: [], hasTeamMember: false })
    }

    // Get all active service assignments for this employee
    const services = await db
      .select({
        serviceId: clientServices.id,
        serviceName: serviceTypes.name,
        clientName: sql<string>`(SELECT name FROM clients WHERE id = ${clientServices.clientId})`,
        employmentType: clientServiceTeamMembers.employmentType,
        workSchedule: clientServiceTeamMembers.workSchedule,
        serviceTitle: clientServices.serviceTitle,
        slackChannelId: clientServices.slackChannelId
      })
      .from(clientServiceTeamMembers)
      .innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
      .innerJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(and(
        eq(clientServiceTeamMembers.teamMemberId, employee.id),
        eq(clientServiceTeamMembers.isActive, true),
        eq(clientServices.isActive, true)
      ))

    res.json({ services, hasTeamMember: true })
  } catch (error) {
    console.error('Error fetching employee services:', error)
    res.status(500).json({ error: 'Failed to fetch services' })
  }
})

// Start a new shift
router.post('/start', async (req, res) => {
  try {
    console.log('[SHIFT START] Request from user:', req.user)

    if (!req.user) {
      console.log('[SHIFT START] Not authenticated')
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(401).json({ error: 'Not authenticated' })
    }

    console.log('[SHIFT START] Looking for employee with email:', req.user.email)
    const employee = await getEmployeeByUser(req.user.email!)
    console.log('[SHIFT START] Found employee:', employee)

    if (!employee) {
      console.log('[SHIFT START] Employee not found for email:', req.user.email)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: `Employee not found for email: ${req.user.email}. Please ensure you are linked to a team member.` })
    }

    // Check if there's already an active shift
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.employeeId, employee.id),
          isNull(shifts.endTime)
        )
      )

    if (activeShifts.length > 0) {
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(400).json({ error: 'You already have an active shift' })
    }

    const now = new Date()
    const dayOfWeek = now.getDay()

    // Check if there's a scheduled shift for today
    const schedules = await db
      .select()
      .from(shiftSchedules)
      .where(
        and(
          eq(shiftSchedules.employeeId, employee.id),
          eq(shiftSchedules.dayOfWeek, dayOfWeek),
          eq(shiftSchedules.isActive, true)
        )
      )

    const schedule = schedules[0]
    let isLate = false
    let lateMinutes = 0
    let scheduleId = null

    if (schedule) {
      const lateCheck = checkIfLate(schedule.startTime, now)
      isLate = lateCheck.isLate
      lateMinutes = lateCheck.lateMinutes
      scheduleId = schedule.id
    }

    // NEW: Handle service selection for Slack notifications
    const { serviceId } = req.body
    let validatedServiceId = null
    let slackChannelId = null

    if (serviceId) {
      // Verify employee is assigned to this service
      const assignment = await db
        .select({
          service: clientServices,
          assignment: clientServiceTeamMembers
        })
        .from(clientServiceTeamMembers)
        .innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
        .where(and(
          eq(clientServiceTeamMembers.teamMemberId, employee.id),
          eq(clientServiceTeamMembers.clientServiceId, serviceId),
          eq(clientServiceTeamMembers.isActive, true)
        ))
        .limit(1)

      if (assignment.length === 0) {
        const origin = req.headers.origin
        if (origin) {
          res.header('Access-Control-Allow-Origin', origin)
          res.header('Access-Control-Allow-Credentials', 'true')
        }
        return res.status(400).json({
          error: 'You are not assigned to this service'
        })
      }

      validatedServiceId = serviceId
      slackChannelId = assignment[0].service.slackChannelId
    }

    // Create new shift
    const newShifts = await db
      .insert(shifts)
      .values({
        employeeId: employee.id,
        scheduleId,
        serviceId: validatedServiceId, // NEW: Store service ID
        startTime: now,
        status: 'active',
        isLate,
        lateMinutes,
      })
      .returning()

    const createdShift = newShifts[0]
    notifyShiftEvent({
      event: 'shift_started',
      employeeName: employee.name || (employee as any).fullName || null,
      employeeEmail: employee.email,
      shiftId: createdShift.id,
      timestamp: now,
      channelId: slackChannelId || undefined // NEW: Use service channel
    }).catch((err) => console.error('[SLACK] shift start notify failed:', err))

    // Emit WebSocket event for real-time updates
    emitShiftStarted({
      shiftId: createdShift.id,
      employeeId: employee.id,
      employeeName: employee.name || (employee as any).fullName || 'Unknown',
      employeeEmail: employee.email,
      serviceId: validatedServiceId || undefined,
      timestamp: now.toISOString()
    })

    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.json({ shift: createdShift, message: 'Shift started successfully' })
  } catch (error) {
    console.error('[SHIFT START] Error starting shift:', error)
    const err = error as Error
    console.error('[SHIFT START] Error stack:', err.stack)
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({ error: 'Failed to start shift' })
  }
})

// End current shift
router.post('/end', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const employee = await getEmployeeByUser(req.user.email!)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Find active shift
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.employeeId, employee.id),
          isNull(shifts.endTime)
        )
      )

    if (activeShifts.length === 0) {
      return res.status(400).json({ error: 'No active shift found' })
    }

    const activeShift = activeShifts[0]

    // NEW: Get service's Slack channel if shift has a service
    let slackChannelId = null
    if (activeShift.serviceId) {
      const serviceData = await db
        .select({ slackChannelId: clientServices.slackChannelId })
        .from(clientServices)
        .where(eq(clientServices.id, activeShift.serviceId))
        .limit(1)

      if (serviceData.length > 0) {
        slackChannelId = serviceData[0].slackChannelId
      }
    }

    // End any active breaks first
    await db
      .update(shiftBreaks)
      .set({ endTime: new Date() })
      .where(
        and(
          eq(shiftBreaks.shiftId, activeShift.id),
          isNull(shiftBreaks.endTime)
        )
      )

    // End the shift
    const now = new Date()
    const updatedShifts = await db
      .update(shifts)
      .set({
        endTime: now,
        status: 'completed',
        updatedAt: now
      })
      .where(eq(shifts.id, activeShift.id))
      .returning()

    const endedShift = updatedShifts[0]
    notifyShiftEvent({
      event: 'shift_ended',
      employeeName: employee.name || (employee as any).fullName || null,
      employeeEmail: employee.email,
      shiftId: endedShift.id,
      timestamp: now,
      channelId: slackChannelId || undefined
    }).catch((err) => console.error('[SLACK] shift end notify failed:', err))

    // Emit WebSocket event for real-time updates
    emitShiftEnded({
      shiftId: endedShift.id,
      employeeId: employee.id,
      employeeName: employee.name || (employee as any).fullName || 'Unknown',
      employeeEmail: employee.email,
      serviceId: activeShift.serviceId || undefined,
      timestamp: now.toISOString()
    })

    res.json({ shift: endedShift, message: 'Shift ended successfully' })
  } catch (error) {
    console.error('Error ending shift:', error)
    res.status(500).json({ error: 'Failed to end shift' })
  }
})

// Start a break
router.post('/break/start', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const employee = await getEmployeeByUser(req.user.email!)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Find active shift
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.employeeId, employee.id),
          isNull(shifts.endTime)
        )
      )

    if (activeShifts.length === 0) {
      return res.status(400).json({ error: 'No active shift found. Start a shift first.' })
    }

    const activeShift = activeShifts[0]

    // NEW: Get service's Slack channel if shift has a service
    let slackChannelId = null
    if (activeShift.serviceId) {
      const serviceData = await db
        .select({ slackChannelId: clientServices.slackChannelId })
        .from(clientServices)
        .where(eq(clientServices.id, activeShift.serviceId))
        .limit(1)

      if (serviceData.length > 0) {
        slackChannelId = serviceData[0].slackChannelId
      }
    }

    // Check if there's already an active break
    const activeBreaks = await db
      .select()
      .from(shiftBreaks)
      .where(
        and(
          eq(shiftBreaks.shiftId, activeShift.id),
          isNull(shiftBreaks.endTime)
        )
      )

    if (activeBreaks.length > 0) {
      return res.status(400).json({ error: 'You are already on a break' })
    }

    // Start new break
    const newBreaks = await db
      .insert(shiftBreaks)
      .values({
        shiftId: activeShift.id,
        startTime: new Date(),
        breakType: req.body.breakType || 'regular'
      })
      .returning()

    // Update shift status to on_break
    await db
      .update(shifts)
      .set({ status: 'on_break', updatedAt: new Date() })
      .where(eq(shifts.id, activeShift.id))

    const createdBreak = newBreaks[0]
    const rawDescriptionCandidates = [
      req.body?.description,
      req.body?.note,
      req.body?.breakNote,
      req.body?.break_description
    ]
    const pickedRaw = rawDescriptionCandidates.find((v) => typeof v === 'string')
    const breakNote = pickedRaw ? pickedRaw.trim() : undefined

    notifyShiftEvent({
      event: 'break_started',
      employeeName: employee.name || (employee as any).fullName || null,
      employeeEmail: employee.email,
      shiftId: activeShift.id,
      breakType: req.body.breakType || 'regular',
      breakNote: breakNote || undefined,
      timestamp: createdBreak.startTime,
      channelId: slackChannelId || undefined
    }).catch((err) => console.error('[SLACK] break start notify failed:', err))

    // Emit WebSocket event for real-time updates
    emitBreakStarted({
      breakId: createdBreak.id,
      shiftId: activeShift.id,
      employeeId: employee.id,
      employeeName: employee.name || (employee as any).fullName || 'Unknown',
      employeeEmail: employee.email,
      breakType: req.body.breakType || 'regular',
      breakNote: breakNote,
      timestamp: createdBreak.startTime.toISOString()
    })

    res.json({ break: createdBreak, message: 'Break started successfully' })
  } catch (error) {
    console.error('Error starting break:', error)
    res.status(500).json({ error: 'Failed to start break' })
  }
})

// End current break
router.post('/break/end', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const employee = await getEmployeeByUser(req.user.email!)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Find active shift
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.employeeId, employee.id),
          isNull(shifts.endTime)
        )
      )

    if (activeShifts.length === 0) {
      return res.status(400).json({ error: 'No active shift found' })
    }


    const activeShift = activeShifts[0]

    // NEW: Get service's Slack channel if shift has a service
    let slackChannelId = null
    if (activeShift.serviceId) {
      const serviceData = await db
        .select({ slackChannelId: clientServices.slackChannelId })
        .from(clientServices)
        .where(eq(clientServices.id, activeShift.serviceId))
        .limit(1)

      if (serviceData.length > 0) {
        slackChannelId = serviceData[0].slackChannelId
      }
    }

    // Find active break
    const activeBreaks = await db
      .select()
      .from(shiftBreaks)
      .where(
        and(
          eq(shiftBreaks.shiftId, activeShift.id),
          isNull(shiftBreaks.endTime)
        )
      )

    if (activeBreaks.length === 0) {
      return res.status(400).json({ error: 'No active break found' })
    }

    // End the break
    const updatedBreaks = await db
      .update(shiftBreaks)
      .set({ endTime: new Date() })
      .where(eq(shiftBreaks.id, activeBreaks[0].id))
      .returning()

    // Update shift status back to active
    await db
      .update(shifts)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(shifts.id, activeShift.id))

    const endedBreak = updatedBreaks[0]
    notifyShiftEvent({
      event: 'break_ended',
      employeeName: employee.name || (employee as any).fullName || null,
      employeeEmail: employee.email,
      shiftId: activeShift.id,
      timestamp: endedBreak.endTime || new Date(),
      channelId: slackChannelId || undefined
    }).catch((err) => console.error('[SLACK] break end notify failed:', err))

    // Emit WebSocket event for real-time updates
    emitBreakEnded({
      breakId: endedBreak.id,
      shiftId: activeShift.id,
      employeeId: employee.id,
      employeeName: employee.name || (employee as any).fullName || 'Unknown',
      employeeEmail: employee.email,
      timestamp: (endedBreak.endTime || new Date()).toISOString()
    })

    res.json({ break: endedBreak, message: 'Break ended successfully' })
  } catch (error) {
    console.error('Error ending break:', error)
    res.status(500).json({ error: 'Failed to end break' })
  }
})

// Get shift history for logged-in employee
router.get('/history', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const employee = await getEmployeeByUser(req.user.email!)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const { startDate, endDate, limit = 50 } = req.query

    const conditions = [eq(shifts.employeeId, employee.id)]
    if (startDate) {
      conditions.push(gte(shifts.startTime, new Date(startDate as string)))
    }
    if (endDate) {
      conditions.push(lte(shifts.startTime, new Date(endDate as string)))
    }

    const history = await db
      .select()
      .from(shifts)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(shifts.startTime))
      .limit(Number(limit))

    res.json({ shifts: history })
  } catch (error) {
    console.error('Error fetching shift history:', error)
    res.status(500).json({ error: 'Failed to fetch shift history' })
  }
})

// ADMIN ROUTES

// Get all active shifts (admin only)
router.get('/admin/active', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const activeShifts = await db
      .select({
        shift: shifts,
        employee: teamMembers
      })
      .from(shifts)
      .innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id))
      .where(isNull(shifts.endTime))
      .orderBy(desc(shifts.startTime))

    // Get breaks for active shifts
    const shiftsWithBreaks = await Promise.all(
      activeShifts.map(async ({ shift, employee }) => {
        const activeBreaks = await db
          .select()
          .from(shiftBreaks)
          .where(
            and(
              eq(shiftBreaks.shiftId, shift.id),
              isNull(shiftBreaks.endTime)
            )
          )

        return {
          ...shift,
          employee,
          activeBreak: activeBreaks[0] || null
        }
      })
    )

    res.json({ shifts: shiftsWithBreaks })
  } catch (error) {
    console.error('Error fetching active shifts:', error)
    res.status(500).json({ error: 'Failed to fetch active shifts' })
  }
})

// Get late/missed shifts for today (admin only)
router.get('/admin/late', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get late shifts for today
    const lateShifts = await db
      .select({
        shift: shifts,
        employee: teamMembers
      })
      .from(shifts)
      .innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id))
      .where(
        and(
          eq(shifts.isLate, true),
          gte(shifts.startTime, today),
          lte(shifts.startTime, tomorrow)
        )
      )
      .orderBy(desc(shifts.lateMinutes))

    // Get scheduled shifts that haven't started yet
    const dayOfWeek = new Date().getDay()
    const schedules = await db
      .select({
        schedule: shiftSchedules,
        employee: teamMembers
      })
      .from(shiftSchedules)
      .innerJoin(teamMembers, eq(shiftSchedules.employeeId, teamMembers.id))
      .where(
        and(
          eq(shiftSchedules.dayOfWeek, dayOfWeek),
          eq(shiftSchedules.isActive, true)
        )
      )

    // Filter out schedules that have started today
    const missedShifts = []
    for (const { schedule, employee } of schedules) {
      const todayShifts = await db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.employeeId, employee.id),
            gte(shifts.startTime, today)
          )
        )

      if (todayShifts.length === 0) {
        const [scheduleHour, scheduleMinute] = schedule.startTime.split(':').map(Number)
        const scheduledTime = new Date()
        scheduledTime.setHours(scheduleHour, scheduleMinute, 0, 0)

        if (new Date() > scheduledTime) {
          missedShifts.push({ schedule, employee })
        }
      }
    }

    res.json({
      lateShifts,
      missedShifts
    })
  } catch (error) {
    console.error('Error fetching late/missed shifts:', error)
    res.status(500).json({ error: 'Failed to fetch late/missed shifts' })
  }
})

// Get shift history for all employees (admin only)
router.get('/admin/history', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { startDate, endDate, employeeId, limit = 100 } = req.query

    let conditions = []

    if (employeeId) {
      conditions.push(eq(shifts.employeeId, Number(employeeId)))
    }

    if (startDate) {
      conditions.push(gte(shifts.startTime, new Date(startDate as string)))
    }

    if (endDate) {
      conditions.push(lte(shifts.startTime, new Date(endDate as string)))
    }

    const history = await db
      .select({
        shift: shifts,
        employee: teamMembers
      })
      .from(shifts)
      .innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shifts.startTime))
      .limit(Number(limit))

    res.json({ shifts: history })
  } catch (error) {
    console.error('Error fetching shift history:', error)
    res.status(500).json({ error: 'Failed to fetch shift history' })
  }
})

// Get/Create shift schedules (admin only)
router.get('/admin/schedules/:employeeId', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const employeeId = Number(req.params.employeeId)

    const schedules = await db
      .select()
      .from(shiftSchedules)
      .where(eq(shiftSchedules.employeeId, employeeId))
      .orderBy(shiftSchedules.dayOfWeek)

    res.json({ schedules })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    res.status(500).json({ error: 'Failed to fetch schedules' })
  }
})

router.post('/admin/schedules', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { employeeId, dayOfWeek, startTime, endTime } = req.body

    const newSchedule = await db
      .insert(shiftSchedules)
      .values({
        employeeId,
        dayOfWeek,
        startTime,
        endTime,
        isActive: true
      })
      .returning()

    res.json({ schedule: newSchedule[0], message: 'Schedule created successfully' })
  } catch (error) {
    console.error('Error creating schedule:', error)
    res.status(500).json({ error: 'Failed to create schedule' })
  }
})

// Get shifts for client's team (developers in active services)
router.get('/client/team', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      console.log('[GET /client/team] Unauthorized:', req.user?.role)
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

    // Get all active client services (outsourcing/outstaffing) using standard select with join
    const activeServices = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceTypeId: clientServices.serviceTypeId,
        isActive: clientServices.isActive,
        serviceTypeName: serviceTypes.name,
        serviceTypeCategory: serviceTypes.category
      })
      .from(clientServices)
      .innerJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.isActive, true)
      ))

    console.log('[GET /client/team] Found', activeServices.length, 'active services')

    // Filter for outsourcing and outstaffing services
    const relevantServices = activeServices.filter(service =>
      service.serviceTypeName === 'Outsourcing' || service.serviceTypeName === 'Outstaffing'
    )

    console.log('[GET /client/team] Found', relevantServices.length, 'outsourcing/outstaffing services')

    if (relevantServices.length === 0) {
      console.log('[GET /client/team] No active outsourcing/outstaffing services found')
      return res.json({ shifts: [], message: 'No active outsourcing/outstaffing services found' })
    }

    // Get team member IDs assigned to these services
    const serviceIds = relevantServices.map(s => s.id)
    console.log('[GET /client/team] Service IDs:', serviceIds)

    // Query to get shifts for team members in these services
    const teamShifts = await db
      .select({
        shift: shifts,
        employee: teamMembers
      })
      .from(shifts)
      .innerJoin(teamMembers, eq(shifts.employeeId, teamMembers.id))
      .where(
        and(
          isNull(shifts.endTime),
          sql`${shifts.employeeId} IN (
            SELECT tm.id FROM team_members tm
            JOIN client_service_team_members cstm ON cstm.team_member_id = tm.id
            WHERE cstm.client_service_id IN (${sql.join(serviceIds.map(id => sql`${id}`), sql`, `)})
            AND cstm.is_active = true
          )`
        )
      )
      .orderBy(desc(shifts.startTime))

    // Get active breaks for these shifts
    const shiftIds = teamShifts.map(s => s.shift.id)
    const activeBreaks = shiftIds.length > 0 ? await db
      .select()
      .from(shiftBreaks)
      .where(
        and(
          sql`${shiftBreaks.shiftId} IN (${sql.join(shiftIds.map(id => sql`${id}`), sql`, `)})`,
          isNull(shiftBreaks.endTime)
        )
      ) : []

    // Combine shift data with employee info and breaks
    const shiftsWithDetails = teamShifts.map(({ shift, employee }) => {
      const activeBreak = activeBreaks.find(b => b.shiftId === shift.id)
      return {
        ...shift,
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          avatarUrl: employee.avatarUrl,
          position: employee.role // Map role to position for compatibility
        },
        activeBreak: activeBreak ? {
          id: activeBreak.id,
          startTime: activeBreak.startTime
        } : null
      }
    })

    console.log('[GET /client/team] Returning', shiftsWithDetails.length, 'shifts')
    console.log('[GET /client/team] Shift data sample:', shiftsWithDetails.length > 0 ? JSON.stringify(shiftsWithDetails[0], null, 2) : 'none')
    res.json({ shifts: shiftsWithDetails })
  } catch (error) {
    console.error('Error fetching client team shifts:', error)
    res.status(500).json({ error: 'Failed to fetch team shifts' })
  }
})

export default router
