import { useState, useEffect } from 'react'
import { Clock, Coffee, Calendar, Users, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, TreePalm, HeartPulse } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

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
  const [activeShifts, setActiveShifts] = useState<Shift[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      const [shiftsRes, vacationsRes, schedulesRes] = await Promise.all([
        api.getClientTeamShifts(),
        api.getClientTeamVacations(),
        api.getClientTeamSchedules()
      ])


      setActiveShifts(shiftsRes.shifts || [])
      setVacations(vacationsRes.vacations || [])
      setTeamMembers(schedulesRes.teamMembers || [])
    } catch (error) {
      console.error('Error fetching team data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeamData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchTeamData, 30000)
    return () => clearInterval(interval)
  }, [])

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
    return new Date(year, month, 1).getDay()
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading team status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Your Team Status</h1>
        <p className="text-gray-600 mt-1">Monitor your development team's availability in real-time</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Currently Working</p>
                <p className="text-3xl font-bold text-green-600">{workingNow.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Break</p>
                <p className="text-3xl font-bold text-amber-600">{onBreak.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Coffee className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Vacation</p>
                <p className="text-3xl font-bold text-blue-600">{currentVacations.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Leave</p>
                <p className="text-3xl font-bold text-purple-600">{upcomingVacations.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
{/* Active Team Members - Card Grid */}
{activeShifts.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Team Members Online ({activeShifts.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">Your developers currently working on your projects</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeShifts.map((shift) => (
              <Card
                key={shift.id}
                className={`overflow-hidden transition-all hover:shadow-lg ${
                  shift.status === 'on_break'
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-green-200 bg-green-50/30'
                }`}
              >
                <CardContent className="p-4">
                  {/* Avatar and Name */}
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
                      <h3 className="font-semibold text-gray-900 truncate">{shift.employee.name}</h3>
                      <p className="text-xs text-gray-600 truncate">{shift.employee.position || 'Developer'}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-3">
                    {shift.status === 'on_break' && shift.activeBreak ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 w-full justify-center">
                        <Coffee className="w-3 h-3 mr-1" />
                        On Break ({getDuration(shift.activeBreak.startTime)})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 w-full justify-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Working
                      </Badge>
                    )}
                  </div>

                  {/* Time Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Started</span>
                      <span className="font-semibold text-gray-900">{formatTime(shift.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold text-gray-900">{getDuration(shift.startTime)}</span>
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
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
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
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
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
                          <p className="font-semibold text-gray-900">{vacation.employee.name}</p>
                          <p className="text-sm text-gray-600">
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
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
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
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
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
                          <p className="font-semibold text-gray-900">{vacation.employee.name}</p>
                          <p className="text-sm text-gray-600">
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
        <Card>
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
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
                        ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
                        : dayVacations.length > 0
                          ? hasVacation && hasSickLeave
                            ? 'bg-gradient-to-br from-blue-50 to-red-50 border-purple-300'
                            : hasVacation
                              ? 'bg-blue-50 border-blue-300'
                              : hasSickLeave
                                ? 'bg-red-50 border-red-300'
                                : 'bg-purple-50 border-purple-300'
                          : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 text-center">
                      {day}
                    </div>
                    {holiday && (
                      <div className="mt-1 px-1 py-0.5 bg-green-600 text-white text-[10px] font-semibold rounded text-center truncate" title={holiday.name}>
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

                          return (
                            <div
                              key={member.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-green-50 border-green-200 hover:bg-green-100 transition-colors"
                              title={`${member.name} - ${isHalfDay ? 'Half Day' : 'Full Day'}`}
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
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No Team Data Available</p>
              <p className="text-sm">Your team members' activity will appear here once they start working</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
