import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Coffee, Calendar, Users, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, TreePalm, HeartPulse } from 'lucide-react'
import { api } from '@/lib/api'
import { convertTime, getBrowserTimezone } from '@/lib/timezone'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

interface Shift {
  id: number
  employeeId: number
  startTime: string
  endTime: string | null
  status: 'active' | 'on_break' | 'completed'
  isLate: boolean
  lateMinutes: number
  employee: {
    id: number
    name: string
    email: string
    position?: string
    avatarUrl?: string
  }
  activeBreak?: {
    id: number
    startTime: string
  }
}

interface Vacation {
  id: number
  employeeId: number
  startDate: string
  endDate: string
  status: string
  leaveType: string
  employee: {
    id: number
    name: string
    email: string
    position?: string
    avatarUrl?: string
  }
}

interface TeamMember {
  id: number
  developerId: number
  name: string
  email: string
  position?: string
  avatarUrl?: string
  workSchedule?: Record<string, string>
}

// Public holidays configuration
const getPublicHolidays = (year: number) => {
  // Calculate 4th Thursday of November (Thanksgiving)
  const getThanksgiving = (year: number) => {
    const november = new Date(year, 10, 1) // November is month 10
    const firstDay = november.getDay()
    const firstThursday = firstDay <= 4 ? 5 - firstDay : 12 - firstDay
    return new Date(year, 10, firstThursday + 21) // 4th Thursday
  }

  return [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: new Date(year, 4, 1), name: "International Workers' Day" },
    { date: getThanksgiving(year), name: "Thanksgiving" },
    { date: new Date(year, 11, 24), name: "Christmas Eve" },
    { date: new Date(year, 11, 25), name: "Christmas Day" },
    { date: new Date(year, 11, 31), name: "New Year's Eve" },
  ]
}

const isPublicHoliday = (date: Date) => {
  const holidays = getPublicHolidays(date.getFullYear())
  return holidays.find(holiday =>
    holiday.date.getDate() === date.getDate() &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getFullYear() === date.getFullYear()
  )
}

export function ClientTeamStatus() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Connect to WebSocket for real-time updates
  useShiftEvents()

  const { data: shiftsData, isLoading: isLoadingShifts, refetch: refetchShifts } = useQuery({
    queryKey: ['clientTeamShifts'],
    queryFn: () => api.getClientTeamShifts(),
    refetchInterval: 5 * 60 * 1000, // Fallback: refresh every 5 minutes
  })

  const { data: vacationsData, isLoading: isLoadingVacations } = useQuery({
    queryKey: ['clientTeamVacations'],
    queryFn: () => api.getClientTeamVacations(),
    refetchInterval: 5 * 60 * 1000, // Fallback: refresh every 5 minutes
  })

  const { data: schedulesData, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['clientTeamSchedules'],
    queryFn: () => api.getClientTeamSchedules(),
    refetchInterval: 5 * 60 * 1000, // Fallback: refresh every 5 minutes
  })

  // Store refetch function in ref to avoid stale closures
  const refetchShiftsRef = useRef(refetchShifts)

  useEffect(() => {
    refetchShiftsRef.current = refetchShifts
  }, [refetchShifts])

  // Listen for socket shift updates and refetch data using ref
  const handleShiftUpdate = useCallback(() => {
    refetchShiftsRef.current()
  }, [])

  useShiftUpdateListener(handleShiftUpdate)

  // Fetch current user for timezone
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })

  // Fetch preferred shifts for all team members
  const { data: preferredShiftsData } = useQuery({
    queryKey: ['allPreferredShifts'],
    queryFn: () => api.getAllPreferredShifts(),
  })

  // Fetch shift overrides for current month
  const currentMonthStr = format(currentMonth, 'yyyy-MM')
  const { data: overridesData } = useQuery({
    queryKey: ['allShiftOverrides', currentMonthStr],
    queryFn: () => api.getAllShiftOverrides(currentMonthStr),
  })

  const viewerTimezone = currentUser?.timezone || getBrowserTimezone()

  const activeShifts: Shift[] = shiftsData?.shifts ?? []
  const vacations: Vacation[] = vacationsData?.vacations ?? []
  const teamMembers: TeamMember[] = schedulesData?.teamMembers ?? []
  const loading = isLoadingShifts || isLoadingVacations || isLoadingSchedules

  // Get shift time for a member on a specific date, converted to viewer's timezone
  const getShiftTimeForMember = (memberId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = date.getDay()

    // Check overrides first
    const overrides = overridesData?.overrides || []
    const override = overrides.find((o: any) => o.employeeId === memberId && o.override?.overrideDate === dateStr)
    if (override) {
      const memberTz = override.employee?.timezone || viewerTimezone
      const start = convertTime(override.override.startTime, memberTz, viewerTimezone)
      const end = convertTime(override.override.endTime, memberTz, viewerTimezone)
      return { startTime: start.time, endTime: end.time, isDayOff: override.override.isDayOff, isOverride: true, abbreviation: start.abbreviation }
    }

    // Fall back to preferred schedule
    const memberData = preferredShiftsData?.members?.find((m: any) => m.employee.id === memberId)
    if (!memberData) return null
    const schedule = memberData.schedules.find((s: any) => s.dayOfWeek === dayOfWeek && s.isActive)
    if (!schedule) return null

    const memberTz = memberData.employee.timezone || viewerTimezone
    const start = convertTime(schedule.startTime, memberTz, viewerTimezone)
    const end = convertTime(schedule.endTime, memberTz, viewerTimezone)
    return { startTime: start.time, endTime: end.time, isDayOff: false, isOverride: false, abbreviation: start.abbreviation }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getDuration = (start: string) => {
    const diff = Date.now() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return (new Date(year, month, 1).getDay() + 6) % 7
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  const getVacationsForDate = (date: Date) => {
    return vacations.filter(v => {
      const start = new Date(v.startDate)
      const end = new Date(v.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      const checkDate = new Date(date)
      checkDate.setHours(12, 0, 0, 0)
      return checkDate >= start && checkDate <= end
    })
  }

  const getWorkingTeamMembersForDate = (date: Date) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[date.getDay()]

    // Check if it's a public holiday - no one works on public holidays
    if (isPublicHoliday(date)) {
      return []
    }

    // Get employees on vacation/sick leave on this date (match by email since vacation uses team_members table)
    const vacationsOnDate = getVacationsForDate(date)
    const vacationingEmails = vacationsOnDate.map(v => v.employee.email.toLowerCase())

    return teamMembers.filter(member => {
      // Skip if on vacation or sick leave (match by email)
      if (member.email && vacationingEmails.includes(member.email.toLowerCase())) {
        return false
      }

      // Check work schedule - if not set, default to Monday-Friday full time
      if (!member.workSchedule) {
        // Default schedule: Monday-Friday are working days
        return dayName === 'monday' || dayName === 'tuesday' || dayName === 'wednesday' ||
               dayName === 'thursday' || dayName === 'friday'
      }

      const schedule = member.workSchedule[dayName]
      return schedule === 'full' || schedule === 'half'
    })
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const workingNow = activeShifts.filter(s => s.status === 'active')
  const onBreak = activeShifts.filter(s => s.status === 'on_break')

  // Calculate unique team members (no duplicates by email)
  const getUniqueTeamSize = () => {
    const uniqueEmails = new Set<string>()
    teamMembers.forEach(member => {
      if (member.email) {
        uniqueEmails.add(member.email.toLowerCase())
      }
    })
    return uniqueEmails.size
  }

  // Filter current and upcoming vacations
  const now = new Date()
  const currentVacations = vacations.filter(v => {
    const start = new Date(v.startDate)
    const end = new Date(v.endDate)
    return start <= now && end >= now
  })

  const upcomingVacations = vacations.filter(v => {
    const start = new Date(v.startDate)
    return start > now
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Workspace"
        title="Team availability radar"
        description="Monitor who is online, who is away, and how planned leave affects delivery capacity across the current month."
        theme="teal"
        meta={(
          <>
            <span className="hero-meta-pill">
              {getUniqueTeamSize()} team members
            </span>
            <span className="hero-meta-pill">
              Viewer TZ: {viewerTimezone}
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Team Size"
          value={getUniqueTeamSize()}
          hint="Unique teammates in scope"
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
        <MetricTile
          label="Working"
          value={workingNow.length}
          hint="Live active shifts"
          icon={<Clock className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricTile
          label="On Break"
          value={onBreak.length}
          hint="Temporary pauses"
          icon={<Coffee className="h-5 w-5" />}
          tone="amber"
        />
        <MetricTile
          label="On Vacation"
          value={currentVacations.length}
          hint="Currently unavailable"
          icon={<TreePalm className="h-5 w-5" />}
          tone="violet"
        />
        <MetricTile
          label="Upcoming Leave"
          value={upcomingVacations.length}
          hint="Planned absence"
          icon={<Calendar className="h-5 w-5" />}
          tone="rose"
        />
      </div>

      {activeShifts.length > 0 && (
        <div>
          <SectionHeading
            title={`Team members online (${activeShifts.length})`}
            description="Developers currently working on your projects."
            icon={<Clock className="h-5 w-5" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeShifts.map((shift) => (
              <Card
                key={shift.id}
                className={`overflow-hidden border-white/80 bg-white/92 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-34px_rgba(15,23,42,0.55)] ${
                  shift.status === 'on_break'
                    ? 'ring-1 ring-amber-200/70'
                    : 'ring-1 ring-emerald-200/70'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                        <AvatarImage src={shift.employee.avatarUrl} alt={shift.employee.name} />
                        <AvatarFallback className={`font-semibold ${
                          shift.status === 'on_break'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {shift.employee.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                        shift.status === 'on_break' ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{shift.employee.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{shift.employee.position || 'Developer'}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    {shift.status === 'on_break' && shift.activeBreak ? (
                      <Badge variant="outline" className="w-full justify-center border-amber-300 bg-amber-100 text-amber-700">
                        <Coffee className="w-3 h-3 mr-1" />
                        On Break ({getDuration(shift.activeBreak.startTime)})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-full justify-center border-emerald-300 bg-emerald-100 text-emerald-700">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Working
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 rounded-[1rem] border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-semibold text-foreground">{formatTime(shift.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold text-foreground">{getDuration(shift.startTime)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Vacations */}
      {(currentVacations.length > 0 || upcomingVacations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Vacations */}
          {currentVacations.length > 0 && (
            <Card className="border-sky-200/80 bg-white/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sky-700">
                  <Calendar className="w-5 h-5" />
                  Currently On Vacation
                </CardTitle>
                <CardDescription>Team members currently away</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentVacations.map((vacation) => (
                    <div
                      key={vacation.id}
                      className="flex items-center justify-between rounded-[1rem] border border-sky-200/80 bg-sky-50/85 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-blue-200">
                          <AvatarImage src={vacation.employee.avatarUrl} alt={vacation.employee.name} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                            {vacation.employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{vacation.employee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                        {vacation.leaveType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Vacations */}
          {upcomingVacations.length > 0 && (
            <Card className="border-violet-200/80 bg-white/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet-700">
                  <Calendar className="w-5 h-5" />
                  Upcoming Vacations
                </CardTitle>
                <CardDescription>Planned absences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingVacations.slice(0, 5).map((vacation) => (
                    <div
                      key={vacation.id}
                      className="flex items-center justify-between rounded-[1rem] border border-violet-200/80 bg-violet-50/85 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-purple-200">
                          <AvatarImage src={vacation.employee.avatarUrl} alt={vacation.employee.name} />
                          <AvatarFallback className="bg-purple-100 text-purple-700 font-semibold text-sm">
                            {vacation.employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{vacation.employee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        {vacation.leaveType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* Vacation Calendar */}
      {vacations.length > 0 && (
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Team Workload and Vacations
                </CardTitle>
                <CardDescription>View your team's work schedule and time off</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-semibold px-4">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Calendar Legend</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Leave Types */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Time Off:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TreePalm className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <span className="text-xs text-gray-700">Vacation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-xs text-gray-700">Sick Leave</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-600 from-green-50 to-green-100 border border-green-400 rounded flex-shrink-0"></div>
                      <span className="text-xs text-gray-700">Public Holiday</span>
                    </div>
                  </div>
                </div>

                {/* Working Status */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Working Status:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-[10px] font-semibold text-green-900">
                        Team Member
                      </div>
                      <span className="text-xs text-gray-700">Working Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded">½ Day</span>
                      <span className="text-xs text-gray-700">Half Day Schedule</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Calendar days */}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
                const day = i + 1
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                const dayVacations = getVacationsForDate(date)
                const workingMembers = getWorkingTeamMembersForDate(date)
                const isToday = isSameDay(date, new Date())
                const isSelected = selectedDate && isSameDay(date, selectedDate)
                const holiday = isPublicHoliday(date)

                // Determine dominant leave type for background color
                const hasVacation = dayVacations.some(v => v.leaveType === 'Vacation')
                const hasSickLeave = dayVacations.some(v => v.leaveType === 'Sick Leave')

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`aspect-square p-1 border rounded-lg cursor-pointer transition-all ${
                      isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    } ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    } ${
                      holiday
                        ? 'border-green-300 bg-emerald-50/85'
                        : dayVacations.length > 0
                          ? hasVacation && hasSickLeave
                            ? 'border-purple-300 bg-violet-50/75'
                            : hasVacation
                              ? 'bg-blue-50/80 border-blue-300'
                              : hasSickLeave
                                ? 'bg-red-50/80 border-red-300'
                                : 'bg-purple-50 border-purple-300'
                          : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 text-center">
                      {day}
                    </div>
                    {holiday && (
                      <div className="mt-1 truncate rounded bg-emerald-100 px-1 py-0.5 text-center text-[10px] font-semibold text-emerald-800" title={holiday.name}>
                        {holiday.name}
                      </div>
                    )}
                    {dayVacations.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {dayVacations.slice(0, 2).map((vacation) => {
                          const isVacation = vacation.leaveType === 'Vacation'
                          const isSickLeave = vacation.leaveType === 'Sick Leave'
                          return (
                            <div
                              key={vacation.id}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border ${
                                isVacation
                                  ? 'bg-blue-50 border-blue-200'
                                  : isSickLeave
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-purple-50 border-purple-200'
                              }`}
                              title={`${vacation.employee.name} - ${vacation.leaveType}`}
                            >
                              {isVacation ? (
                                <TreePalm className="h-3 w-3 text-purple-600 flex-shrink-0" />
                              ) : isSickLeave ? (
                                <HeartPulse className="h-3 w-3 text-red-600 flex-shrink-0" />
                              ) : (
                                <TreePalm className="h-3 w-3 text-purple-600 flex-shrink-0" />
                              )}
                              <Avatar className={`h-4 w-4 border ${
                                isVacation
                                  ? 'border-blue-300'
                                  : isSickLeave
                                    ? 'border-red-300'
                                    : 'border-purple-300'
                              }`}>
                                <AvatarImage src={vacation.employee.avatarUrl} alt={vacation.employee.name} />
                                <AvatarFallback className={`text-[8px] font-semibold ${
                                  isVacation
                                    ? 'bg-blue-200 text-blue-900'
                                    : isSickLeave
                                      ? 'bg-red-200 text-red-900'
                                      : 'bg-purple-200 text-purple-900'
                                }`}>
                                  {vacation.employee.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`text-xs font-medium truncate ${
                                isVacation
                                  ? 'text-blue-800'
                                  : isSickLeave
                                    ? 'text-red-800'
                                    : 'text-purple-800'
                              }`}>
                                {vacation.employee.name}
                              </span>
                            </div>
                          )
                        })}
                        {dayVacations.length > 2 && (
                          <div className="text-xs text-gray-600 font-medium bg-gray-100 rounded-lg px-2 py-1 text-center">
                            +{dayVacations.length - 2} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Working team members */}
                    {workingMembers.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {workingMembers.slice(0, 3).map((member) => {
                          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                          const dayName = dayNames[date.getDay()]
                          const isHalfDay = member.workSchedule?.[dayName] === 'half'
                          const shiftInfo = getShiftTimeForMember(member.developerId || member.id, date)

                          return (
                            <div
                              key={member.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border hover:bg-green-100 transition-colors ${
                                shiftInfo?.isOverride ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                              }`}
                              title={`${member.name} - ${shiftInfo?.isDayOff ? 'Day Off' : isHalfDay ? 'Half Day' : 'Full Day'}${shiftInfo && !shiftInfo.isDayOff ? ` (${shiftInfo.startTime}-${shiftInfo.endTime})` : ''}`}
                            >
                              <Avatar className="h-6 w-6 border-2 border-green-300 flex-shrink-0">
                                <AvatarImage src={member.avatarUrl} alt={member.name || 'Team Member'} />
                                <AvatarFallback className="text-[10px] font-bold bg-green-200 text-green-900">
                                  {member.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-green-900 truncate">
                                  {member.name}
                                </div>
                                {shiftInfo && !shiftInfo.isDayOff && (
                                  <div className={`text-[9px] truncate ${
                                    shiftInfo.isOverride ? 'text-amber-700 font-medium' : 'text-green-700'
                                  }`}>
                                    {shiftInfo.startTime}-{shiftInfo.endTime}{shiftInfo.abbreviation ? ` ${shiftInfo.abbreviation}` : ''}
                                  </div>
                                )}
                              </div>
                              {isHalfDay && (
                                <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded flex-shrink-0">
                                  ½ Day
                                </span>
                              )}
                            </div>
                          )
                        })}
                        {workingMembers.length > 3 && (
                          <div className="text-xs text-gray-700 font-semibold bg-gray-100 rounded-lg px-2 py-1.5 text-center border border-gray-200">
                            +{workingMembers.length - 3} more working
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Selected date details */}
            {selectedDate && getVacationsForDate(selectedDate).length > 0 && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h4>
                <div className="space-y-2">
                  {getVacationsForDate(selectedDate).map((vacation) => (
                    <div key={vacation.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border-2 border-purple-200">
                        <AvatarImage src={vacation.employee.avatarUrl} alt={vacation.employee.name || 'Employee'} />
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                          {vacation.employee.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{vacation.employee.name}</p>
                        <p className="text-xs text-gray-600">
                          {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        {vacation.leaveType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      

      {/* Empty State */}
      {activeShifts.length === 0 && vacations.length === 0 && (
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="No team data available"
          description="Team activity will appear here once members start logging shifts or vacation entries."
        />
      )}
    </div>
  )
}
