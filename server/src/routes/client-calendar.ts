import { Router } from 'express'
import { and, eq, inArray, lte, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clientServices, serviceTypes, clientServiceTeamMembers, teamMembers, leaveRequests, leaveTypes, shiftSchedules, shiftScheduleOverrides } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { resolveClientScope, overlapsPeriod, dateKey, assignmentCapacity, scopedLeaveSegments } from '../services/clientWorkspace.js'
import { getEffectiveDay, dateRange, weekday, addDays } from '../utils/calendar.js'

const router = Router()
router.use(requireAuth)

function monthPeriod(value: unknown) {
  const month = typeof value === 'string' ? value : dateKey().slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [year, m] = month.split('-').map(Number)
  if (year < 2000 || year > 2100) return null
  return { month, start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}` }
}

async function loadCalendar(clientId: number, start: string, end: string) {
  const services = await db.select({ service: clientServices, type: serviceTypes }).from(clientServices)
    .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id)).where(eq(clientServices.clientId, clientId))
  const projects = services.filter(row => overlapsPeriod(row.service, start, end)).map(({ service, type }) => ({ id: service.id, title: service.serviceTitle || type?.name || 'Project', startDate: service.startDate, endDate: service.endDate, isActive: service.isActive }))
  if (!projects.length) return { projects, members: [], vacations: [], days: [] }
  const rows = await db.select({ assignment: clientServiceTeamMembers, employee: teamMembers }).from(clientServiceTeamMembers)
    .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
    .where(inArray(clientServiceTeamMembers.clientServiceId, projects.map(project => project.id)))
  const members = rows.filter(row => overlapsPeriod(row.assignment, start, end) && row.employee.startDate <= end).map(({ assignment, employee }) => ({
    id: assignment.id, assignmentId: assignment.id, employeeId: employee.id, teamMemberId: employee.id, projectId: assignment.clientServiceId,
    projectTitle: projects.find(project => project.id === assignment.clientServiceId)!.title,
    startDate: assignment.startDate, endDate: assignment.endDate, employeeStartDate: employee.startDate, isActive: assignment.isActive, workSchedule: assignment.workSchedule,
    name: employee.name, email: employee.email, avatarUrl: employee.avatarUrl, position: employee.position, timezone: employee.timezone || 'UTC',
  }))
  const employeeIds = [...new Set(members.map(member => member.employeeId))]
  if (!employeeIds.length) return { projects, members, vacations: [], days: [] }
  const [leaveRows, schedules, overrides] = await Promise.all([
    db.select({ request: leaveRequests, type: leaveTypes }).from(leaveRequests).innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(inArray(leaveRequests.employeeId, employeeIds), eq(leaveRequests.status, 'approved'), lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start))),
    db.select().from(shiftSchedules).where(inArray(shiftSchedules.employeeId, employeeIds)),
    db.select().from(shiftScheduleOverrides).where(and(inArray(shiftScheduleOverrides.employeeId, employeeIds), gte(shiftScheduleOverrides.overrideDate, start), lte(shiftScheduleOverrides.overrideDate, end))),
  ])
  const vacations = leaveRows.map(({ request, type }) => {
    const member = members.find(member => member.employeeId === request.employeeId)!
    return { id: request.id, employeeId: request.employeeId, startDate: request.startDate, endDate: request.endDate, halfDayStart: request.halfDayStart, halfDayEnd: request.halfDayEnd, status: request.status, leaveTypeId: type.id, leaveType: type.name,
      employee: { id: member.employeeId, name: member.name, email: member.email, avatarUrl: member.avatarUrl, position: member.position, timezone: member.timezone } }
  })
  const days = []
  for (const date of dateRange(start, end)) {
    for (const employeeId of employeeIds) {
      const assignments = members.filter(member => member.employeeId === employeeId && member.employeeStartDate <= date && overlapsPeriod(member, date, date) && overlapsPeriod(projects.find(project => project.id === member.projectId)!, date, date))
      if (!assignments.length) continue
      const member = assignments[0]
      const schedule = schedules.find(row => row.employeeId === employeeId && row.dayOfWeek === weekday(date) && row.isActive)
      const override = overrides.find(row => row.employeeId === employeeId && row.overrideDate === date)
      const effective = getEffectiveDay({ date, timezone: member.timezone, schedule, override, leaves: vacations.filter(leave => leave.employeeId === employeeId) })
      const projectIds = [...new Set(assignments.map(member => member.projectId))]
      const projectAvailability = projectIds.map(projectId => {
        const fraction = Math.max(...assignments.filter(member => member.projectId === projectId).map(member => assignmentCapacity(member.workSchedule, weekday(date))))
        return { projectId, workingMinutes: Math.min(effective.workingMinutes, effective.scheduledMinutes * fraction) }
      })
      const workingMinutes = Math.max(0, ...projectAvailability.map(project => project.workingMinutes))
      days.push({ ...effective, workingMinutes, isDayOff: effective.isDayOff || !workingMinutes,
        isScheduleConfigured: Boolean(override) || schedules.some(row => row.employeeId === employeeId), employeeId, projectIds, projectAvailability })
    }
  }
  // A client can see absence only on dates that belong to its project assignments.
  // Keep original boundaries internally for the half-day resolver, then redact them.
  const scopedVacations = vacations.flatMap(leave => scopedLeaveSegments(leave, days.filter(day => day.employeeId === leave.employeeId).map(day => day.date)))
  return { projects, members, vacations: scopedVacations, days }
}

router.get('/client/calendar', async (req, res) => {
  try {
    const clientId = await resolveClientScope(req, res)
    if (!clientId) return
    const period = monthPeriod(req.query.month)
    if (!period) return res.status(400).json({ error: 'Month must be YYYY-MM between 2000 and 2100' })
    // Include adjacent source days so viewer-timezone midnight crossings are retained.
    const calendar = await loadCalendar(clientId, addDays(period.start, -1), addDays(period.end, 1))
    res.json({ clientId, month: period.month, ...calendar })
  } catch (error) {
    console.error('Client calendar failed:', error)
    res.status(500).json({ error: 'Unable to load team calendar' })
  }
})

for (const route of ['/client/team', '/client/team/schedules']) {
  router.get(route, async (req, res) => {
    try {
      const clientId = await resolveClientScope(req, res)
      if (!clientId) return
      const period = monthPeriod(req.query.month)
      if (!period) return res.status(400).json({ error: 'Invalid month' })
      const calendar = await loadCalendar(clientId, period.start, period.end)
      res.json(route.endsWith('/schedules') ? { teamMembers: calendar.members, projects: calendar.projects } : { vacations: calendar.vacations })
    } catch (error) {
      console.error('Client team failed:', error)
      res.status(500).json({ error: 'Unable to load client team' })
    }
  })
}

export { router as clientCalendarRouter }
