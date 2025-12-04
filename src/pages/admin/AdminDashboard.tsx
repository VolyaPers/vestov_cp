import { useQuery } from '@tanstack/react-query'
import {
  Users,
  UserCheck,
  Clock,
  Building,
  TrendingUp,
  Calendar,
  Activity,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Target,
  Zap,
  BarChart3,
  Briefcase,
  Receipt
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export function AdminDashboard() {
  // Fetch dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: api.getAdminDashboard,
  })

  // Fetch active shifts
  const { data: activeShifts = [] } = useQuery({
    queryKey: ['activeShifts'],
    queryFn: api.getAdminActiveShifts,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch clients to count active projects
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: api.getClients,
  })

  // Fetch leave requests for pending count
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: api.getLeaveRequests,
  })

  // Fetch all invoices to calculate paid this month
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['allInvoices'],
    queryFn: async () => {
      // Get all clients and their invoices
      const clientsList = await api.getClients()
      const invoicePromises = clientsList.map((client: any) =>
        api.getClientInvoices(client.id).catch(() => [])
      )
      const invoicesByClient = await Promise.all(invoicePromises)
      return invoicesByClient.flat()
    },
  })

  // Calculate paid invoices this month
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const paidThisMonth = allInvoices.filter((invoice: any) => {
    if (invoice.status !== 'paid') return false
    const paidDate = invoice.paidDate ? new Date(invoice.paidDate) : null
    if (!paidDate) return false
    return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear
  })

  const totalPaidAmount = paidThisMonth.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0)

  // Calculate stats
  const stats = {
    totalClients: clients.length || 0,
    totalTeamMembers: dashboardData?.totalTeamMembers || 0,
    activeTeamMembers: dashboardData?.activeTeamMembers || 0,
    pendingLeaveRequests: leaveRequests.filter((req: any) => req.request?.status === 'pending').length || 0,
    employeesOnShift: activeShifts.length || 0,
    activeProjects: clients.filter((client: any) => client.isActive !== false).length || 0,
    paidInvoicesCount: paidThisMonth.length,
    paidInvoicesTotal: totalPaidAmount,
  }

  console.log('Dashboard Stats:', {
    activeShifts: activeShifts.length,
    shiftsData: activeShifts,
    paidThisMonth: paidThisMonth.length,
    totalPaid: totalPaidAmount,
    activeProjects: stats.activeProjects,
  })

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Dashboard
            </h1>
            <p className="stripe-text-secondary text-lg">
              Welcome back! Here's what's happening at Vestov today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="stripe-badge-success">
              <CheckCircle className="h-4 w-4 mr-2" />
              All Systems Online
            </div>
            <button className="stripe-btn-primary">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Reports
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics - Stripe style cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Building className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.totalClients || 0}</div>
              <div className="text-sm stripe-text-secondary">Active Clients</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Active partnerships</div>
            <div className="stripe-badge-success">
              <TrendingUp className="h-3 w-3 mr-1" />
              +0%
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Users className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.totalTeamMembers || 0}</div>
              <div className="text-sm stripe-text-secondary">Team Members</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Total workforce</div>
            <div className="stripe-badge-success">
              <TrendingUp className="h-3 w-3 mr-1" />
              +0%
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <UserCheck className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.activeTeamMembers || 0}</div>
              <div className="text-sm stripe-text-secondary">Active Members</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Currently assigned</div>
            <div className="stripe-badge-success">
              <Target className="h-3 w-3 mr-1" />
              {stats.activeTeamMembers && stats.totalTeamMembers
                ? Math.round((stats.activeTeamMembers / stats.totalTeamMembers) * 100)
                : 0
              }%
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Clock className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.pendingLeaveRequests || 0}</div>
              <div className="text-sm stripe-text-secondary">Pending Requests</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Awaiting approval</div>
            <div className="stripe-badge-neutral">
              <Calendar className="h-3 w-3 mr-1" />
              Leave
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Activity className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.employeesOnShift || 0}</div>
              <div className="text-sm stripe-text-secondary">On Shift Now</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Currently working</div>
            <div className="stripe-badge-success">
              <Zap className="h-3 w-3 mr-1" />
              Live
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Receipt className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">
                ${(stats.paidInvoicesTotal || 0).toLocaleString()}
              </div>
              <div className="text-sm stripe-text-secondary">Paid This Month</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Invoice payments</div>
            <div className="stripe-badge-success">
              <DollarSign className="h-3 w-3 mr-1" />
              {stats.paidInvoicesCount || 0}
            </div>
          </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Briefcase className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{stats.activeProjects || 0}</div>
              <div className="text-sm stripe-text-secondary">Active Projects</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm stripe-text-muted">Running projects</div>
            <div className="stripe-badge-success">
              <TrendingUp className="h-3 w-3 mr-1" />
              {stats.totalClients ? Math.round((stats.activeProjects / stats.totalClients) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 stripe-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold stripe-text-primary">Recent Activity</h3>
              <p className="text-sm stripe-text-secondary">Latest updates across your organization</p>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 stripe-text-muted" />
              <span className="text-sm stripe-text-muted">Live updates</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 stripe-surface rounded-lg stripe-border">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--stripe-primary)', color: 'white' }}>
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium stripe-text-primary">Team overview page updated</p>
                <p className="text-xs stripe-text-muted mt-1">Modern UI design applied • Just now</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 stripe-surface rounded-lg stripe-border">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--stripe-success)', color: 'white' }}>
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium stripe-text-primary">System health check completed</p>
                <p className="text-xs stripe-text-muted mt-1">All services operational • 5 minutes ago</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 stripe-surface rounded-lg stripe-border">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--stripe-warning)', color: 'white' }}>
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium stripe-text-primary">Platform UI redesign in progress</p>
                <p className="text-xs stripe-text-muted mt-1">Modernizing admin interface • 10 minutes ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats & Actions */}
        <div className="space-y-6">
          <div className="stripe-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg stripe-surface flex items-center justify-center">
                <BarChart3 className="h-5 w-5 stripe-text-muted" />
              </div>
              <div>
                <h3 className="text-lg font-semibold stripe-text-primary">Performance</h3>
                <p className="text-sm stripe-text-secondary">Key metrics</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 stripe-surface rounded-lg">
                <span className="text-sm font-medium stripe-text-secondary">Utilization Rate</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 rounded-full overflow-hidden stripe-border" style={{ backgroundColor: 'var(--stripe-border-light)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: 'var(--stripe-primary)',
                        width: `${stats.activeTeamMembers && stats.totalTeamMembers
                          ? (stats.activeTeamMembers / stats.totalTeamMembers) * 100
                          : 0
                        }%`
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold stripe-text-primary">
                    {stats.activeTeamMembers && stats.totalTeamMembers
                      ? Math.round((stats.activeTeamMembers / stats.totalTeamMembers) * 100)
                      : 0
                    }%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 stripe-surface rounded-lg">
                <span className="text-sm font-medium stripe-text-secondary">Avg Team Size</span>
                <span className="text-sm font-bold stripe-text-primary">
                  {stats.totalClients > 0
                    ? Math.round((stats.activeTeamMembers || 0) / stats.totalClients)
                    : 0
                  } members
                </span>
              </div>
            </div>
          </div>

          <div className="stripe-card p-6" style={{ border: '2px solid var(--stripe-border)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg stripe-surface flex items-center justify-center">
                <DollarSign className="h-5 w-5 stripe-text-muted" />
              </div>
              <div>
                <h3 className="text-lg font-semibold stripe-text-primary">Revenue Tracking</h3>
                <p className="stripe-text-muted text-sm">Coming Soon</p>
              </div>
            </div>
            <p className="stripe-text-secondary text-sm">
              Advanced analytics and revenue tracking features will be available in the next update.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}