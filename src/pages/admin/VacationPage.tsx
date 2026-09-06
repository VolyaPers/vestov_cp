import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Check, X, Search, ChevronLeft, ChevronRight, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import { convertTime, getBrowserTimezone, getTimezoneAbbreviation } from '@/lib/timezone'
import type { TeamMember, LeaveType, CreateLeaveRequestData, Client } from '@/types/common'
import type { LeaveRequestWithNested } from '@/types/vacation'

type LeaveRequest = LeaveRequestWithNested

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
  const { showAlert, showConfirm } = useCustomAlert()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const [selectedClientId, setSelectedClientId] = useState('all')
  const [selectedCalendarMemberIds, setSelectedCalendarMemberIds] = useState<string[]>([])
  const [isTeamMemberFilterOpen, setIsTeamMemberFilterOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false)
  const [selectedVacation, setSelectedVacation] = useState<LeaveRequest | null>(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState<LeaveRequest[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showAllMembersModal, setShowAllMembersModal] = useState(false)
  const [allMembersModalWorking, setAllMembersModalWorking] = useState<any[]>([])
  const [allMembersModalLeaves, setAllMembersModalLeaves] = useState<any[]>([])
  const [allMembersModalDate, setAllMembersModalDate] = useState<Date | null>(null)
  const [allMembersSearch, setAllMembersSearch] = useState('')
  const [calendarFormData, setCalendarFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '', halfDayStart: false, halfDayEnd: false,
  })
  const [requestFormData, setRequestFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '', halfDayStart: false, halfDayEnd: false,
    autoApprove: false,
  })
  const [editFormData, setEditFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '', halfDayStart: false, halfDayEnd: false,
    status: '',
  })
  const queryClient = useQueryClient()
  const teamMemberFilterRef = useRef<HTMLDivElement | null>(null)

  const selectedClientNumericId = selectedClientId === 'all' ? undefined : Number(selectedClientId)

  // Fetch leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leaveRequests', selectedClientNumericId ?? 'all'],
    queryFn: () => api.getLeaveRequests({ clientId: selectedClientNumericId }),
  })

  // Fetch team members
  const { data: teamMembers = [], isLoading: isLoadingTeamMembers, error: teamMembersError } = useQuery({
    queryKey: ['vacationEmployees', selectedClientNumericId ?? 'all'],
    queryFn: () => api.getVacationEmployees(selectedClientNumericId),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  })

  // Fetch leave types
  const { data: leaveTypes = [], isLoading: isLoadingLeaveTypes, error: leaveTypesError } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: api.getLeaveTypes,
  })

  // Fetch current user for timezone
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })

  // Fetch all preferred shifts for calendar display
  const { data: preferredShiftsData } = useQuery({
    queryKey: ['allPreferredShifts'],
    queryFn: () => api.getAllPreferredShifts(),
  })

  // Fetch all shift overrides for the current month
  const currentMonthStr = format(currentMonth, 'yyyy-MM')
  const { data: overridesData } = useQuery({
    queryKey: ['allShiftOverrides', currentMonthStr],
    queryFn: () => api.getAllShiftOverrides(currentMonthStr),
  })

  const { data: effectiveCalendar, isLoading: calendarLoading, error: calendarError } = useQuery<{ members: Array<{ employee: { id: number }; days: any[] }> }>({
    queryKey: ['adminEffectiveCalendar', currentMonthStr, selectedClientNumericId ?? 'all'],
    queryFn: () => api.request(`/shifts/calendar/all?month=${currentMonthStr}${selectedClientNumericId ? `&clientId=${selectedClientNumericId}` : ''}`),
  })
  const viewerTimezone = currentUser?.timezone || getBrowserTimezone()

  const projectClients = useMemo(() => {
    return clients.filter((client: Client) =>
      client.services?.some(service =>
        service.isActive &&
        (service.serviceCategory === 'outsourcing' || service.serviceCategory === 'outstaffing')
      )
    )
  }, [clients])

  const matchesCalendarMemberFilter = (memberId?: number | null) => {
    if (selectedCalendarMemberIds.length === 0) {
      return true
    }

    return memberId !== undefined && memberId !== null && selectedCalendarMemberIds.includes(String(memberId))
  }

  const calendarMemberFilterLabel = useMemo(() => {
    if (selectedCalendarMemberIds.length === 0) {
      return 'All team members'
    }

    if (selectedCalendarMemberIds.length === 1) {
      const selectedMember = teamMembers.find((member: TeamMember) => String(member.id) === selectedCalendarMemberIds[0])
      return selectedMember?.name || '1 team member'
    }

    return `${selectedCalendarMemberIds.length} team members`
  }, [selectedCalendarMemberIds, teamMembers])

  useEffect(() => {
    setSelectedCalendarMemberIds((previousIds) =>
      previousIds.filter((memberId) => teamMembers.some((member: TeamMember) => String(member.id) === memberId))
    )
  }, [teamMembers])

  useEffect(() => {
    if (!isTeamMemberFilterOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!teamMemberFilterRef.current?.contains(event.target as Node)) {
        setIsTeamMemberFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isTeamMemberFilterOpen])

  // Helper: get shift time for a member on a specific date
  const getShiftTimeForMember = (memberId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')

    const day = effectiveCalendar?.members.find(m => m.employee.id === memberId)?.days.find(d => d.date === dateStr)
    if (!day) return null
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: viewerTimezone, hour: '2-digit', minute: '2-digit' })
    const start = day.expectedStartAt || day.startAt
    const end = day.endAt && day.absenceUnits === 0.5 && day.expectedStartAt === day.startAt ? new Date(Date.parse(day.startAt) + day.workingMinutes * 60000).toISOString() : day.endAt
    return { isDayOff: day.isDayOff, isOverride: day.isOverride, startTime: start ? formatter.format(new Date(start)) : '', endTime: end ? formatter.format(new Date(end)) : '', memberTz: day.timezone, abbreviation: start ? getTimezoneAbbreviation(viewerTimezone, new Date(start)) : '', workingMinutes: day.workingMinutes, absenceUnits: day.absenceUnits }
  }

  // Mutations for leave request actions
  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.approveLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      queryClient.invalidateQueries({ queryKey: ['myVacationBalance'] })
      queryClient.invalidateQueries({ queryKey: ['employeeVacationBalance'] })
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['myVacationBalance'] })
      queryClient.refetchQueries({ queryKey: ['employeeVacationBalance'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert({ message: `Failed to approve request: ${errorMessage}`, type: 'error' })
    },
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.denyLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      queryClient.invalidateQueries({ queryKey: ['myVacationBalance'] })
      queryClient.invalidateQueries({ queryKey: ['employeeVacationBalance'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert({ message: `Failed to deny request: ${errorMessage}`, type: 'error' })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.cancelLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      queryClient.invalidateQueries({ queryKey: ['myVacationBalance'] })
      queryClient.invalidateQueries({ queryKey: ['employeeVacationBalance'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert({ message: `Failed to cancel request: ${errorMessage}`, type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert({ message: `Failed to archive request: ${errorMessage}`, type: 'error' })
    },
  })

  // Create leave request mutation (for calendar)
  const createLeaveMutation = useMutation({
    mutationFn: async (data: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason: string; halfDayStart?: boolean; halfDayEnd?: boolean }) => {
      // Use the new admin auto-approve endpoint
      return api.request('/vacation/admin/create-and-approve', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: parseInt(data.employeeId),
          leaveTypeId: parseInt(data.leaveTypeId),
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason || null, halfDayStart: !!data.halfDayStart, halfDayEnd: !!data.halfDayEnd,
          autoApprove: true,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      queryClient.invalidateQueries({ queryKey: ['myVacationBalance'] })
      queryClient.invalidateQueries({ queryKey: ['employeeVacationBalance'] })
      setShowCalendarModal(false)
      setCalendarFormData({
        employeeId: '',
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '', halfDayStart: false, halfDayEnd: false,
      })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create leave request'
      showAlert({ message: errorMessage, type: 'error' })
    },
  })

  // Create leave request mutation (for admin request form)
  const createRequestMutation = useMutation({
    mutationFn: async (data: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason: string; halfDayStart?: boolean; halfDayEnd?: boolean; autoApprove?: boolean }) => {
      const endpoint = data.autoApprove
        ? '/api/vacation/admin/create-and-approve'
        : '/api/vacation/requests'

      return api.request(endpoint.replace('/api', ''), {
        method: 'POST',
        body: JSON.stringify({ ...data, employeeId: Number(data.employeeId), leaveTypeId: Number(data.leaveTypeId) }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      queryClient.invalidateQueries({ queryKey: ['myVacationBalance'] })
      queryClient.invalidateQueries({ queryKey: ['employeeVacationBalance'] })
      setShowRequestModal(false)
      setRequestFormData({
        employeeId: '',
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '', halfDayStart: false, halfDayEnd: false,
        autoApprove: false,
      })
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create leave request'
      showAlert({ message: errorMessage, type: 'error' })
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
        reason: data.reason || null, halfDayStart: !!data.halfDayStart, halfDayEnd: !!data.halfDayEnd,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['adminEffectiveCalendar'] })
      queryClient.invalidateQueries({ queryKey: ['sickLeaveBalance'] })
      setShowEditModal(false)
      setSelectedVacation(null)
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert({ message: `Failed to update request: ${errorMessage}`, type: 'error' })
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
    setSelectedDate(format(date, 'd MMMM yyyy'))
    setSelectedDayEvents(events)
    setShowDayDetailsModal(true)
  }

  const handleAddLeave = async () => {
    if (!calendarFormData.employeeId || !calendarFormData.leaveTypeId) {
      showAlert({ message: 'Please select employee and leave type', type: 'warning' })
      return
    }
    createLeaveMutation.mutate(calendarFormData)
  }

  const handleAddRequest = async () => {
    if (!requestFormData.employeeId || !requestFormData.leaveTypeId) {
      showAlert({ message: 'Please select employee and leave type', type: 'warning' })
      return
    }
    if (!requestFormData.startDate || !requestFormData.endDate) {
      showAlert({ message: 'Please select start and end dates', type: 'warning' })
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

  const handleDelete = async (requestId: string, employeeName: string) => {
    const confirmed = await showConfirm({
      title: 'Archive Leave Request',
      message: `Archive this leave request for ${employeeName}? The request and its audit history will be retained.`,
      type: 'warning',
      confirmText: 'Archive',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (confirmed) {
      deleteMutation.mutate(requestId)
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
      reason: request.reason || '', halfDayStart: !!request.halfDayStart, halfDayEnd: !!request.halfDayEnd,
      status: request.status || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateVacation = () => {
    if (!selectedVacation) return

    const request = selectedVacation.request || selectedVacation

    if (!editFormData.employeeId || !editFormData.leaveTypeId) {
      showAlert({ message: 'Please select employee and leave type', type: 'warning' })
      return
    }
    if (!editFormData.startDate || !editFormData.endDate) {
      showAlert({ message: 'Please select start and end dates', type: 'warning' })
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
    const employeeId = item.employee?.id ?? request.employeeId

    return matchesCalendarMemberFilter(employeeId) &&
      (request?.status === 'approved' || request?.status === 'pending')
  })

  // Calculate summary statistics for future approved requests
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const futureApprovedRequests = leaveRequests.filter((item: LeaveRequest) => {
    const request = item.request || item
    const employeeId = item.employee?.id ?? request.employeeId
    const endDate = new Date(request.endDate)
    return matchesCalendarMemberFilter(employeeId) && request?.status === 'approved' && endDate >= today
  })

  const summaryStats = futureApprovedRequests.reduce(
    (acc: { vacation: number; sickLeave: number; other: number }, item: LeaveRequest) => {
      const leaveType = item.leaveType
      const request = item.request || item
      const days = parseFloat((request as any).daysCount || '0')

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
    return teamMembers.filter((member: any) => matchesCalendarMemberFilter(member.id) && member.showOnCalendar !== false && (getShiftTimeForMember(member.id, date)?.workingMinutes || 0) > 0)
  }

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  // Get the day of week for the first day of the month (Monday-based: 0=Mon, 6=Sun)
  const firstDayOfMonth = (startOfMonth(currentMonth).getDay() + 6) % 7

  // Create empty slots for days before the month starts
  const emptyDays = Array(firstDayOfMonth).fill(null)

  const toggleCalendarMemberSelection = (memberId: string) => {
    setSelectedCalendarMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((id) => id !== memberId)
        : [...currentIds, memberId]
    )
  }

  const selectAllCalendarMembers = () => {
    setSelectedCalendarMemberIds(teamMembers.map((member: TeamMember) => String(member.id)))
  }

  return (
    <div className="space-y-6">
      {calendarError && <p role="alert" className="text-sm text-red-600">Calendar failed to load: {calendarError.message}</p>}
      {calendarLoading && <p role="status" className="text-sm text-muted-foreground">Loading work calendar…</p>}

      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Team Calendar
            </h1>
            <p className="stripe-text-secondary text-lg">
              View team schedules, shifts, and leave requests
            </p>
          </div>
        </div>
      </div>

      <div className="stripe-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Project filter</p>
            <p className="text-sm text-gray-500">
              Show only developers assigned to active services for the selected client.
            </p>
          </div>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-full lg:w-[280px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {projectClients.map((client: Client) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                title="Create a new leave request"
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
                          {(request as any).daysCount || '0'} {parseFloat((request as any).daysCount || '0') === 1 ? 'day' : 'days'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        {request.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(String(request.id))}
                              disabled={approveMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                              title="Approve this leave request"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeny(String(request.id))}
                              disabled={denyMutation.isPending}
                              title="Deny this leave request"
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
                            onClick={() => handleCancel(String(request.id))}
                            disabled={cancelMutation.isPending}
                            title="Cancel this approved leave"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {(request.status === 'denied' || request.status === 'canceled') && (
                          <span className="text-sm text-gray-500 italic px-4">History retained</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(String(request.id), employee?.name || 'this employee')}
                          disabled={deleteMutation.isPending || request.status === 'approved'}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          title={request.status === 'approved' ? 'Cancel this approved leave before archiving' : 'Archive this leave request'}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Archive
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-gray-600">
              Narrow the calendar to specific team members without changing the requests list.
            </p>
            <div ref={teamMemberFilterRef} className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTeamMemberFilterOpen((isOpen) => !isOpen)}
                className="w-full justify-between gap-3 lg:w-[260px]"
              >
                <span className="truncate">{calendarMemberFilterLabel}</span>
                <Users className="h-4 w-4 text-gray-500" />
              </Button>

              {isTeamMemberFilterOpen && (
                <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Team members</p>
                      <p className="text-xs text-gray-500">
                        {selectedCalendarMemberIds.length === 0
                          ? 'All visible in calendar'
                          : `${selectedCalendarMemberIds.length} selected`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarMemberIds([])}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {teamMembers.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-gray-500">No team members available for this filter.</p>
                    ) : (
                      teamMembers.map((member: TeamMember) => {
                        const isChecked = selectedCalendarMemberIds.includes(String(member.id))

                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleCalendarMemberSelection(String(member.id))}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCalendarMemberSelection(String(member.id))}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatarUrl} alt={member.name} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {member.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'TM'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{member.name}</p>
                              <p className="truncate text-xs text-gray-500">{member.position || member.email}</p>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>

                  {teamMembers.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={selectAllCalendarMembers}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTeamMemberFilterOpen(false)}
                        className="text-xs font-medium text-gray-600 hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

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
                    title="Previous month"
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
                    title="Next month"
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
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
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
                                title={`${employee?.name || 'Unknown'} - ${leaveType?.name || 'N/A'}${isPending ? ' (PENDING)' : ''}${request.halfDayStart || request.halfDayEnd ? ' · ½ day boundary' : ''} (click to edit)`}
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
                                const isHalfDay = (getShiftTimeForMember(member.id, date)?.absenceUnits || 0) === 0.5
                                const shiftInfo = getShiftTimeForMember(member.id, date)

                                return (
                                  <div
                                    key={member.id}
                                    className={cn(
                                      "flex items-center gap-1.5 px-1.5 py-1 rounded border hover:bg-green-100 transition-colors",
                                      shiftInfo?.isOverride ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                                    )}
                                    title={`${member.name} - ${shiftInfo?.isDayOff ? 'Day Off' : isHalfDay ? 'Half Day' : 'Full Day'}${shiftInfo && !shiftInfo.isDayOff ? ` (${shiftInfo.startTime}-${shiftInfo.endTime})` : ''}`}
                                  >
                                    <Avatar className="h-5 w-5 border border-green-300 flex-shrink-0">
                                      <AvatarImage src={(member as any).avatarUrl} alt={member.name || 'Team Member'} />
                                      <AvatarFallback className="text-[8px] font-bold bg-green-200 text-green-900">
                                        {member.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] font-semibold text-green-900 truncate">
                                        {member.name}
                                      </div>
                                      {shiftInfo && !shiftInfo.isDayOff && (
                                        <div className={cn(
                                          "text-[9px] truncate",
                                          shiftInfo.isOverride ? "text-amber-700 font-medium" : "text-green-700"
                                        )}>
                                          {shiftInfo.startTime}-{shiftInfo.endTime}{shiftInfo.abbreviation ? ` ${shiftInfo.abbreviation}` : ''}
                                        </div>
                                      )}
                                    </div>
                                    {isHalfDay && (
                                      <span className="text-[8px] font-bold text-green-700 bg-green-200 px-1 py-0.5 rounded flex-shrink-0">
                                        ½
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                              {(() => {
                                const totalMembers = workingMembers.length + dayEvents.length
                                const visibleBadges = Math.min(dayEvents.length, 2) + Math.min(workingMembers.length, 2)
                                const hiddenCount = totalMembers - visibleBadges
                                if (hiddenCount <= 0) return null
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAllMembersModalWorking(workingMembers)
                                      setAllMembersModalLeaves(dayEvents)
                                      setAllMembersModalDate(date)
                                      setAllMembersSearch('')
                                      setShowAllMembersModal(true)
                                    }}
                                    className="w-full text-[10px] text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded px-1.5 py-1 text-center border border-gray-200 cursor-pointer transition-colors"
                                  >
                                    +{hiddenCount} members
                                  </button>
                                )
                              })()}
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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={calendarFormData.halfDayStart} onChange={e => setCalendarFormData({ ...calendarFormData, halfDayStart: e.target.checked, ...(calendarFormData.startDate === calendarFormData.endDate && e.target.checked ? { halfDayEnd: false } : {}) })} />Start after noon (½ day)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={calendarFormData.halfDayEnd} onChange={e => setCalendarFormData({ ...calendarFormData, halfDayEnd: e.target.checked, ...(calendarFormData.startDate === calendarFormData.endDate && e.target.checked ? { halfDayStart: false } : {}) })} />End at noon (½ day)</label>
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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={requestFormData.halfDayStart} onChange={e => setRequestFormData({ ...requestFormData, halfDayStart: e.target.checked, ...(requestFormData.startDate === requestFormData.endDate && e.target.checked ? { halfDayEnd: false } : {}) })} />Start after noon (½ day)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={requestFormData.halfDayEnd} onChange={e => setRequestFormData({ ...requestFormData, halfDayEnd: e.target.checked, ...(requestFormData.startDate === requestFormData.endDate && e.target.checked ? { halfDayStart: false } : {}) })} />End at noon (½ day)</label>
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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                    disabled
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

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editFormData.halfDayStart} onChange={e => setEditFormData({ ...editFormData, halfDayStart: e.target.checked, ...(editFormData.startDate === editFormData.endDate && e.target.checked ? { halfDayEnd: false } : {}) })} />Start after noon (½ day)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editFormData.halfDayEnd} onChange={e => setEditFormData({ ...editFormData, halfDayEnd: e.target.checked, ...(editFormData.startDate === editFormData.endDate && e.target.checked ? { halfDayStart: false } : {}) })} />End at noon (½ day)</label>
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
                        handleApprove(String((selectedVacation.request || selectedVacation).id))
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
                        handleDeny(String((selectedVacation.request || selectedVacation).id))
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

      {/* All Members Modal — working + on leave */}
      {showAllMembersModal && allMembersModalDate && (() => {
        const filteredWorking = allMembersModalWorking.filter((member: TeamMember) =>
          !allMembersSearch || member.name?.toLowerCase().includes(allMembersSearch.toLowerCase())
        )
        const filteredLeaves = allMembersModalLeaves.filter((item: LeaveRequest) =>
          !allMembersSearch || item.employee?.name?.toLowerCase().includes(allMembersSearch.toLowerCase())
        )
        const totalCount = allMembersModalWorking.length + allMembersModalLeaves.length

        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAllMembersModal(false)}
          >
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Team — {format(allMembersModalDate, 'd MMMM yyyy')}</CardTitle>
                <CardDescription>
                  {totalCount} {totalCount === 1 ? 'member' : 'members'} · {allMembersModalWorking.length} working · {allMembersModalLeaves.length} on leave
                </CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    value={allMembersSearch}
                    onChange={(e) => setAllMembersSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[55vh]">
                {/* On Leave Section */}
                {filteredLeaves.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">On Leave</div>
                    <div className="space-y-2">
                      {filteredLeaves.map((item: LeaveRequest, index: number) => {
                        const employee = item.employee
                        const leaveType = item.leaveType
                        const request = item.request || item

                        return (
                          <button
                            key={`leave-${index}`}
                            type="button"
                            onClick={() => {
                              handleVacationClick(item)
                              setShowAllMembersModal(false)
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                              leaveType?.name === 'Vacation'
                                ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                                : leaveType?.name === 'Sick Leave'
                                ? "bg-red-50 border-red-200 hover:bg-red-100"
                                : "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                            )}
                          >
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={employee?.avatarUrl} alt={employee?.name} />
                              <AvatarFallback className={cn(
                                "text-sm font-bold",
                                leaveType?.name === 'Vacation' ? "bg-blue-200 text-blue-900" :
                                leaveType?.name === 'Sick Leave' ? "bg-red-200 text-red-900" :
                                "bg-yellow-200 text-yellow-900"
                              )}>
                                {employee?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900">{employee?.name || 'Unknown'}</div>
                              <div className="text-sm text-gray-600">
                                {formatDate(request.startDate)} — {formatDate(request.endDate)}
                                {request.reason && <span className="ml-1 italic text-gray-500">"{request.reason}"</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                leaveType?.name === 'Vacation' ? "bg-blue-100 text-blue-800" :
                                leaveType?.name === 'Sick Leave' ? "bg-red-100 text-red-800" :
                                "bg-yellow-100 text-yellow-800"
                              )}>
                                {leaveType?.name || 'Leave'}
                              </span>
                              {(request as any).status === 'pending' && (
                                <span className="text-xs font-bold text-yellow-900 bg-yellow-400 px-2 py-0.5 rounded-full">
                                  PENDING
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Working Section */}
                {filteredWorking.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Working</div>
                    <div className="space-y-2">
                      {filteredWorking.map((member: TeamMember) => {
                        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                        const dayName = dayNames[allMembersModalDate.getDay()]
                        const isHalfDay = (member as any).workSchedule?.[dayName] === 'half'
                        const shiftInfo = getShiftTimeForMember(member.id, allMembersModalDate)

                        return (
                          <div
                            key={member.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                              shiftInfo?.isOverride ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                            )}
                          >
                            <Avatar className="h-10 w-10 border-2 border-green-300 flex-shrink-0">
                              <AvatarImage src={(member as any).avatarUrl} alt={member.name || 'Team Member'} />
                              <AvatarFallback className="text-sm font-bold bg-green-200 text-green-900">
                                {member.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900">{member.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {shiftInfo && !shiftInfo.isDayOff ? (
                                  <span className={cn(
                                    "text-sm",
                                    shiftInfo.isOverride ? "text-amber-700 font-medium" : "text-green-700"
                                  )}>
                                    {shiftInfo.startTime} - {shiftInfo.endTime}{shiftInfo.abbreviation ? ` ${shiftInfo.abbreviation}` : ''}
                                    {shiftInfo.isOverride && <span className="ml-1 text-xs">(custom)</span>}
                                  </span>
                                ) : shiftInfo?.isDayOff ? (
                                  <span className="text-sm text-gray-500">Day Off</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isHalfDay && (
                                <span className="text-xs font-bold text-green-700 bg-green-200 px-2 py-0.5 rounded">
                                  Half Day
                                </span>
                              )}
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                shiftInfo?.isOverride ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                              )}>
                                {shiftInfo?.isOverride ? 'Custom' : 'Regular'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {filteredWorking.length === 0 && filteredLeaves.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No members found matching "{allMembersSearch}"
                  </div>
                )}

                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllMembersModal(false)}
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })()}

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
                                {(request as any).daysCount || '0'} {parseFloat((request as any).daysCount || '0') === 1 ? 'day' : 'days'}
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
