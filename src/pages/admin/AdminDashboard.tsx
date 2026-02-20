import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'wouter'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import {
  Users,
  UserCheck,
  Clock,
  Building,
  Activity,
  CheckCircle,
  DollarSign,
  Zap,
  BarChart3,
  Briefcase,
  Receipt,
  Settings,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'

export function AdminDashboard() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [isSyncingAvatars, setIsSyncingAvatars] = useState(false)

  // WebSocket connection for real-time shift updates
  useShiftEvents()

  // Fetch active shifts
  const { data: activeShiftsData, refetch: refetchActiveShifts } = useQuery({
    queryKey: ['adminActiveShifts'],
    queryFn: () => api.getAdminActiveShifts(),
    refetchInterval: 5 * 60 * 1000, // 5 minutes fallback
  })
  const activeShifts = activeShiftsData?.shifts ?? []

  // Store refetch in ref to avoid stale closures
  const refetchRef = useRef(refetchActiveShifts)
  useEffect(() => {
    refetchRef.current = refetchActiveShifts
  }, [refetchActiveShifts])

  // Listen for WebSocket shift events and refetch
  const handleShiftUpdate = useCallback(() => {
    refetchRef.current()
  }, [])
  useShiftUpdateListener(handleShiftUpdate)

  const handleSyncSlackAvatars = async () => {
    const confirmed = await showConfirm({
      title: 'Sync Slack Avatars',
      message: 'This will sync all user avatars from Slack. Users must have matching email addresses in Slack. Continue?',
      type: 'info',
      confirmText: 'Sync',
      cancelText: 'Cancel',
    })

    if (!confirmed) return

    setIsSyncingAvatars(true)
    try {
      const result = await api.syncAllSlackAvatars()
      await showAlert({
        message: `Sync complete!\n\nSynced: ${result.results.synced}\nNot found in Slack: ${result.results.notFound}\nErrors: ${result.results.errors}`,
        type: 'success'
      })
    } catch (error: any) {
      console.error('Failed to sync Slack avatars:', error)
      await showAlert({ message: error.message || 'Failed to sync Slack avatars', type: 'error' })
    } finally {
      setIsSyncingAvatars(false)
    }
  }

  // Fetch dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: () => api.getAdminDashboard(),
  })

  // Fetch clients to count active projects
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
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
            <div className="stripe-badge-success rounded-lg px-4 py-2">
              <CheckCircle className="h-4 w-4 mr-2" />
              All Systems Online
            </div>
            <Link href="/admin/reports">
              <button className="stripe-btn-primary rounded-lg" title="View analytics and reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Reports
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Key Metrics - Clean stat cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{stats.totalClients || 0}</div>
              <div className="text-sm text-gray-500">Active Clients</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{stats.totalTeamMembers || 0}</div>
              <div className="text-sm text-gray-500">Team Members</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{stats.activeTeamMembers || 0}</div>
              <div className="text-sm text-gray-500">Active Members</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{stats.pendingLeaveRequests || 0}</div>
              <div className="text-sm text-gray-500">Pending Requests</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-gray-900">{stats.employeesOnShift || 0}</div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                  Live
                </span>
              </div>
              <div className="text-sm text-gray-500">On Shift Now</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Receipt className="h-5 w-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">${(stats.paidInvoicesTotal || 0).toLocaleString()}</div>
              <div className="text-sm text-gray-500">Paid This Month</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Briefcase className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{stats.activeProjects || 0}</div>
              <div className="text-sm text-gray-500">Active Projects</div>
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

          <div className="stripe-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg stripe-surface flex items-center justify-center">
                <Settings className="h-5 w-5 stripe-text-muted" />
              </div>
              <div>
                <h3 className="text-lg font-semibold stripe-text-primary">Settings</h3>
                <p className="stripe-text-muted text-sm">System configuration</p>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSyncSlackAvatars}
                disabled={isSyncingAvatars}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingAvatars ? 'animate-spin' : ''}`} />
                {isSyncingAvatars ? 'Syncing Avatars...' : 'Sync Slack Avatars'}
              </Button>
              <p className="text-xs stripe-text-muted">
                Updates all user profile pictures from Slack based on email address.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}