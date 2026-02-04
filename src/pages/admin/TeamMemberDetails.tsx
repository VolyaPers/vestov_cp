import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRoute, Link } from 'wouter'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Edit3,
  Trash2,
  Briefcase,
  UserCheck,
  Clock,
  User,
  Plane,
  Heart
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EditTeamMemberDialog, type EditTeamMemberData } from '@/components/EditTeamMemberDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VacationBalanceCard } from '@/components/VacationBalanceCard'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import { format, addYears, differenceInDays } from 'date-fns'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import type { UpdateTeamMemberData } from '@/types/common'

interface TeamMember {
  id: number
  name: string
  role: string
  position?: string
  isDeveloper: boolean
  experienceLevel?: string
  email: string
  phone?: string
  skills?: string[]
  bio?: string
  hourlyRate?: string
  monthlyRate?: string
  isBillable: boolean
  status: string
  startDate: string
  location?: string
  avatarUrl?: string
  clientId?: number
  clientName?: string
}

interface LeaveBalance {
  id: number
  employeeId: number
  leaveTypeId: number
  leaveTypeName: string
  totalDays: string
  adjustmentDays: string
  usedDays: number
  pendingDays: number
  availableDays: number
}

interface EmploymentCycle {
  id: number
  employeeId: number
  cycleStart: string
  cycleEnd: string
  isActive: boolean
  daysLeft: number
}

interface LeaveRequest {
  id: number
  employeeId: number
  employeeName: string
  leaveTypeId: number
  leaveTypeName: string
  status: string
  startDate: string
  endDate: string
  halfDayStart: boolean
  halfDayEnd: boolean
  daysCount: string
  reason?: string
  createdAt: string
}

export function TeamMemberDetails() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [match, params] = useRoute('/admin/team-detail/:id')
  const [member, setMember] = useState<TeamMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMember, setEditingMember] = useState<EditTeamMemberData | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [employmentCycle, setEmploymentCycle] = useState<EmploymentCycle | null>(null)
  const [allEmploymentCycles, setAllEmploymentCycles] = useState<EmploymentCycle[]>([])
  const [totalYearsEmployed, setTotalYearsEmployed] = useState(0)
  const [totalCycles, setTotalCycles] = useState(0)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [vacationLoading, setVacationLoading] = useState(true)
  const [showCycleModal, setShowCycleModal] = useState(false)
  const [isCreatingCycle, setIsCreatingCycle] = useState(false)
  const [cycleFormData, setCycleFormData] = useState({
    cycleStart: '',
    isActive: true
  })

  // Log for debugging

  if (!hasRouteParam(params, 'id')) {
    return <div>Member ID not found</div>
  }
  const memberId = getRouteParam(params, 'id')

  // Log for debugging

  // Fetch 50/50 vacation balance for this employee
  const { data: vacationBalance50, isLoading: isLoadingBalance, error: balanceError } = useQuery({
    queryKey: ['employeeVacationBalance', memberId],
    queryFn: () => memberId ? api.getEmployeeVacationBalance(parseInt(memberId)) : Promise.reject('No member ID'),
    enabled: !!memberId,
  })

  useEffect(() => {
    if (memberId) {
      loadTeamMember()
      loadVacationData()
    }
  }, [memberId])

  const loadTeamMember = async () => {
    try {
      setIsLoading(true)
      const data = await api.getTeamMember(memberId)
      setMember(data as unknown as TeamMember)
    } catch (error) {
      console.error('Failed to load team member:', error)
      setMember(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadVacationData = async () => {
    try {
      setVacationLoading(true)

      // Load leave balances
      const balancesResponse = await fetch(`/api/vacation/employees/${memberId}/balances`, {
        credentials: 'include',
      })
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json()
        setLeaveBalances(balancesData)
      }

      // Load current employment cycle
      const cycleResponse = await fetch(`/api/vacation/employment-cycle/${memberId}`, {
        credentials: 'include',
      })
      if (cycleResponse.ok) {
        const cycleData = await cycleResponse.json()
        setEmploymentCycle(cycleData)
      } else if (cycleResponse.status === 404) {
        // No active cycle is a valid state, not an error
        setEmploymentCycle(null)
      }

      // Load all employment cycles
      const allCyclesResponse = await fetch(`/api/vacation/admin/cycles/employee/${memberId}`, {
        credentials: 'include',
      })
      if (allCyclesResponse.ok) {
        const allCyclesData = await allCyclesResponse.json()
        setAllEmploymentCycles(allCyclesData.cycles || [])
        setTotalYearsEmployed(allCyclesData.totalYears || 0)
        setTotalCycles(allCyclesData.totalCycles || 0)
      }

      // Load leave requests
      const requestsResponse = await fetch(`/api/vacation/requests?employeeId=${memberId}`, {
        credentials: 'include',
      })
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        // Transform nested API response to flat structure expected by UI
        const transformedRequests = requestsData.map((item: any) => ({
          id: item.request.id,
          employeeId: item.request.employeeId,
          employeeName: item.employee?.name || 'Unknown',
          leaveTypeId: item.request.leaveTypeId,
          leaveTypeName: item.leaveType?.name || 'Unknown',
          status: item.request.status,
          startDate: item.request.startDate,
          endDate: item.request.endDate,
          halfDayStart: item.request.halfDayStart,
          halfDayEnd: item.request.halfDayEnd,
          daysCount: item.request.daysCount,
          reason: item.request.reason,
          createdAt: item.request.createdAt
        }))
        setLeaveRequests(transformedRequests)
      }
    } catch (error) {
      console.error('Failed to load vacation data:', error)
    } finally {
      setVacationLoading(false)
    }
  }

  const handleCreateCycle = async () => {
    if (!member) return

    try {
      setIsCreatingCycle(true)

      // Use provided start date or intelligently set next cycle start date
      let cycleStart = cycleFormData.cycleStart

      if (!cycleStart) {
        // If there are existing cycles, set start date to the day after the last cycle ends
        if (allEmploymentCycles.length > 0) {
          const lastCycle = allEmploymentCycles.sort((a, b) =>
            new Date(b.cycleEnd).getTime() - new Date(a.cycleEnd).getTime()
          )[0]

          const lastCycleEndDate = new Date(lastCycle.cycleEnd)
          lastCycleEndDate.setDate(lastCycleEndDate.getDate() + 1)
          cycleStart = lastCycleEndDate.toISOString().split('T')[0]
        } else {
          // If no existing cycles, start from today
          const today = new Date()
          cycleStart = today.toISOString().split('T')[0]
        }
      }

      // Create new employment cycle with leave balance initialization
      await api.request('/vacation/cycles/initialize', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: parseInt(memberId!),
          cycleStart,
          isActive: true,
          leaveAllocations: [
            {
              leaveTypeId: 1, // Vacation
              totalDays: 30,
              adjustmentDays: 0
            },
            {
              leaveTypeId: 2, // Sick Leave
              totalDays: 10,
              adjustmentDays: 0
            }
          ]
        }),
      })

      // Refresh the vacation data
      await loadVacationData()
      setShowCycleModal(false)
      setCycleFormData({ cycleStart: '', isActive: true })
    } catch (error) {
      console.error('Error creating employment cycle:', error)
      showAlert({ message: 'Error creating employment cycle. Please try again.', type: 'error' })
    } finally {
      setIsCreatingCycle(false)
    }
  }

  const handleEditCycle = () => {
    if (employmentCycle) {
      setCycleFormData({
        cycleStart: employmentCycle.cycleStart,
        isActive: employmentCycle.isActive
      })
      setShowCycleModal(true)
    }
  }

  const handleUpdateCycle = async () => {
    if (!employmentCycle) return

    try {
      setIsCreatingCycle(true)

      const response = await fetch(`/api/vacation/admin/cycles/${employmentCycle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cycleStart: cycleFormData.cycleStart,
          isActive: cycleFormData.isActive
        }),
      })

      if (response.ok) {
        // Refresh the vacation data
        await loadVacationData()
        setShowCycleModal(false)
        setCycleFormData({ cycleStart: '', isActive: true })
      } else {
        console.error('Failed to update employment cycle')
        showAlert({ message: 'Failed to update employment cycle. Please try again.', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating employment cycle:', error)
      showAlert({ message: 'Error updating employment cycle. Please try again.', type: 'error' })
    } finally {
      setIsCreatingCycle(false)
    }
  }

  const handleEditTeamMember = () => {
    if (member) {
      setEditingMember({
        ...member,
        isDeveloper: member.isDeveloper || false,
        hourlyRate: member.hourlyRate ? String(member.hourlyRate) : undefined,
      })
      setIsEditModalOpen(true)
    }
  }

  const handleUpdateTeamMember = async () => {
    if (!editingMember || !editingMember.name.trim() || !editingMember.email.trim() || !editingMember.role.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      const updateData: UpdateTeamMemberData & { role?: string; startDate?: string; phone?: string; isBillable?: boolean; isDeveloper?: boolean } = {
        name: editingMember.name,
        email: editingMember.email,
        role: editingMember.role,
        position: editingMember.position,
        skills: editingMember.skills || [],
        hourlyRate: typeof editingMember.hourlyRate === 'number' ? editingMember.hourlyRate : parseFloat(String(editingMember.hourlyRate || '0')),
        experienceLevel: 'middle', // Default, TeamMember interface doesn't include this
        status: editingMember.status as 'active' | 'bench' | 'unavailable',
        bio: editingMember.bio || undefined,
        location: editingMember.location || undefined,
        clientId: editingMember.clientId || undefined,
        startDate: editingMember.startDate, // Include startDate
        phone: editingMember.phone || undefined, // Include phone
        isBillable: editingMember.isBillable, // Include isBillable
        isDeveloper: editingMember.isDeveloper, // Include isDeveloper
      }
      const updatedMember = await api.updateTeamMember(String(editingMember.id), updateData)
      setMember(updatedMember as unknown as TeamMember)
      setIsEditModalOpen(false)
      setEditingMember(null)
    } catch (error) {
      console.error('Error updating team member:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeamMember = async () => {
    if (!member) return

    const confirmed = await showConfirm({
      title: 'Delete Team Member',
      message: `Are you sure you want to delete ${member.name}? This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.deleteTeamMember(String(member.id))
      // Redirect to team overview after successful deletion
      window.location.href = '/admin/team'
    } catch (error) {
      console.error('Error deleting team member:', error)
      showAlert({ message: 'Error deleting team member. Please try again.', type: 'error' })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'bench':
        return 'bg-yellow-100 text-yellow-800'
      case 'unavailable':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Check if route matched and memberId exists
  if (!match || !memberId) {
    console.error('TeamMemberDetails: Route did not match or member ID is missing', { match, memberId })
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Link href="/admin/team">
            <Button variant="ghost" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Invalid team member URL</div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Link href="/admin/team">
            <Button variant="ghost" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading team member...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Link href="/admin/team">
            <Button variant="ghost" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Team member not found</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin/team">
            <Button variant="ghost" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>

          <div className="flex gap-3">
            <Button
              onClick={handleEditTeamMember}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={handleDeleteTeamMember}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Member Profile Card */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="pb-6">
            <div className="flex items-start gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20 ring-4 ring-gray-100">
                  <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
                  <AvatarFallback className="bg-slate-700 text-white font-medium text-lg">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ring-2 ring-white ${member.status === 'active' ? 'bg-green-400' :
                    member.status === 'bench' ? 'bg-yellow-400' : 'bg-gray-400'
                  }`} />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl text-gray-900 mb-2">{member.name}</CardTitle>
                    <CardDescription className="text-lg text-gray-600 mb-3">{member.role}</CardDescription>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(member.status)}>
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </Badge>
                      {member.isBillable && (
                        <Badge className="bg-green-50 text-green-700">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Billable
                        </Badge>
                      )}
                      {!member.isBillable && (
                        <Badge className="bg-purple-50 text-purple-700">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Internal
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{member.phone}</span>
                  </div>
                )}
                {member.location && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{member.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">Started {format(parseLocalDate(member.startDate), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {member.bio && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{member.bio}</p>
              </div>
            )}

            {/* Skills */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills</h3>
              {member.skills && member.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((skill, index) => (
                    <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No skills added yet. Click "Edit Team Member" to add skills.</p>
              )}
            </div>

            {/* Billing Information */}
            {member.isBillable && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {member.hourlyRate && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(parseFloat(member.hourlyRate))}
                        </div>
                        <div className="text-sm text-gray-600">per hour</div>
                      </div>
                    </div>
                  )}

                  {member.clientName && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                        <Briefcase className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{member.clientName}</div>
                        <div className="text-sm text-gray-600">Current Client</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vacation Balance (50/50 Rule) */}
        {member && (
          <VacationBalanceCard
            balance={vacationBalance50}
            isLoading={isLoadingBalance}
            error={balanceError as Error | null}
          />
        )}

        {/* Current Employment Cycle */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-gray-900">Current Employment Cycle</CardTitle>
              <div className="flex gap-2">
                {allEmploymentCycles.length > 0 ? (
                  <Button
                    onClick={handleEditCycle}
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Cycle
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowCycleModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Cycle
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {vacationLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : allEmploymentCycles.length > 0 ? (
              (() => {
                const currentCycle = allEmploymentCycles.find(cycle => cycle.isActive)
                if (currentCycle) {
                  const today = new Date()
                  const cycleEndDate = new Date(currentCycle.cycleEnd)
                  const daysLeft = differenceInDays(cycleEndDate, today)

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Current Cycle Start */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Current Cycle Start</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-900">
                          {format(new Date(currentCycle.cycleStart), 'MMM d, yyyy')}
                        </div>
                      </div>

                      {/* Current Cycle End */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">Current Cycle End</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-900">
                          {format(new Date(currentCycle.cycleEnd), 'MMM d, yyyy')}
                        </div>
                      </div>

                      {/* Days Left */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">Days Left</span>
                        </div>
                        <div className="text-2xl font-bold text-green-900">
                          {daysLeft > 0 ? daysLeft : 0} days
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No active employment cycle found, please contact an admin</p>
                  </div>
                )
              })()
            ) : (
              <div className="text-center py-8">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-200 to-yellow-300">
                  <Calendar className="h-8 w-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Employment Cycle Found</h3>
                <p className="text-gray-500 mb-6">No active employment cycle found, please contact an admin to set up the employment cycle for this employee.</p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">📅 Employment cycles define leave allocation periods</p>
                  <p className="text-sm text-gray-600">💼 Required for leave request processing</p>
                  <p className="text-sm text-gray-600">🔄 Automatically initializes vacation and sick leave balances</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-gray-900">Leave Requests</CardTitle>
                <CardDescription>History of leave requests for this employee</CardDescription>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Calendar className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vacationLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.length > 0 ? (
                  <>
                    {/* Group requests by status */}
                    {leaveRequests.filter(req => req.status === 'approved').length > 0 && (
                      <>
                        <div className="text-sm font-semibold text-gray-900 mb-3">Approved Requests</div>
                        {leaveRequests.filter(req => req.status === 'approved').map((request) => {
                          const getStatusColor = (leaveType: string) => {
                            if (leaveType.toLowerCase().includes('sick')) {
                              return { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800' }
                            } else if (leaveType.toLowerCase().includes('vacation')) {
                              return { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-800' }
                            }
                            return { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-800' }
                          }

                          const colors = getStatusColor(request.leaveTypeName)

                          return (
                            <div key={request.id} className={`p-3 rounded-lg border ${colors.bg}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <Badge className={colors.badge}>{request.leaveTypeName}</Badge>
                                  <span className="text-sm text-gray-600">
                                    {format(parseLocalDate(request.startDate), 'MMM d, yyyy')} - {format(parseLocalDate(request.endDate), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                <span className="text-sm font-medium">{parseFloat(request.daysCount).toFixed(2)} days</span>
                              </div>
                              {request.reason && (
                                <div className="text-xs text-gray-500">Reason: {request.reason}</div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}

                    {leaveRequests.filter(req => req.status === 'pending').length > 0 && (
                      <>
                        <div className="text-sm font-semibold text-gray-900 mb-3 mt-6">Pending Requests</div>
                        {leaveRequests.filter(req => req.status === 'pending').map((request) => (
                          <div key={request.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-yellow-100 text-yellow-800">{request.leaveTypeName}</Badge>
                                <span className="text-sm text-gray-600">
                                  {format(parseLocalDate(request.startDate), 'MMM d, yyyy')} - {format(parseLocalDate(request.endDate), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <span className="text-sm font-medium">{parseFloat(request.daysCount).toFixed(2)} days</span>
                            </div>
                            {request.reason && (
                              <div className="text-xs text-gray-500">Reason: {request.reason}</div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {leaveRequests.filter(req => req.status === 'denied').length > 0 && (
                      <>
                        <div className="text-sm font-semibold text-gray-900 mb-3 mt-6">Denied Requests</div>
                        {leaveRequests.filter(req => req.status === 'denied').map((request) => (
                          <div key={request.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-red-100 text-red-800">{request.leaveTypeName}</Badge>
                                <span className="text-sm text-gray-600">
                                  {format(parseLocalDate(request.startDate), 'MMM d, yyyy')} - {format(parseLocalDate(request.endDate), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <span className="text-sm font-medium">{parseFloat(request.daysCount).toFixed(2)} days</span>
                            </div>
                            {request.reason && (
                              <div className="text-xs text-gray-500">Reason: {request.reason}</div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No leave requests found for this employee
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal - Using shared component */}
        <EditTeamMemberDialog
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open)
            if (!open) {
              setEditingMember(null)
            }
          }}
          member={editingMember}
          onMemberChange={(updates) => {
            if (editingMember) {
              setEditingMember({ ...editingMember, ...updates })
            }
          }}
          onSave={handleUpdateTeamMember}
          isSubmitting={isSubmitting}
        />

        {/* Employment Cycle Modal */}
        <Dialog open={showCycleModal} onOpenChange={setShowCycleModal}>
          <DialogContent className="max-w-md bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl">
            <DialogHeader className="pb-6 border-b border-gray-100">
              <DialogTitle className="text-xl font-bold text-gray-900">
                {employmentCycle ? 'Edit Employment Cycle' : 'Create New Employment Cycle'}
              </DialogTitle>
              <p className="text-gray-600 mt-2">
                {employmentCycle
                  ? 'Update the employment cycle dates and status'
                  : allEmploymentCycles.length > 0
                    ? `Create cycle ${allEmploymentCycles.length + 1} starting ${(() => {
                      const lastCycle = allEmploymentCycles.sort((a, b) =>
                        new Date(b.cycleEnd).getTime() - new Date(a.cycleEnd).getTime()
                      )[0]
                      const nextStartDate = new Date(lastCycle.cycleEnd)
                      nextStartDate.setDate(nextStartDate.getDate() + 1)
                      return nextStartDate.toLocaleDateString()
                    })()} with automatic leave allocations`
                    : 'Create the first employment cycle with default leave allocations'
                }
              </p>
            </DialogHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cycle-start" className="text-sm font-medium text-gray-700">Cycle Start Date</Label>
                  <Input
                    id="cycle-start"
                    type="date"
                    value={cycleFormData.cycleStart}
                    onChange={(e) => setCycleFormData({ ...cycleFormData, cycleStart: e.target.value })}
                    className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    <p>End date will be automatically set to 1 year from start date</p>
                  </div>
                </div>
                {employmentCycle && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="cycle-active"
                      checked={cycleFormData.isActive}
                      onCheckedChange={(checked) => setCycleFormData({ ...cycleFormData, isActive: checked })}
                    />
                    <Label htmlFor="cycle-active" className="text-sm font-medium text-gray-700">
                      Active Cycle
                    </Label>
                  </div>
                )}
              </div>

              {!employmentCycle && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-blue-900">Default Leave Allocations:</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• Vacation Days: 30 days</p>
                    <p>• Sick Leave: 10 days</p>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    Leave balances will be automatically created with these defaults
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCycleModal(false)
                  setCycleFormData({ cycleStart: '', isActive: true })
                }}
                className="border-gray-200 hover:bg-gray-50 rounded-xl"
                disabled={isCreatingCycle}
              >
                Cancel
              </Button>
              <Button
                onClick={employmentCycle ? handleUpdateCycle : handleCreateCycle}
                disabled={isCreatingCycle}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {isCreatingCycle ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {employmentCycle ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    {employmentCycle ? 'Update Cycle' : 'Create Cycle'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}