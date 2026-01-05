import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Check, X, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import type { LeaveRequest, TeamMember, LeaveType, CreateLeaveRequestData } from '@/types/common'

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

export function VacationPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false)
  const [selectedVacation, setSelectedVacation] = useState<LeaveRequest | null>(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState<LeaveRequest[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [calendarFormData, setCalendarFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [requestFormData, setRequestFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    autoApprove: false,
  })
  const [editFormData, setEditFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    status: '',
  })
  const queryClient = useQueryClient()

  // Fetch leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: api.getLeaveRequests,
  })

  // Fetch team members
  const { data: teamMembers = [], isLoading: isLoadingTeamMembers, error: teamMembersError } = useQuery({
    queryKey: ['vacationEmployees'],
    queryFn: api.getVacationEmployees,
  })

  // Fetch leave types
  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes, error: leaveTypesError } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: api.getLeaveTypes,
  })

  // Mutations for leave request actions
  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.approveLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to approve request: ${errorMessage}`)
    },
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.denyLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to deny request: ${errorMessage}`)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.cancelLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to cancel request: ${errorMessage}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to delete request: ${errorMessage}`)
    },
  })

  // Create leave request mutation (for calendar)
  const createLeaveMutation = useMutation({
    mutationFn: async (data: CreateLeaveRequestData & { autoApprove?: boolean }) => {
      // Use the new admin auto-approve endpoint
      return fetch('/api/vacation/admin/create-and-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: parseInt(data.employeeId),
          leaveTypeId: parseInt(data.leaveTypeId),
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason || null,
          autoApprove: true,
        }),
      }).then(r => r.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      setShowCalendarModal(false)
      setCalendarFormData({
        employeeId: '',
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '',
      })
    },
  })

  // Create leave request mutation (for admin request form)
  const createRequestMutation = useMutation({
    mutationFn: async (data: CreateLeaveRequestData & { autoApprove?: boolean }) => {
      const endpoint = data.autoApprove
        ? '/api/vacation/admin/create-and-approve'
        : '/api/vacation/requests'

      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: parseInt(data.employeeId),
          leaveTypeId: parseInt(data.leaveTypeId),
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason || null,
          autoApprove: data.autoApprove,
        }),
      }).then(r => r.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      setShowRequestModal(false)
      setRequestFormData({
        employeeId: '',
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '',
        autoApprove: false,
      })
    },
  })

  // Update leave request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.updateLeaveRequest(data.id, {
        employeeId: parseInt(data.employeeId),
        leaveTypeId: parseInt(data.leaveTypeId),
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      setShowEditModal(false)
      setSelectedVacation(null)
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to update request: ${errorMessage}`)
    },
  })

  const handleDateClick = (date: string) => {
    setCalendarFormData({
      ...calendarFormData,
      startDate: date,
      endDate: date,
    })
    setShowCalendarModal(true)
  }

  const handleShowDayDetails = (date: Date, events: any[]) => {
    setSelectedDate(format(date, 'MMMM d, yyyy'))
    setSelectedDayEvents(events)
    setShowDayDetailsModal(true)
  }

  const handleAddLeave = async () => {
    if (!calendarFormData.employeeId || !calendarFormData.leaveTypeId) {
      alert('Please select employee and leave type')
      return
    }
    createLeaveMutation.mutate(calendarFormData)
  }

  const handleAddRequest = async () => {
    if (!requestFormData.employeeId || !requestFormData.leaveTypeId) {
      alert('Please select employee and leave type')
      return
    }
    if (!requestFormData.startDate || !requestFormData.endDate) {
      alert('Please select start and end dates')
      return
    }
    createRequestMutation.mutate(requestFormData)
  }

  const handleApprove = (requestId: string) => {
    approveMutation.mutate({ id: requestId })
  }

  const handleDeny = (requestId: string) => {
    denyMutation.mutate({ id: requestId, reason: 'Denied by admin' })
  }

  const handleCancel = (requestId: string) => {
    cancelMutation.mutate({ id: requestId, reason: 'Canceled by admin' })
  }

  const handleDelete = (requestId: string, employeeName: string) => {
    const firstConfirm = window.confirm(
      `Are you sure you want to permanently delete this leave request for ${employeeName}?`
    )

    if (firstConfirm) {
      const secondConfirm = window.confirm(
        'This action cannot be undone. Delete this request permanently?'
      )

      if (secondConfirm) {
        deleteMutation.mutate(requestId)
      }
    }
  }

  const handleVacationClick = (item: LeaveRequest) => {
    const request = item.request || item
    const employee = item.employee
    const leaveType = item.leaveType

    setSelectedVacation(item)
    setEditFormData({
      employeeId: employee?.id?.toString() || '',
      leaveTypeId: leaveType?.id?.toString() || '',
      startDate: request.startDate || '',
      endDate: request.endDate || '',
      reason: request.reason || '',
      status: request.status || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateVacation = () => {
    if (!selectedVacation) return

    const request = selectedVacation.request || selectedVacation

    if (!editFormData.employeeId || !editFormData.leaveTypeId) {
      alert('Please select employee and leave type')
      return
    }
    if (!editFormData.startDate || !editFormData.endDate) {
      alert('Please select start and end dates')
      return
    }

    updateRequestMutation.mutate({
      id: request.id,
      ...editFormData,
    })
  }

  const filteredRequests = leaveRequests?.filter((item: LeaveRequest) => {
    const request = item.request || item
    const employee = item.employee
    const leaveType = item.leaveType

    const matchesSearch = !searchTerm ||
      employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leaveType?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request?.reason?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || request?.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  // Count pending requests
  const pendingCount = leaveRequests?.filter((item: LeaveRequest) => {
    const request = item.request || item
    return request?.status === 'pending'
  }).length || 0

  // Filter requests for calendar display (approved and pending)
  const calendarRequests = leaveRequests.filter((item: LeaveRequest) => {
    const request = item.request || item
    return request?.status === 'approved' || request?.status === 'pending'
  })

  // Calculate summary statistics for future approved requests
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const futureApprovedRequests = leaveRequests.filter((item: LeaveRequest) => {
    const request = item.request || item
    const endDate = new Date(request.endDate)
    return request?.status === 'approved' && endDate >= today
  })

  const summaryStats = futureApprovedRequests.reduce(
    (acc: Record<string, LeaveRequest[]>, item: LeaveRequest) => {
      const leaveType = item.leaveType
      const request = item.request || item
      const days = parseFloat(request.daysCount || 0)

      if (leaveType?.name === 'Vacation') {
        acc.vacation += days
      } else if (leaveType?.name === 'Sick Leave') {
        acc.sickLeave += days
      } else {
        acc.other += days
      }

      return acc
    },
    { vacation: 0, sickLeave: 0, other: 0 }
  )

  // Get calendar day events
  const getCalendarDayEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return calendarRequests.filter((item: LeaveRequest) => {
      const request = item.request || item
      if (!request.startDate || !request.endDate) return false

      const start = new Date(request.startDate)
      const end = new Date(request.endDate)
      const current = new Date(dateStr)
      return start <= current && current <= end
    })
  }

  // Get working team members for a specific date
  const getWorkingTeamMembersForDate = (date: Date) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[date.getDay()]

    // Check if it's a public holiday - no one works on public holidays
    if (isPublicHoliday(date)) {
      return []
    }

    // Get employees on vacation/sick leave on this date
    const vacationsOnDate = getCalendarDayEvents(date)
    const vacationingEmployeeIds = vacationsOnDate
      .filter((item: any) => {
        const request = item.request || item
        return request.status === 'approved'
      })
      .map((item: any) => item.employee?.id)

    return teamMembers.filter((member: any) => {
      // Skip if on approved vacation or sick leave
      if (vacationingEmployeeIds.includes(member.id)) {
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

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  // Get the day of week for the first day of the month (0 = Sunday, 6 = Saturday)
  const firstDayOfMonth = startOfMonth(currentMonth).getDay()

  // Create empty slots for days before the month starts
  const emptyDays = Array(firstDayOfMonth).fill(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Vacation & Leave Management</h1>
        <Button size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="requests">
            <span className="flex items-center gap-2">
              Requests
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by employee, type, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowRequestModal(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Request
              </Button>
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('pending')}
                size="sm"
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('approved')}
                size="sm"
              >
                Approved
              </Button>
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((item: LeaveRequest) => {
              const request = item.request || item
              const employee = item.employee
              const leaveType = item.leaveType

              const getStatusBadge = (status: string) => {
                const styles = {
                  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                  approved: 'bg-green-100 text-green-800 border-green-300',
                  denied: 'bg-red-100 text-red-800 border-red-300',
                  canceled: 'bg-gray-100 text-gray-800 border-gray-300',
                }
                return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-300'
              }

              return (
                <Card key={request.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      {/* Employee Info */}
                      <div className="flex items-center space-x-4 min-w-[200px]">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={employee?.avatarUrl} alt={employee?.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {employee?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium text-gray-900">{employee?.name || 'Unknown'}</h4>
                          <p className="text-sm text-gray-600">{leaveType?.name || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        <span className={cn(
                          'px-3 py-1 text-xs font-semibold rounded-full border capitalize',
                          getStatusBadge(request.status)
                        )}>
                          {request.status}
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="text-right flex-1">
                        <p className="text-sm text-gray-600">
                          {request.startDate && formatDate(request.startDate)} - {request.endDate && formatDate(request.endDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.daysCount} {parseFloat(request.daysCount) === 1 ? 'day' : 'days'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        {request.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={approveMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeny(request.id)}
                              disabled={denyMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Deny
                            </Button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(request.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {(request.status === 'denied' || request.status === 'canceled') && (
                          <span className="text-sm text-gray-500 italic px-4">No actions available</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(request.id, employee?.name || 'this employee')}
                          disabled={deleteMutation.isPending}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            
            {filteredRequests.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Clock className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p className="text-gray-500">No leave requests found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Calendar Tab (with Summary) */}
        <TabsContent value="calendar" className="space-y-6">
          {/* Summary Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Management Summary</CardTitle>
              <CardDescription>Approved leave days from today onwards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Total Vacation Days</p>
                    <p className="text-lg font-bold text-blue-900">
                      {summaryStats.vacation > 0
                        ? Number.isInteger(summaryStats.vacation)
                          ? summaryStats.vacation
                          : summaryStats.vacation.toFixed(1)
                        : '0'}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {futureApprovedRequests.filter((item: any) => item.leaveType?.name === 'Vacation').length} requests
                    </p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-red-900">Total Sick Leave Days</p>
                    <p className="text-lg font-bold text-red-900">
                      {summaryStats.sickLeave > 0
                        ? Number.isInteger(summaryStats.sickLeave)
                          ? summaryStats.sickLeave
                          : summaryStats.sickLeave.toFixed(1)
                        : '0'}
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {futureApprovedRequests.filter((item: any) => item.leaveType?.name === 'Sick Leave').length} requests
                    </p>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Total Other Leave Days</p>
                    <p className="text-lg font-bold text-yellow-900">
                      {summaryStats.other > 0
                        ? Number.isInteger(summaryStats.other)
                          ? summaryStats.other
                          : summaryStats.other.toFixed(1)
                        : '0'}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {futureApprovedRequests.filter((item: any) => {
                        const name = item.leaveType?.name
                        return name !== 'Vacation' && name !== 'Sick Leave'
                      }).length} requests
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Calendar View</CardTitle>
                  <CardDescription>Click on any date to add vacation or sick leave</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold text-gray-900 min-w-[150px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex gap-6 flex-wrap items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-sm">Vacation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-sm">Sick Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-sm">Other</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-sm">Public Holiday</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded border-2 border-dashed border-yellow-300 opacity-75"></div>
                    <span className="text-sm font-medium text-yellow-700">Pending Approval</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 border rounded-lg p-4 bg-white">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600 py-2 text-sm">
                      {day}
                    </div>
                  ))}

                  {/* Empty slots for days before month starts */}
                  {emptyDays.map((_, index) => (
                    <div key={`empty-${index}`} className="min-h-28 p-2"></div>
                  ))}

                  {/* Calendar days */}
                  {calendarDays.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const dayEvents = getCalendarDayEvents(date)
                    const workingMembers = getWorkingTeamMembersForDate(date)
                    const isCurrentMonth = isSameMonth(date, currentMonth)
                    const isTodayDate = isToday(date)
                    const holiday = isPublicHoliday(date)

                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          'min-h-28 p-2 border rounded-lg transition-all duration-200 text-left relative',
                          holiday
                            ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-400'
                            : isCurrentMonth
                              ? isTodayDate
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-gray-200'
                              : 'bg-gray-50 border-gray-100 opacity-50'
                        )}
                      >
                        {/* Date and Add Button */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-sm text-gray-600">
                            {format(date, 'd')}
                          </div>
                          <button
                            onClick={() => handleDateClick(dateStr)}
                            type="button"
                            className="w-5 h-5 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                            title="Add leave request"
                          >
                            <Plus className="w-3 h-3 text-primary" />
                          </button>
                        </div>

                        {/* Public Holiday Badge */}
                        {holiday && (
                          <div className="mb-1 px-1.5 py-1 bg-green-600 text-white text-[10px] font-semibold rounded text-center" title={holiday.name}>
                            {holiday.name}
                          </div>
                        )}

                        {/* Vacation Entries */}
                        <div className="space-y-1 text-xs">
                          {dayEvents.slice(0, 2).map((item: any, i: number) => {
                            const employee = item.employee
                            const leaveType = item.leaveType
                            const request = item.request || item
                            const isPending = request?.status === 'pending'

                            // Get avatar initials fallback
                            const getInitials = (name?: string) => {
                              if (!name) return "?"
                              return name
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            }

                            return (
                              <button
                                key={i}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVacationClick(item)
                                }}
                                type="button"
                                className={cn(
                                  'w-full px-2 py-1 rounded text-white truncate text-left hover:opacity-80 transition-all relative',
                                  isPending && 'border-2 border-dashed border-yellow-300 opacity-75 animate-pulse',
                                  leaveType?.name === 'Vacation'
                                    ? 'bg-blue-500'
                                    : leaveType?.name === 'Sick Leave'
                                    ? 'bg-red-500'
                                    : 'bg-yellow-500'
                                )}
                                title={`${employee?.name || 'Unknown'} - ${leaveType?.name || 'N/A'}${isPending ? ' (PENDING)' : ''} (click to edit)`}
                              >
                                <span className="flex items-center justify-between gap-1">
                                  <span className="flex items-center gap-2 truncate">
                                    <Avatar className="h-6 w-6 border border-gray-200 mr-1 shrink-0">
                                      <AvatarImage src={employee?.avatarUrl} alt={employee?.name || "Avatar"} />
                                      <AvatarFallback className="bg-gray-100 text-gray-700 font-semibold text-xs">
                                        {getInitials(employee?.name || 'U')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{employee?.name || 'Unknown'}</span>
                                  </span>
                                  {isPending && (
                                    <span className="flex-shrink-0 text-[10px] bg-yellow-400 text-yellow-900 px-1 rounded font-bold">
                                      PENDING
                                    </span>
                                  )}
                                </span>
                              </button>
                            )
                          })}
                          {dayEvents.length > 2 && (
                            <button
                              onClick={() => handleShowDayDetails(date, dayEvents)}
                              type="button"
                              className="w-full px-2 py-1 text-gray-600 hover:text-primary hover:bg-gray-100 text-xs rounded transition-colors cursor-pointer font-medium"
                            >
                              +{dayEvents.length - 2} more
                            </button>
                          )}

                          {/* Working Team Members */}
                          {workingMembers.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {workingMembers.slice(0, 2).map((member: TeamMember) => {
                                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                                const dayName = dayNames[date.getDay()]
                                const isHalfDay = member.workSchedule?.[dayName] === 'half'

                                return (
                                  <div
                                    key={member.id}
                                    className="flex items-center gap-1.5 px-1.5 py-1 rounded border bg-green-50 border-green-200 hover:bg-green-100 transition-colors"
                                    title={`${member.name} - ${isHalfDay ? 'Half Day' : 'Full Day'}`}
                                  >
                                    <Avatar className="h-5 w-5 border border-green-300 flex-shrink-0">
                                      <AvatarImage src={member.avatarUrl} alt={member.name || 'Team Member'} />
                                      <AvatarFallback className="text-[8px] font-bold bg-green-200 text-green-900">
                                        {member.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] font-semibold text-green-900 truncate">
                                        {member.name}
                                      </div>
                                    </div>
                                    {isHalfDay && (
                                      <span className="text-[8px] font-bold text-green-700 bg-green-200 px-1 py-0.5 rounded flex-shrink-0">
                                        ½
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                              {workingMembers.length > 2 && (
                                <div className="text-[10px] text-gray-700 font-semibold bg-gray-100 rounded px-1.5 py-1 text-center border border-gray-200">
                                  +{workingMembers.length - 2} more working
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Calendar Add Leave Modal */}
      {showCalendarModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCalendarModal(false)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Add Leave Request</CardTitle>
              <CardDescription>Select date and team member to add leave</CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible">
              <div className="space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Team Member *</label>
                  <select
                    value={calendarFormData.employeeId}
                    onChange={(e) => setCalendarFormData({ ...calendarFormData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingTeamMembers}
                  >
                    <option value="">
                      {isLoadingTeamMembers
                        ? 'Loading team members...'
                        : teamMembersError
                        ? 'Error loading team members'
                        : teamMembers.length === 0
                        ? 'No team members found'
                        : 'Select team member'}
                    </option>
                    {teamMembers.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                  </select>
                  {teamMembersError && (
                    <p className="text-red-500 text-xs mt-1">
                      Error: {teamMembersError.message || 'Failed to load team members'}
                    </p>
                  )}
                  {!isLoadingTeamMembers && teamMembers.length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">
                      No active team members found. Please add team members first.
                    </p>
                  )}
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Leave Type *</label>
                  <select
                    value={calendarFormData.leaveTypeId}
                    onChange={(e) => setCalendarFormData({ ...calendarFormData, leaveTypeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingLeaveTypes}
                  >
                    <option value="">
                      {isLoadingLeaveTypes
                        ? 'Loading leave types...'
                        : leaveTypesError
                        ? 'Error loading leave types'
                        : leaveTypes.length === 0
                        ? 'No leave types found'
                        : 'Select leave type'}
                    </option>
                    {leaveTypes.map((type: any) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  {leaveTypesError && (
                    <p className="text-red-500 text-xs mt-1">
                      Error: {leaveTypesError.message || 'Failed to load leave types'}
                    </p>
                  )}
                  {!isLoadingLeaveTypes && leaveTypes.length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">
                      No leave types configured. Please add leave types first.
                    </p>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Date *</label>
                    <Input
                      type="date"
                      value={calendarFormData.startDate}
                      onChange={(e) => setCalendarFormData({ ...calendarFormData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">End Date *</label>
                    <Input
                      type="date"
                      value={calendarFormData.endDate}
                      onChange={(e) => setCalendarFormData({ ...calendarFormData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium mb-2">Reason (optional)</label>
                  <Input
                    placeholder="Reason for leave"
                    value={calendarFormData.reason}
                    onChange={(e) => setCalendarFormData({ ...calendarFormData, reason: e.target.value })}
                  />
                </div>

                {/* Note about auto-approval */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✓ This request will be automatically approved
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCalendarModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddLeave}
                    disabled={createLeaveMutation.isPending}
                    className="flex-1"
                  >
                    {createLeaveMutation.isPending ? 'Adding...' : 'Add Leave'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Add Request Modal */}
      {showRequestModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRequestModal(false)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Add Leave Request</CardTitle>
              <CardDescription>Create a new leave request for a team member</CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible">
              <div className="space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Team Member *</label>
                  <select
                    value={requestFormData.employeeId}
                    onChange={(e) => setRequestFormData({ ...requestFormData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingTeamMembers}
                  >
                    <option value="">
                      {isLoadingTeamMembers
                        ? 'Loading team members...'
                        : teamMembersError
                        ? 'Error loading team members'
                        : teamMembers.length === 0
                        ? 'No team members found'
                        : 'Select team member'}
                    </option>
                    {teamMembers.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                  {teamMembersError && (
                    <p className="text-red-500 text-xs mt-1">
                      Error: {teamMembersError.message || 'Failed to load team members'}
                    </p>
                  )}
                  {!isLoadingTeamMembers && teamMembers.length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">
                      No active team members found. Please add team members first.
                    </p>
                  )}
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Leave Type *</label>
                  <select
                    value={requestFormData.leaveTypeId}
                    onChange={(e) => setRequestFormData({ ...requestFormData, leaveTypeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingLeaveTypes}
                  >
                    <option value="">
                      {isLoadingLeaveTypes
                        ? 'Loading leave types...'
                        : leaveTypesError
                        ? 'Error loading leave types'
                        : leaveTypes.length === 0
                        ? 'No leave types found'
                        : 'Select leave type'}
                    </option>
                    {leaveTypes.map((type: any) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  {leaveTypesError && (
                    <p className="text-red-500 text-xs mt-1">
                      Error: {leaveTypesError.message || 'Failed to load leave types'}
                    </p>
                  )}
                  {!isLoadingLeaveTypes && leaveTypes.length === 0 && (
                    <p className="text-yellow-600 text-xs mt-1">
                      No leave types configured. Please add leave types first.
                    </p>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Date *</label>
                    <Input
                      type="date"
                      value={requestFormData.startDate}
                      onChange={(e) => setRequestFormData({ ...requestFormData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">End Date *</label>
                    <Input
                      type="date"
                      value={requestFormData.endDate}
                      onChange={(e) => setRequestFormData({ ...requestFormData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium mb-2">Reason (optional)</label>
                  <Input
                    placeholder="Reason for leave"
                    value={requestFormData.reason}
                    onChange={(e) => setRequestFormData({ ...requestFormData, reason: e.target.value })}
                  />
                </div>

                {/* Auto-approve checkbox */}
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                  <input
                    type="checkbox"
                    id="autoApprove"
                    checked={requestFormData.autoApprove}
                    onChange={(e) => setRequestFormData({ ...requestFormData, autoApprove: e.target.checked })}
                    className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  <label htmlFor="autoApprove" className="text-sm font-medium cursor-pointer">
                    Automatically approve this request
                  </label>
                </div>

                {/* Status message */}
                {requestFormData.autoApprove ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      ✓ This request will be automatically approved
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      ℹ This request will be created as pending and require manual approval
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRequest}
                    disabled={createRequestMutation.isPending}
                    className="flex-1"
                  >
                    {createRequestMutation.isPending ? 'Creating...' : 'Create Request'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Vacation Modal */}
      {showEditModal && selectedVacation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Edit Leave Request</CardTitle>
              <CardDescription>
                Update leave request details for {selectedVacation.employee?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible">
              <div className="space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Team Member *</label>
                  <select
                    value={editFormData.employeeId}
                    onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingTeamMembers}
                  >
                    <option value="">Select team member</option>
                    {teamMembers.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Leave Type *</label>
                  <select
                    value={editFormData.leaveTypeId}
                    onChange={(e) => setEditFormData({ ...editFormData, leaveTypeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isLoadingLeaveTypes}
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((type: any) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Date *</label>
                    <Input
                      type="date"
                      value={editFormData.startDate}
                      onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">End Date *</label>
                    <Input
                      type="date"
                      value={editFormData.endDate}
                      onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium mb-2">Reason (optional)</label>
                  <Input
                    placeholder="Reason for leave"
                    value={editFormData.reason}
                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  />
                </div>

                {/* Status Badge */}
                <div>
                  <label className="block text-sm font-medium mb-2">Current Status</label>
                  <div className={cn(
                    'inline-flex px-3 py-1 text-xs font-semibold rounded-full border capitalize',
                    editFormData.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    editFormData.status === 'approved' ? 'bg-green-100 text-green-800 border-green-300' :
                    editFormData.status === 'denied' ? 'bg-red-100 text-red-800 border-red-300' :
                    'bg-gray-100 text-gray-800 border-gray-300'
                  )}>
                    {editFormData.status}
                  </div>
                </div>

                {/* Quick Actions */}
                {editFormData.status === 'pending' && (
                  <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border">
                    <Button
                      size="sm"
                      onClick={() => {
                        handleApprove((selectedVacation.request || selectedVacation).id)
                        setShowEditModal(false)
                      }}
                      className="bg-green-600 hover:bg-green-700 flex-1"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        handleDeny((selectedVacation.request || selectedVacation).id)
                        setShowEditModal(false)
                      }}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateVacation}
                    disabled={updateRequestMutation.isPending}
                    className="flex-1"
                  >
                    {updateRequestMutation.isPending ? 'Updating...' : 'Update Request'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Day Details Modal - Show all leave requests for a specific day */}
      {showDayDetailsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDayDetailsModal(false)}
        >
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Leave Requests on {selectedDate}</CardTitle>
              <CardDescription>
                {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'person' : 'people'} on leave
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {selectedDayEvents.map((item: LeaveRequest, index: number) => {
                  const employee = item.employee
                  const leaveType = item.leaveType
                  const request = item.request || item
                  const isPending = request?.status === 'pending'

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        handleVacationClick(item)
                        setShowDayDetailsModal(false)
                      }}
                      type="button"
                      className={cn(
                        'w-full p-4 rounded-lg border-2 transition-all text-left hover:shadow-md',
                        isPending && 'border-dashed border-yellow-300 bg-yellow-50',
                        leaveType?.name === 'Vacation' && !isPending
                          ? 'border-blue-200 bg-blue-50 hover:border-blue-300'
                          : leaveType?.name === 'Sick Leave' && !isPending
                          ? 'border-red-200 bg-red-50 hover:border-red-300'
                          : !isPending && 'border-yellow-200 bg-yellow-50 hover:border-yellow-300'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={employee?.avatarUrl} alt={employee?.name} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {employee?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{employee?.name || 'Unknown'}</h4>
                              {isPending && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold text-yellow-900 bg-yellow-400 rounded-full animate-pulse">
                                  PENDING
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                'text-sm font-medium',
                                leaveType?.name === 'Vacation' ? 'text-blue-700' :
                                leaveType?.name === 'Sick Leave' ? 'text-red-700' : 'text-yellow-700'
                              )}>
                                {leaveType?.name || 'N/A'}
                              </span>
                              <span className="text-sm text-gray-600">
                                {request.daysCount} {parseFloat(request.daysCount) === 1 ? 'day' : 'days'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            </p>
                            {request.reason && (
                              <p className="text-xs text-gray-600 mt-1 italic">"{request.reason}"</p>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          'text-xs font-semibold px-2 py-1 rounded',
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'denied' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        )}>
                          {request.status}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDayDetailsModal(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}