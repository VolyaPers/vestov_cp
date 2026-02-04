import { useState, useEffect } from 'react'
import { Calendar, FileText, Clock, Check, X, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format, differenceInDays, parseISO } from 'date-fns'
import { api } from '@/lib/api'
import { useCustomAlert } from '@/components/ui/custom-alert'

interface LeaveBalance {
  leaveTypeName: string
  totalDays: number
  usedDays: number
  pendingDays: number
  availableDays: number
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
}

export function EmployeeLeaveRequest() {
  const { showAlert } = useCustomAlert()
  const [teamMemberId, setTeamMemberId] = useState<number | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Get current user info
      const userData = await api.getCurrentUser()
      if (!userData) throw new Error('Failed to fetch user')

      // Get team member by email
      const teamData = await api.getTeamMembers()
      const member = teamData.find((tm: any) => tm.email === userData.email)

      if (!member) {
        console.error('Team member not found')
        return
      }

      setTeamMemberId(member.id)

      // Load leave balances
      try {
        let balancesData
        try {
          balancesData = await api.request(`/vacation/balances/${member.id}`)
        } catch (error: any) {
          // Silently handle missing employment cycle - it's a valid state, not an error
          if (error?.message?.includes('No active employment cycle found')) {
            balancesData = { balances: [] }
          } else {
            throw error
          }
        }
        setLeaveBalances(balancesData)
      } catch (error) {
        console.error('Failed to load balances:', error)
      }

      // Load leave requests
      try {
        const requestsData = await api.request(`/vacation/requests?employeeId=${member.id}`)
        setLeaveRequests(requestsData)
      } catch (error) {
        console.error('Failed to load requests:', error)
      }

      // Load leave types
      const typesData = await api.getLeaveTypes()
      setLeaveTypes(typesData)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamMemberId || !formData.leaveTypeId || !formData.startDate || !formData.endDate) {
      showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      setSubmitting(true)

      await api.createLeaveRequest({
        employeeId: teamMemberId,
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

      showAlert({ message: 'Leave request submitted successfully!', type: 'success' })
    } catch (error) {
      console.error('Error submitting leave request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit leave request. Please try again.'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const start = parseISO(formData.startDate)
    const end = parseISO(formData.endDate)
    return differenceInDays(end, start) + 1
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const requestedDays = calculateDays()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Leave Request</h1>
        <p className="text-gray-500 mt-1">Request time off and manage your leave</p>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaveBalances.filter(lb => lb.leaveTypeName === 'Vacation' || lb.leaveTypeName === 'Sick Leave').map((balance) => (
          <Card key={balance.leaveTypeName} className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">{balance.leaveTypeName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Total:</span>
                  <span className="font-semibold text-blue-900">{balance.totalDays} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Used:</span>
                  <span className="font-semibold text-blue-900">{balance.usedDays} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Pending:</span>
                  <span className="font-semibold text-blue-900">{balance.pendingDays} days</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
                  <span className="text-blue-700 font-medium">Available:</span>
                  <span className="font-bold text-blue-900">{balance.availableDays} days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request Form */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>New Leave Request</CardTitle>
          <CardDescription>Submit a request for time off</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Days */}
              <div>
                <Label>Total Days</Label>
                <Input
                  value={requestedDays > 0 ? `${requestedDays} days` : 'Select dates'}
                  disabled
                  className="bg-gray-50"
                />
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
                  min={formData.startDate}
                  required
                />
              </div>

              {/* Reason */}
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

      {/* Previous Requests */}
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
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{request.leaveTypeName}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(request.startDate), 'MMM d, yyyy')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {request.totalDays} {request.totalDays === 1 ? 'day' : 'days'}
                      </div>
                    </div>
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
    </div>
  )
}
