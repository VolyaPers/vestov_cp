import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, Users, Plus, Check, X, Edit, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function VacationPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const queryClient = useQueryClient()

  const { data: leaveRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['admin', 'leave-requests'],
    queryFn: api.getLeaveRequests,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['admin', 'leave-types'],
    queryFn: api.getLeaveTypes,
  })

  // Mutations for leave request actions
  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.approveLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leave-requests'] })
    },
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.denyLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leave-requests'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.cancelLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leave-requests'] })
    },
  })

  const filteredRequests = leaveRequests?.filter((request: any) => {
    const matchesSearch = !searchTerm || 
      request.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.leaveTypeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    
    return matchesSearch && matchesStatus
  }) || []

  // Filter requests for today
  const todayRequests = leaveRequests?.filter((request: any) => {
    const today = new Date().toISOString().split('T')[0]
    return request.status === 'approved' && 
           request.startDate <= today && 
           request.endDate >= today
  }) || []

  // Filter requests for this week
  const thisWeekRequests = leaveRequests?.filter((request: any) => {
    const today = new Date()
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
    const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6))
    const startDate = new Date(request.startDate)
    
    return request.status === 'approved' && 
           startDate >= weekStart && 
           startDate <= weekEnd
  }) || []

  const handleApprove = (requestId: string) => {
    approveMutation.mutate({ id: requestId })
  }

  const handleDeny = (requestId: string) => {
    denyMutation.mutate({ id: requestId, reason: 'Denied by admin' })
  }

  const handleCancel = (requestId: string) => {
    cancelMutation.mutate({ id: requestId, reason: 'Canceled by admin' })
  }

  if (requestsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vacation Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete leave management in a single consolidated view
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Request Leave
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requests" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Leave Requests</span>
          </TabsTrigger>
          <TabsTrigger value="today" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Today's Time Off</span>
          </TabsTrigger>
          <TabsTrigger value="week" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>This Week's Time Off</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Team Calendar</span>
          </TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by employee, leave type, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
              >
                Approved
              </Button>
              <Button
                variant={statusFilter === 'denied' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('denied')}
              >
                Denied
              </Button>
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((request: any) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.employeeAvatar} alt={request.employeeName} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {request.employeeName?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.employeeName}
                          </h3>
                          <p className="text-sm text-gray-600">{request.employeeRole}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            {
                              'bg-yellow-100 text-yellow-800': request.status === 'pending',
                              'bg-green-100 text-green-800': request.status === 'approved',
                              'bg-red-100 text-red-800': request.status === 'denied',
                              'bg-gray-100 text-gray-800': request.status === 'canceled',
                            }
                          )}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Leave Type</p>
                          <p className="text-sm text-gray-600">{request.leaveTypeName}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Dates</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Duration</p>
                          <p className="text-sm text-gray-600">
                            {request.daysCount} {parseFloat(request.daysCount) === 1 ? 'day' : 'days'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Requested</p>
                          <p className="text-sm text-gray-600">{formatDate(request.createdAt)}</p>
                        </div>
                      </div>
                      
                      {request.reason && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-900">Reason</p>
                          <p className="text-sm text-gray-600">{request.reason}</p>
                        </div>
                      )}
                      
                      {/* Half day indicators */}
                      {(request.halfDayStart || request.halfDayEnd) && (
                        <div className="mt-2">
                          <div className="flex items-center space-x-2 text-xs text-blue-600">
                            {request.halfDayStart && <span>Half day start</span>}
                            {request.halfDayEnd && <span>Half day end</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {request.status === 'pending' && (
                    <div className="mt-4 flex items-center space-x-2 pt-4 border-t">
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
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  )}
                  
                  {request.status === 'approved' && (
                    <div className="mt-4 flex items-center space-x-2 pt-4 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(request.id)}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {filteredRequests.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No leave requests found
                  </h3>
                  <p className="text-sm text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? "Try adjusting your search or filters"
                      : "Leave requests will appear here once submitted"
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Today's Time Off Tab */}
        <TabsContent value="today" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employees on Leave Today</CardTitle>
              <CardDescription>Team members currently taking time off</CardDescription>
            </CardHeader>
            <CardContent>
              {todayRequests.length > 0 ? (
                <div className="space-y-4">
                  {todayRequests.map((request: any) => (
                    <div key={request.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.employeeAvatar} alt={request.employeeName} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {request.employeeName?.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{request.employeeName}</h4>
                        <p className="text-sm text-gray-600">{request.employeeRole}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{request.leaveTypeName}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No one is on leave today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* This Week's Time Off Tab */}
        <TabsContent value="week" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>This Week's Time Off</CardTitle>
              <CardDescription>Upcoming leave for the current week</CardDescription>
            </CardHeader>
            <CardContent>
              {thisWeekRequests.length > 0 ? (
                <div className="space-y-4">
                  {thisWeekRequests.map((request: any) => (
                    <div key={request.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.employeeAvatar} alt={request.employeeName} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {request.employeeName?.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{request.employeeName}</h4>
                        <p className="text-sm text-gray-600">{request.employeeRole}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{request.leaveTypeName}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.daysCount} {parseFloat(request.daysCount) === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No leave scheduled for this week</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Calendar View</CardTitle>
              <CardDescription>Visual calendar with color-coded leave types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Calendar className="mx-auto h-16 w-16 opacity-50 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Calendar View Coming Soon
                </h3>
                <p className="text-sm">
                  Visual calendar with week/month navigation and color-coded leave types will be available here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}