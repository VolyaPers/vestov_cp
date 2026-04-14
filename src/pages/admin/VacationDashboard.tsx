import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  Check,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  Filter,
  Settings,
  Save,
  Trash2,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCustomAlert } from '@/components/ui/custom-alert'

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
  request: {
    id: number
    employeeId: number
    leaveTypeId: number
    status: string
    startDate: string
    endDate: string
    halfDayStart: boolean
    halfDayEnd: boolean
    daysCount: string
    reason: string | null
    decisionReason: string | null
    createdAt: string
  }
  leaveType: {
    id: number
    name: string
  }
  employee?: {
    id: number
    name: string
    email: string
  }
  requestedBy: {
    id: number
    username: string
    fullName: string
  }
}

interface CalendarEvent {
  id: number
  employeeId: number
  employeeName: string
  avatarUrl: string | null
  leaveType: string
  startDate: string
  endDate: string
  halfDayStart: boolean
  halfDayEnd: boolean
  status: string
  daysCount: string
}

interface Employee {
  id: number
  name: string
  email: string
  role: string
  status: string
}

interface LeaveAllocationSetting {
  id: number
  cycleNumber: number
  leaveTypeId: number
  leaveTypeName: string
  allocatedDays: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export default function VacationDashboard() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [employmentCycle, setEmploymentCycle] = useState<EmploymentCycle | null>(null)
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedView, setSelectedView] = useState<'employee' | 'admin' | 'calendar' | 'settings'>('employee')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    halfDayStart: false,
    halfDayEnd: false,
    reason: '',
    employeeId: '',
  })

  // Leave allocation settings state
  const [allocationSettings, setAllocationSettings] = useState<LeaveAllocationSetting[]>([])
  const [showAddSettingsForm, setShowAddSettingsForm] = useState(false)
  const [settingsFormData, setSettingsFormData] = useState({
    cycleNumber: 1,
    leaveTypeId: '',
    allocatedDays: '',
    isDefault: false,
  })

  // Denial dialog state
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [denialReason, setDenialReason] = useState('')
  const [requestToDeny, setRequestToDeny] = useState<number | null>(null)

  useEffect(() => {
    fetchUserData()
    fetchLeaveTypes()
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData()
    }
  }, [employeeId])

  useEffect(() => {
    if (isAdmin && selectedView === 'admin') {
      fetchPendingRequests()
    }
  }, [isAdmin, selectedView])

  useEffect(() => {
    if (selectedView === 'calendar') {
      fetchCalendarEvents()
    }
  }, [selectedView, currentMonth])

  useEffect(() => {
    if (selectedView === 'settings' && isAdmin) {
      fetchAllocationSettings()
    }
  }, [selectedView, isAdmin])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.employee-dropdown')) {
        setShowEmployeeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data)
        setIsAdmin(data.role === 'admin')

        // For now, use teamMember ID if available, otherwise use user ID
        // This should be adjusted based on your actual data model
        if (data.teamMemberId) {
          setEmployeeId(data.teamMemberId)
        } else {
          // Fetch team member by email or create a mapping
          fetchTeamMemberByEmail(data.email)
        }
      } else {
        setLoading(false)
        setError('Failed to load user data')
      }
    } catch (err) {
      console.error('Error fetching user data:', err)
      setLoading(false)
      setError('Failed to load user data')
    }
  }

  const fetchTeamMemberByEmail = async (email: string) => {
    try {
      const response = await fetch(`/api/admin/team-members?email=${email}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const members = await response.json()
        if (members.length > 0) {
          setEmployeeId(members[0].id)
        } else {
          // No team member found - this might be an admin-only user
          // For admin users, don't set an error, just proceed without employee data
          setLoading(false)
          // If user is admin, they can still use the admin features
          // Since isAdmin is set before this, we can use it
          setSelectedView('admin')
        }
      } else {
        console.error('Failed to fetch team member')
        setLoading(false)
        setError('Failed to load team member data')
      }
    } catch (err) {
      console.error('Error fetching team member:', err)
      setLoading(false)
      setError('Failed to load team member data')
    }
  }

  const fetchLeaveTypes = async () => {
    try {
      const response = await fetch('/api/vacation/leave-types', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLeaveTypes(data)
      }
    } catch (err) {
      console.error('Error fetching leave types:', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/vacation/employees', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  }

  const fetchEmployeeData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch employment cycle and balances
      const balancesResponse = await fetch(`/api/vacation/balances/${employeeId}`, {
        credentials: 'include',
      })
      
      if (balancesResponse.ok) {
        const data = await balancesResponse.json()
        setEmploymentCycle(data.employmentCycle)
        setBalances(data.balances)
      }

      // Fetch leave requests
      const requestsResponse = await fetch(`/api/vacation/requests/${employeeId}`, {
        credentials: 'include',
      })
      
      if (requestsResponse.ok) {
        const data = await requestsResponse.json()
        setRequests(data)
      }
    } catch (err) {
      console.error('Error fetching employee data:', err)
      setError('Failed to load vacation data')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/vacation/requests?status=pending', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data)
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err)
    }
  }

  const fetchCalendarEvents = async () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    
    try {
      const response = await fetch(
        `/api/vacation/calendar?startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setCalendarEvents(data)
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/vacation/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: formData.employeeId || employeeId,
          leaveTypeId: parseInt(formData.leaveTypeId),
          startDate: formData.startDate,
          endDate: formData.endDate,
          halfDayStart: formData.halfDayStart,
          halfDayEnd: formData.halfDayEnd,
          reason: formData.reason,
        }),
      })
      
      if (response.ok) {
        setShowRequestForm(false)
        setFormData({
          leaveTypeId: '',
          startDate: '',
          endDate: '',
          halfDayStart: false,
          halfDayEnd: false,
          reason: '',
          employeeId: '',
        })
        setSelectedEmployee(null)
        setEmployeeSearchTerm('')
        fetchEmployeeData()
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to submit request', type: 'error' })
      }
    } catch (err) {
      console.error('Error submitting request:', err)
      showAlert({ message: 'Failed to submit request', type: 'error' })
    }
  }

  const handleApproveRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/vacation/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'approved',
          decisionReason: 'Request approved',
        }),
      })
      
      if (response.ok) {
        fetchPendingRequests()
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to approve request', type: 'error' })
      }
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }

  const handleDenyRequest = async (requestId: number, reason?: string) => {
    try {
      const response = await fetch(`/api/vacation/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'denied',
          decisionReason: reason || 'Request denied',
        }),
      })

      if (response.ok) {
        fetchPendingRequests()
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to deny request', type: 'error' })
      }
    } catch (err) {
      console.error('Error denying request:', err)
    }
  }

  const handleCancelRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/vacation/requests/${requestId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason: 'Canceled by user',
        }),
      })

      if (response.ok) {
        fetchEmployeeData()
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to cancel request', type: 'error' })
      }
    } catch (err) {
      console.error('Error canceling request:', err)
    }
  }

  // Leave allocation settings functions
  const fetchAllocationSettings = async () => {
    try {
      const response = await fetch('/api/vacation/admin/allocation-settings', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setAllocationSettings(data)
      }
    } catch (err) {
      console.error('Error fetching allocation settings:', err)
    }
  }

  const handleSaveAllocationSetting = async () => {
    if (!settingsFormData.leaveTypeId || !settingsFormData.allocatedDays) {
      showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      const response = await fetch('/api/vacation/admin/allocation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settingsFormData),
      })

      if (response.ok) {
        fetchAllocationSettings()
        setShowAddSettingsForm(false)
        setSettingsFormData({
          cycleNumber: 1,
          leaveTypeId: '',
          allocatedDays: '',
          isDefault: false,
        })
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to save setting', type: 'error' })
      }
    } catch (err) {
      console.error('Error saving allocation setting:', err)
      showAlert({ message: 'Failed to save setting', type: 'error' })
    }
  }

  const handleDeleteAllocationSetting = async (settingId: number) => {
    const confirmed = await showConfirm({
      title: 'Delete Allocation Setting',
      message: 'Are you sure you want to delete this allocation setting?',
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/vacation/admin/allocation-settings/${settingId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        fetchAllocationSettings()
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to delete setting', type: 'error' })
      }
    } catch (err) {
      console.error('Error deleting allocation setting:', err)
      showAlert({ message: 'Failed to delete setting', type: 'error' })
    }
  }

  const handleSetDefaultCycle = async (cycleNumber: number) => {
    const confirmed = await showConfirm({
      title: 'Set Default Cycle',
      message: `Set cycle ${cycleNumber} as the default for future cycles?`,
      type: 'info',
      confirmText: 'Set Default',
      cancelText: 'Cancel',
    })

    if (!confirmed) return

    try {
      const response = await fetch('/api/vacation/admin/allocation-settings/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cycleNumber }),
      })

      if (response.ok) {
        fetchAllocationSettings()
        showAlert({ message: `Cycle ${cycleNumber} is now set as default`, type: 'success' })
      } else {
        const error = await response.json()
        showAlert({ message: error.error || 'Failed to set default cycle', type: 'error' })
      }
    } catch (err) {
      console.error('Error setting default cycle:', err)
      showAlert({ message: 'Failed to set default cycle', type: 'error' })
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      denied: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800',
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
  }

  const renderCalendarDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEvents = calendarEvents.filter(
      event => dateStr >= event.startDate && dateStr <= event.endDate
    )
    
    return (
      <div
        className={`min-h-[90px] p-2 rounded-xl border transition-all duration-200 hover:shadow-md ${
          !isSameMonth(date, currentMonth) 
            ? 'bg-gray-50/50 border-gray-200/50' 
            : isToday(date) 
              ? 'bg-slate-50 border-slate-200 shadow-sm' 
              : 'bg-white/60 border-white/40'
        }`}
      >
        <div className={`text-sm font-bold mb-2 ${
          isToday(date) ? 'text-purple-700' : 'text-gray-700'
        }`}>
          {format(date, 'd')}
        </div>
        {dayEvents.slice(0, 2).map((event, idx) => (
          <div
            key={`${event.id}-${idx}`}
            className={`flex items-center gap-1.5 px-2 py-1 mb-1 rounded-lg transition-all duration-200 ${
              event.status === 'approved'
                ? event.leaveType === 'Vacation'
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-purple-50 border border-purple-200'
                : 'bg-yellow-50 border-2 border-yellow-300 border-dashed'
            }`}
            title={`${event.employeeName} - ${event.leaveType} (${event.daysCount} days)`}
          >
            <Avatar className={`h-5 w-5 border ${
              event.status === 'approved'
                ? event.leaveType === 'Vacation'
                  ? 'border-blue-300'
                  : 'border-purple-300'
                : 'border-yellow-400'
            }`}>
              <AvatarImage src={event.avatarUrl || undefined} alt={event.employeeName} />
              <AvatarFallback className={`text-[8px] font-semibold ${
                event.status === 'approved'
                  ? event.leaveType === 'Vacation'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-purple-200 text-purple-900'
                  : 'bg-yellow-200 text-yellow-900'
              }`}>
                {event.employeeName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className={`text-xs font-medium truncate ${
              event.status === 'approved'
                ? event.leaveType === 'Vacation'
                  ? 'text-blue-800'
                  : 'text-purple-800'
                : 'text-yellow-800'
            }`}>
              {event.employeeName}
            </span>
          </div>
        ))}
        {dayEvents.length > 2 && (
          <div className="text-xs text-gray-500 font-medium bg-gray-100 rounded-lg px-2 py-1">+{dayEvents.length - 2} more</div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="h-16 w-16 animate-pulse rounded-full bg-slate-300/60"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Modern Header Section */}
        <div className="mb-8">
          <div className="stripe-card rounded-lg p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center shadow-sm">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-slate-900">
                  Vacation System
                </h1>
                <p className="text-slate-600 font-medium">Manage time off and leave requests</p>
              </div>
            </div>
            
            {/* Modern View Selector */}
            <div className="flex gap-3">
              {employeeId ? (
                <button
                  onClick={() => setSelectedView('employee')}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all duration-150 ${
                    selectedView === 'employee'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'stripe-btn-secondary'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedView === 'employee' ? 'bg-white/20' : 'bg-slate-100'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  My Vacation
                </button>
              ) : (
                <div className="flex items-center gap-3 px-6 py-3 rounded-lg font-semibold text-gray-400 bg-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  My Vacation (Not Available)
                </div>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setSelectedView('admin')}
                        className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all duration-150 ${
                      selectedView === 'admin'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'stripe-btn-secondary'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedView === 'admin' ? 'bg-white/20' : 'bg-slate-100'
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                    Manage Requests
                  </button>
                  <button
                    onClick={() => setSelectedView('calendar')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all duration-150 ${
                      selectedView === 'calendar'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'stripe-btn-secondary'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedView === 'calendar' ? 'bg-white/20' : 'bg-slate-100'
                    }`}>
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    Team Calendar
                  </button>
                  <button
                    onClick={() => setSelectedView('settings')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all duration-150 ${
                      selectedView === 'settings'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'stripe-btn-secondary'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedView === 'settings' ? 'bg-white/20' : 'bg-slate-100'
                    }`}>
                      <Settings className="w-4 h-4" />
                    </div>
                    Allocation Settings
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800">Error</h3>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employee View */}
        {selectedView === 'employee' && employeeId && (
          <div className="space-y-8">
            {/* Employment Cycle */}
            {employmentCycle ? (
              <div className="stripe-card rounded-lg p-8 hover:shadow-md transition-all duration-150">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Current Employment Cycle</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                    <p className="text-sm font-medium text-green-600 mb-2">Start Date</p>
                    <p className="text-xl font-bold text-gray-900">{format(parseISO(employmentCycle.cycleStart), 'd MMMM yyyy')}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <p className="text-sm font-medium text-blue-600 mb-2">End Date</p>
                    <p className="text-xl font-bold text-gray-900">{format(parseISO(employmentCycle.cycleEnd), 'd MMMM yyyy')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                    <p className="text-sm font-medium text-purple-600 mb-2">Days Remaining</p>
                    <p className="text-xl font-bold text-gray-900">
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(employmentCycle.cycleEnd).getTime() - new Date().getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stripe-card rounded-lg p-8 border border-yellow-200 bg-yellow-50">
                <div className="text-center">
                  <p className="text-gray-700 font-medium">No active employment cycle found, please contact an admin</p>
                </div>
              </div>
            )}

            {/* Leave Balances */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Leave Balances</h2>
                </div>
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  Request Leave
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {balances.map((balance) => (
                  <div key={balance.leaveTypeId} className="bg-gradient-to-br from-white/80 to-gray-50/80 backdrop-blur-sm rounded-2xl p-6 border border-white/40 hover:shadow-lg hover:shadow-purple-100/50 transition-all duration-300">
                    <h3 className="font-bold text-xl mb-4 text-gray-900">{balance.leaveType}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Total Allocated:</span>
                        <span className="font-bold text-gray-900">{balance.totalAllocated} days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Used:</span>
                        <span className="font-bold text-red-500">{balance.used} days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Pending:</span>
                        <span className="font-bold text-yellow-500">{balance.pending} days</span>
                      </div>
                      {balance.adjustments !== 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Adjustments:</span>
                          <span className={`font-bold ${balance.adjustments > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {balance.adjustments > 0 ? '+' : ''}{balance.adjustments} days
                          </span>
                        </div>
                      )}
                      <div className="pt-3 mt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-900">Available:</span>
                          <span className="font-bold text-2xl bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">{balance.available} days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Requests History */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-100 to-purple-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Leave Requests History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200/50">
                  <thead className="bg-gradient-to-r from-gray-50/80 to-gray-100/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200/50">
                    {requests.map(({ request, leaveType }) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {leaveType.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(request.startDate), 'MMM d')} -{' '}
                        {format(parseISO(request.endDate), 'd MMMM yyyy')}
                        {(request.halfDayStart || request.halfDayEnd) && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({request.halfDayStart && 'Half day start'}
                            {request.halfDayStart && request.halfDayEnd && ', '}
                            {request.halfDayEnd && 'Half day end'})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.daysCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {request.reason || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleCancelRequest(request.id)}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Admin View - Pending Requests */}
        {selectedView === 'admin' && isAdmin && (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="p-8 border-b border-gray-200/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-100 to-purple-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Pending Leave Requests</h2>
                </div>
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  Request Leave
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200/50">
                <thead className="bg-gradient-to-r from-gray-50/80 to-gray-100/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200/50">
                  {pendingRequests.map(({ request, leaveType, employee, requestedBy }) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {employee?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">{employee?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {leaveType.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(request.startDate), 'MMM d')} -{' '}
                      {format(parseISO(request.endDate), 'd MMMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.daysCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {request.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(request.createdAt), 'd MMMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="w-9 h-9 flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 rounded-xl transition-all duration-200 hover:shadow-md"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setRequestToDeny(request.id)
                            setDenialReason('')
                            setShowDenialDialog(true)
                          }}
                          className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl transition-all duration-200 hover:shadow-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
              {pendingRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Check className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No pending requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar View */}
        {selectedView === 'calendar' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-100 to-purple-100 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Team Calendar</h2>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-xl text-gray-900 min-w-[180px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Calendar Legend */}
            <div className="flex gap-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg border border-blue-200"></div>
                <span className="font-medium text-gray-700">Vacation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg border border-purple-200"></div>
                <span className="font-medium text-gray-700">Sick Leave</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300 border-dashed rounded-lg"></div>
                <span className="font-medium text-gray-700">Pending</span>
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-3 text-center text-sm font-bold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                  {day}
                </div>
              ))}
              {eachDayOfInterval({
                start: startOfMonth(currentMonth),
                end: endOfMonth(currentMonth),
              }).map((date) => renderCalendarDay(date))}
            </div>
          </div>
        )}

        {/* Settings View - Leave Allocation Settings */}
        {selectedView === 'settings' && isAdmin && (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-emerald-100 to-purple-100 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Leave Allocation Settings</h2>
              </div>
              <button
                onClick={() => setShowAddSettingsForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Add Setting
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-blue-700 text-sm">
                <strong>How it works:</strong> Configure how many leave days are allocated for each employment cycle.
                For example: 1st cycle = 25 vacation + 10 sick days, 2nd cycle = 27 vacation + 10 sick days, etc.
                Mark a cycle as "default" to apply its settings to all subsequent cycles.
              </p>
            </div>

            {/* Settings Table */}
            <div className="bg-white/80 rounded-2xl overflow-hidden border border-white/30">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Cycle</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Leave Type</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Allocated Days</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white/40">
                    {allocationSettings.length > 0 ? (
                      allocationSettings.map((setting) => (
                        <tr key={setting.id} className="hover:bg-white/60 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900">Cycle {setting.cycleNumber}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-gray-900">{setting.leaveTypeName}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{setting.allocatedDays} days</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {setting.isDefault ? (
                              <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                Default
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {!setting.isDefault && (
                                <button
                                  onClick={() => handleSetDefaultCycle(setting.cycleNumber)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Set as Default
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteAllocationSetting(setting.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                              <Settings className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">No allocation settings configured</p>
                            <p className="text-gray-400 text-sm">Add your first setting to get started</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add Settings Form Modal */}
        {showAddSettingsForm && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddSettingsForm(false)}
          >
            <div
              className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-emerald-100 to-purple-100 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Add Allocation Setting</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cycle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsFormData.cycleNumber}
                    onChange={(e) => setSettingsFormData({
                      ...settingsFormData,
                      cycleNumber: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                    placeholder="e.g., 1, 2, 3..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={settingsFormData.leaveTypeId}
                    onChange={(e) => setSettingsFormData({
                      ...settingsFormData,
                      leaveTypeId: e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Allocated Days <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settingsFormData.allocatedDays}
                    onChange={(e) => setSettingsFormData({
                      ...settingsFormData,
                      allocatedDays: e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                    placeholder="e.g., 25, 30, 10..."
                  />
                </div>

                <label className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-gray-200 cursor-pointer hover:bg-white/80 transition-all duration-200">
                  <input
                    type="checkbox"
                    checked={settingsFormData.isDefault}
                    onChange={(e) => setSettingsFormData({
                      ...settingsFormData,
                      isDefault: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Set as default for future cycles
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSettingsForm(false)
                    setSettingsFormData({
                      cycleNumber: 1,
                      leaveTypeId: '',
                      allocatedDays: '',
                      isDefault: false,
                    })
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAllocationSetting}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Setting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Denial Reason Dialog */}
        {showDenialDialog && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDenialDialog(false)}
          >
            <div
              className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-red-100 to-red-200 flex items-center justify-center">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Deny Leave Request</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason for Denial (optional)
                  </label>
                  <textarea
                    value={denialReason}
                    onChange={(e) => setDenialReason(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/70 backdrop-blur-sm transition-all duration-200 resize-none"
                    rows={3}
                    placeholder="Provide a reason for denying this request..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowDenialDialog(false)
                    setRequestToDeny(null)
                    setDenialReason('')
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (requestToDeny) {
                      handleDenyRequest(requestToDeny, denialReason || undefined)
                    }
                    setShowDenialDialog(false)
                    setRequestToDeny(null)
                    setDenialReason('')
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200"
                >
                  Deny Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Request Form Modal */}
        {showRequestForm && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowRequestForm(false)}
          >
            <div
              className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-100 to-purple-100 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Request Leave</h3>
              </div>
              <form onSubmit={handleSubmitRequest}>
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Employee (optional - leave empty for self)
                      </label>
                      <div className="relative employee-dropdown">
                        <input
                          type="text"
                          value={selectedEmployee ? selectedEmployee.name : employeeSearchTerm}
                          onChange={(e) => {
                            setEmployeeSearchTerm(e.target.value)
                            setShowEmployeeDropdown(true)
                            if (!e.target.value) {
                              setSelectedEmployee(null)
                              setFormData({ ...formData, employeeId: '' })
                            }
                          }}
                          onFocus={() => setShowEmployeeDropdown(true)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                          placeholder="Search employee by name..."
                        />
                        {showEmployeeDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {employees
                              .filter(emp =>
                                emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                                emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                              )
                              .map(employee => (
                                <div
                                  key={employee.id}
                                  onClick={() => {
                                    setSelectedEmployee(employee)
                                    setEmployeeSearchTerm('')
                                    setShowEmployeeDropdown(false)
                                    setFormData({ ...formData, employeeId: employee.id.toString() })
                                  }}
                                  className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{employee.name}</div>
                                  <div className="text-sm text-gray-500">{employee.email} • {employee.role}</div>
                                </div>
                              ))
                            }
                            {employees.filter(emp =>
                              emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                              emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                            ).length === 0 && employeeSearchTerm && (
                              <div className="px-4 py-3 text-gray-500 text-center">
                                No employees found matching "{employeeSearchTerm}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Leave Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.leaveTypeId}
                      onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                      required
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-gray-200 cursor-pointer hover:bg-white/80 transition-all duration-200">
                      <input
                        type="checkbox"
                        checked={formData.halfDayStart}
                        onChange={(e) => setFormData({ ...formData, halfDayStart: e.target.checked })}
                        className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Half day start</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-gray-200 cursor-pointer hover:bg-white/80 transition-all duration-200">
                      <input
                        type="checkbox"
                        checked={formData.halfDayEnd}
                        onChange={(e) => setFormData({ ...formData, halfDayEnd: e.target.checked })}
                        className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Half day end</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reason (optional)
                    </label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/70 backdrop-blur-sm transition-all duration-200 resize-none"
                      rows={3}
                      placeholder="Optional reason for leave request..."
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-2xl transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
