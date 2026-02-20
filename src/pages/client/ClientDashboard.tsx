import { useQuery } from '@tanstack/react-query'
import { Users, Settings, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

export function ClientDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['client', 'dashboard'],
    queryFn: () => api.getClientDashboard(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const { client, stats, recentRequests } = dashboardData || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {client?.contactPerson}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {client?.name} - {client?.industry}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTeamMembers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Assigned developers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeServices || 0}</div>
            <p className="text-xs text-muted-foreground">
              Running projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-muted-foreground">
              Until {client?.contractEnd ? formatDate(client.contractEnd) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Services</CardTitle>
            <CardDescription>Active project services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {client?.activeServices?.length ? (
                client.activeServices.map((service: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">{service}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active services</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Latest service requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRequests?.length ? (
                recentRequests.slice(0, 3).map((request: any) => (
                  <div key={request.id} className="flex items-start space-x-3">
                    <div className={`mt-1 h-2 w-2 rounded-full ${
                      request.status === 'approved' ? 'bg-green-500' :
                      request.status === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {request.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(request.requestDate)} • {request.status}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent requests</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
          <CardDescription>Current contract information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Contract Type</p>
              <p className="text-sm text-gray-600 capitalize">{client?.contractType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Billing Cycle</p>
              <p className="text-sm text-gray-600 capitalize">{client?.billingCycle}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Team Size</p>
              <p className="text-sm text-gray-600">{client?.teamSize || 0} members</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}