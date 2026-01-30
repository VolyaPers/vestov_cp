import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, FileText, ChevronLeft, ChevronRight, Plane, Heart, Plus, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VacationBalanceCard } from '@/components/VacationBalanceCard'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  differenceInDays,
  parseISO,
  isToday
} from 'date-fns'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCustomAlert } from '@/components/ui/custom-alert'

interface TeamMember {
  id: number
  name: string
  email: string
}

interface EmploymentCycle {
  id: number
  cycleStart: string
  cycleEnd: string
  isActive: boolean
}

interface LeaveBalance {
  leaveType: string
  leaveTypeId: number
  totalAllocated: number
  used: number
  pending: number
  adjustments: number
  available: number
}

interface LeaveRequest {
  id: number
  leaveTypeName: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason?: string
  decisionReason?: string
  requestedAt: string
  isOldCycle?: boolean
  isFutureCycle?: boolean
  cycleInfo?: {
    cycleStart: string
    cycleEnd: string
    isActive: boolean
  } | null
}

interface LeaveType {
  id: number
  name: string
  isDeductible: boolean
  halfDaySupported: boolean
  createdAt: string
}

interface LeaveRequestResponse {
  request: {
    id: number
    startDate: string
    endDate: string
    daysCount: number
    status: string
    reason: string | null
    decisionReason: string | null
    createdAt: string
  }
  leaveType: {
    name: string
  }
}

export function EmployeeVacations() {
  const { showAlert } = useCustomAlert()
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [employmentCycle, setEmploymentCycle] = useState<EmploymentCycle | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activeTab, setActiveTab] = useState('balance')
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  // Fetch vacation balance (50/50 rule)
  interface VacationBalance {
    totalAllocated: number
    totalUsed: number
    totalRemaining: number
    firstHalfAvailable: number
    firstHalfUsed: number
    firstHalfRemaining: number
    secondHalfAvailable: number
    secondHalfUsed: number
    secondHalfRemaining: number
    currentlyAvailable: number
    lockedUntilSecondHalf: number
    cashableAtYearEnd: number
    willExpire: number
    isFirstHalf: boolean
    daysUntilSecondHalf: number
    cycleStartDate: string
    cycleMidpointDate: string
    cycleEndDate: string
    cycleId: number
    cycleNumber: number
    careerYear: number
    baseAllocation: number
  }

  const { data: vacationBalance50, isLoading: isLoadingBalance, error: balanceError } = useQuery<VacationBalance>({
    queryKey: ['myVacationBalance'],
    queryFn: async () => {
      console.log('[EmployeeVacations] Fetching vacation balance...')
      try {
        const result = await api.getMyVacationBalance()
        console.log('[EmployeeVacations] Vacation balance fetched:', result)
        return result as VacationBalance
      } catch (error) {
        console.error('[EmployeeVacations] Error fetching vacation balance:', error)
        throw error
      }
    },
    staleTime: 0, // Always consider data stale, so it refetches when invalidated
    gcTime: 0, // Don't cache, always fetch fresh data (renamed from cacheTime in v5)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  })

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // Get employee profile
      const member = await api.request('/vacation/my-profile')
      setTeamMember(member)

      // Load employment cycle
      try {
        const cycleData = await api.request(`/vacation/employment-cycle/${member.id}`)
        setEmploymentCycle(cycleData)
      } catch (error: unknown) {
        // Silently handle missing employment cycle - it's a valid state, not an error
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('No active employment cycle found')) {
          setEmploymentCycle(null)
        } else {
          console.error('Failed to load employment cycle:', error)
        }
      }

      // Load leave balances
      try {
        const balancesData = await api.request(`/vacation/balances/${member.id}`)
        // balancesData is {employmentCycle, balances}, extract balances array
        setLeaveBalances(Array.isArray(balancesData) ? balancesData : balancesData.balances || [])
      } catch (error: unknown) {
        // Silently handle missing employment cycle - it's a valid state, not an error
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('No active employment cycle found')) {
          setLeaveBalances([])
        } else {
          console.error('Failed to load balances:', error)
          setLeaveBalances([])
        }
      }

      // Load leave requests - use requests endpoint which includes cycle information
      try {
        const requestsData = await api.request(`/vacation/requests/${member.id}`)
        // The API returns {request, leaveType, ...} structure with cycle information
        interface ApiRequestItem {
          request: {
            id: number
            startDate: string
            endDate: string
            daysCount: number
            status: string
            reason: string | null
            decisionReason: string | null
            createdAt: string
          }
          leaveType: {
            name: string
          }
          isOldCycle?: boolean
          isFutureCycle?: boolean
          cycleInfo?: {
            cycleStart: string
            cycleEnd: string
            isActive: boolean
          } | null
        }
        
        const transformedRequests = Array.isArray(requestsData)
          ? (requestsData as ApiRequestItem[]).map((item) => ({
              id: item.request.id,
              leaveTypeName: item.leaveType.name,
              startDate: item.request.startDate,
              endDate: item.request.endDate,
              totalDays: item.request.daysCount,
              status: item.request.status,
              reason: item.request.reason,
              decisionReason: item.request.decisionReason,
              requestedAt: item.request.createdAt,
              isOldCycle: item.isOldCycle ?? false,
              isFutureCycle: item.isFutureCycle ?? false,
              cycleInfo: item.cycleInfo
            }))
          : []
        setLeaveRequests(transformedRequests)
      } catch (error) {
        console.error('Failed to load requests:', error)
        setLeaveRequests([])
      }

      // Load leave types
      const typesData = await api.getLeaveTypes()
      setLeaveTypes(typesData)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDayClick = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd')
    setFormData({
      ...formData,
      startDate: formattedDate,
      endDate: formattedDate
    })
    setShowCalendarModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamMember || !formData.leaveTypeId || !formData.startDate || !formData.endDate) {
      showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      setSubmitting(true)

      await api.createLeaveRequest({
        employeeId: teamMember.id,
        leaveTypeId: parseInt(formData.leaveTypeId),
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason
      })

      // Reset form
      setFormData({
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: ''
      })

      // Reload data
      await loadData()

      // Close modal
      setShowCalendarModal(false)

      showAlert({ message: 'Leave request submitted successfully!', type: 'success' })
    } catch (error) {
      console.error('Error submitting leave request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit leave request. Please try again.'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const calculateRequestDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    return differenceInDays(end, start) + 1
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-2 border-dashed border-yellow-300 animate-pulse">Pending</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'denied':
        return <Badge className="bg-red-100 text-red-800">Denied</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
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
      return day >= startDate && day <= endDate
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const daysLeft = employmentCycle
    ? differenceInDays(new Date(employmentCycle.cycleEnd), new Date())
    : 0

  const vacationBalance = leaveBalances.find(lb => lb.leaveType === 'Vacation')
  const sickLeaveBalance = leaveBalances.find(lb => lb.leaveType === 'Sick Leave')
  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              My Vacations
            </h1>
            <p className="stripe-text-secondary text-lg">
              Manage your time off and view your schedule
            </p>
          </div>
        </div>
      </div>

      {/* Tabs for Vacation Balance, Calendar and Requests */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-14 bg-gradient-to-r from-gray-50 to-gray-100 p-1 gap-1">
          <TabsTrigger
            value="balance"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200 hover:scale-105 hover:shadow-sm group"
          >
            <Wallet className="h-5 w-5 text-green-600 group-data-[state=active]:text-green-700 transition-colors" />
            <span className="font-medium">Vacation Balance</span>
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200 hover:scale-105 hover:shadow-sm group"
          >
            <Calendar className="h-5 w-5 text-blue-600 group-data-[state=active]:text-blue-700 transition-colors" />
            <span className="font-medium">Calendar</span>
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200 hover:scale-105 hover:shadow-sm group"
          >
            <FileText className="h-5 w-5 text-purple-600 group-data-[state=active]:text-purple-700 transition-colors" />
            <span className="font-medium flex items-center gap-2">
              Requests
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Vacation Balance Tab */}
        <TabsContent value="balance" className="space-y-4">
          <VacationBalanceCard
            key={`vacation-balance-${vacationBalance50?.careerYear ?? 'loading'}-${vacationBalance50?.cycleId ?? 'none'}`}
            balance={vacationBalance50 ?? null}
            isLoading={isLoadingBalance}
            error={balanceError as Error | null}
          />
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          {/* Leave Balances Summary */}
          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vacationBalance && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardHeader className="pb-3 flex flex-row items-center gap-3">
                  <Plane className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg text-blue-900">Vacation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900 mb-2">
                    {Number.isInteger(vacationBalance.available)
                      ? vacationBalance.available
                      : vacationBalance.available.toFixed(1)} days
                  </div>
                  <div className="text-sm text-blue-700">
                    {vacationBalance.totalAllocated} total • {vacationBalance.used} used • {vacationBalance.pending} pending
                  </div>
                </CardContent>
              </Card>
            )}

            {sickLeaveBalance && (
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardHeader className="pb-3 flex flex-row items-center gap-3">
                  <Heart className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-lg text-red-900">Sick Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-900 mb-2">
                    {Number.isInteger(sickLeaveBalance.available)
                      ? sickLeaveBalance.available
                      : sickLeaveBalance.available.toFixed(1)} days
                  </div>
                  <div className="text-sm text-red-700">
                    {sickLeaveBalance.totalAllocated} total • {sickLeaveBalance.used} used • {sickLeaveBalance.pending} pending
                  </div>
                </CardContent>
              </Card>
            )}
          </div> */}

          {/* Calendar */}
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <CardTitle className="text-2xl">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Click the + button on any day to create a leave request
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-700 py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells */}
                {emptyDays.map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-28 p-2"></div>
                ))}

                {/* Calendar days */}
                {daysInMonth.map(day => {
                  const dayLeave = getLeaveForDay(day)
                  const isCurrentDay = isToday(day)

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-28 p-2 border border-gray-200 rounded-lg',
                        isCurrentDay && 'border-blue-500 border-2'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isCurrentDay &&
                              'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        <button
                          onClick={() => handleDayClick(day)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Add leave request"
                        >
                          <Plus className="w-3 h-3 text-primary" />
                        </button>
                      </div>

                      {dayLeave.length > 0 && (
                        <div className="space-y-1">
                          {dayLeave.map(leave => {
                            const isPending = leave.status === 'pending'
                            return (
                              <button
                                key={leave.id}
                                className={cn(
                                  'w-full px-2 py-1 rounded text-white truncate text-left hover:opacity-80 transition-all relative',
                                  isPending && 'border-2 border-dashed border-yellow-300 opacity-75 animate-pulse',
                                  leave.leaveTypeName === 'Vacation' ? 'bg-blue-500' : 'bg-red-500'
                                )}
                              >
                                <span className="flex items-center justify-between gap-1">
                                  <span className="truncate text-xs">{leave.leaveTypeName}</span>
                                  {isPending && (
                                    <span className="flex-shrink-0 text-[10px] bg-yellow-400 text-yellow-900 px-1 rounded font-bold">
                                      PENDING
                                    </span>
                                  )}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          {/* Request Form */}
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle>New Leave Request</CardTitle>
              <CardDescription>Submit a request for time off</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Leave Type *</Label>
                    <Select
                      value={formData.leaveTypeId}
                      onValueChange={(value) => setFormData({ ...formData, leaveTypeId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.filter(lt => lt.name === 'Vacation' || lt.name === 'Sick Leave').map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Total Days</Label>
                    <Input
                      value={calculateRequestDays() > 0 ? `${calculateRequestDays()} days` : 'Select dates'}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Reason (Optional)</Label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="Provide a reason for your leave request..."
                      rows={3}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Requests List */}
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
              <CardDescription>History of your leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No leave requests yet</p>
              ) : (
                <div className="space-y-4">
                  {leaveRequests
                    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                    .map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{request.leaveTypeName}</h3>
                            {getStatusBadge(request.status)}
                            {(request.isOldCycle || request.isFutureCycle) && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                {request.isOldCycle ? 'Old Cycle' : 'Future Cycle'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {request.totalDays} {request.totalDays === 1 ? 'day' : 'days'}
                            </div>
                          </div>
                          {(request.isOldCycle || request.isFutureCycle) && (
                            <p className="text-xs text-amber-600 mt-1 italic">
                              {request.isOldCycle 
                                ? 'This request is from a previous cycle and does not count toward your current balance.'
                                : 'This request is from a future cycle and will count toward that cycle\'s balance.'}
                            </p>
                          )}
                          {request.reason && (
                            <p className="text-sm text-gray-600 mt-2">Reason: {request.reason}</p>
                          )}
                          {request.decisionReason && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Response:</span> {request.decisionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
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
              <CardDescription>Create a new leave request for selected dates</CardDescription>
            </CardHeader>
            <CardContent className="overflow-visible">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Leave Type */}
                <div>
                  <Label>Leave Type *</Label>
                  <Select
                    value={formData.leaveTypeId}
                    onValueChange={(value) => setFormData({ ...formData, leaveTypeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.filter(lt => lt.name === 'Vacation' || lt.name === 'Sick Leave').map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                {/* End Date */}
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>

                {/* Total Days Display */}
                <div>
                  <Label>Total Days</Label>
                  <Input
                    value={calculateRequestDays() > 0 ? `${calculateRequestDays()} days` : 'Select dates'}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                {/* Reason */}
                <div>
                  <Label>Reason (Optional)</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Reason for leave request..."
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCalendarModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
