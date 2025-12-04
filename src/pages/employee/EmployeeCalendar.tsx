import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isSameDay,
  parseISO
} from 'date-fns'

interface LeaveRequest {
  id: number
  leaveTypeName: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason?: string
}

export function EmployeeCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaveRequests()
  }, [])

  const loadLeaveRequests = async () => {
    try {
      setLoading(true)

      // Get current user info
      const userResponse = await fetch('/api/user', { credentials: 'include' })
      if (!userResponse.ok) throw new Error('Failed to fetch user')
      const userData = await userResponse.json()

      // Get team member by email
      const teamResponse = await fetch('/api/admin/team-members', { credentials: 'include' })
      if (!teamResponse.ok) throw new Error('Failed to fetch team member')
      const teamData = await teamResponse.json()
      const member = teamData.find((tm: any) => tm.email === userData.email)

      if (!member) {
        console.error('Team member not found')
        return
      }

      // Load leave requests
      const requestsResponse = await fetch(`/api/vacation/requests?employeeId=${member.id}`, {
        credentials: 'include',
      })
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setLeaveRequests(requestsData)
      }
    } catch (error) {
      console.error('Error loading leave requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const emptyDays = Array(firstDayOfMonth).fill(null)

  const getLeaveForDay = (day: Date) => {
    return leaveRequests.filter(request => {
      const startDate = parseISO(request.startDate)
      const endDate = parseISO(request.endDate)
      return day >= startDate && day <= endDate && request.status === 'approved'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500'
      case 'pending':
        return 'bg-yellow-500'
      case 'denied':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Calendar</h1>
        <p className="text-gray-500 mt-1">View your approved leave schedule</p>
      </div>

      {/* Calendar Legend */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm text-gray-700">Vacation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm text-gray-700">Sick Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-sm text-gray-700">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-700 py-2">
                {day}
              </div>
            ))}

            {/* Empty cells before month starts */}
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="min-h-24 p-2"></div>
            ))}

            {/* Calendar days */}
            {daysInMonth.map(day => {
              const dayLeave = getLeaveForDay(day)
              const hasLeave = dayLeave.length > 0
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 p-2 border border-gray-200 rounded-lg ${
                    isCurrentDay ? 'border-blue-500 border-2' : ''
                  } ${hasLeave ? 'bg-gradient-to-br from-green-50 to-green-100' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isCurrentDay
                          ? 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                          : hasLeave
                          ? 'text-green-900'
                          : 'text-gray-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {dayLeave.length > 0 && (
                    <div className="space-y-1">
                      {dayLeave.map(leave => (
                        <div
                          key={leave.id}
                          className={`text-xs px-2 py-1 rounded truncate text-white ${
                            leave.leaveTypeName === 'Vacation' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          title={leave.leaveTypeName}
                        >
                          {leave.leaveTypeName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Leave */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>Upcoming Leave</CardTitle>
          <CardDescription>Your approved leave in the next 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequests.filter(req => {
            const startDate = parseISO(req.startDate)
            const today = new Date()
            const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
            return req.status === 'approved' && startDate >= today && startDate <= ninetyDaysFromNow
          }).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming leave scheduled</p>
          ) : (
            <div className="space-y-3">
              {leaveRequests
                .filter(req => {
                  const startDate = parseISO(req.startDate)
                  const today = new Date()
                  const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
                  return req.status === 'approved' && startDate >= today && startDate <= ninetyDaysFromNow
                })
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.leaveTypeName}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {format(parseISO(request.startDate), 'MMM d, yyyy')} -{' '}
                        {format(parseISO(request.endDate), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {request.totalDays} {request.totalDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Approved</Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
