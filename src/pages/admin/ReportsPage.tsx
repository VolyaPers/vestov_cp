import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  Briefcase,
  Activity,
  Calendar,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { getDatePreset, type DatePreset } from '@/lib/datePresets'

interface Client {
  id: number
  name: string
  createdAt: string
  isActive?: boolean
}

interface TeamMember {
  id: number
  name: string
  startDate?: string
  status: string
  billable?: boolean
  clientId?: number
}

interface Invoice {
  id: number
  clientId: number
  client?: { name: string }
  amount: number
  total: number
  status: string
  invoiceDate: string
  paidAt?: string
  periodStart?: string
  periodEnd?: string
}

interface ClientService {
  id: number
  clientId: number
  serviceTypeId: number
  isActive: boolean
  startDate?: string
  endDate?: string
}

const COLORS = ['#635bff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export function ReportsPage() {
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth')
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [granularity, setGranularity] = useState<'month' | 'quarter' | 'year'>('month')

  // Update date range when preset changes
  useEffect(() => {
    const range = getDatePreset(datePreset)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }, [datePreset])

  // Fetch all necessary data
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: teamMembers = [], isLoading: isLoadingTeam } = useQuery<TeamMember[]>({
    queryKey: ['teamMembers'],
    queryFn: () => api.request('/admin/team-members'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: allInvoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['allInvoices'],
    queryFn: async () => {
      const clientsList = await api.getClients()
      const invoicePromises = clientsList.map((client: Client) =>
        api.getClientInvoices(client.id).catch(() => [])
      )
      const invoicesByClient = await Promise.all(invoicePromises)
      return invoicesByClient.flat()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: clientServices = [], isLoading: isLoadingServices } = useQuery<ClientService[]>({
    queryKey: ['clientServices'],
    queryFn: () => api.request('/services/client-services'),
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = isLoadingClients || isLoadingTeam || isLoadingInvoices || isLoadingServices

  // Filter data based on selected client and date range
  const filteredInvoices = useMemo(() => {
    let filtered = allInvoices

    if (selectedClient !== 'all') {
      filtered = filtered.filter((inv) => inv.clientId === parseInt(selectedClient))
    }

    filtered = filtered.filter((inv) => {
      const invDate = new Date(inv.invoiceDate || inv.periodStart || '')
      const start = new Date(startDate)
      const end = new Date(endDate)
      return invDate >= start && invDate <= end
    })

    return filtered
  }, [allInvoices, selectedClient, startDate, endDate])

  const filteredTeamMembers = useMemo(() => {
    let filtered = teamMembers

    if (selectedClient !== 'all') {
      filtered = filtered.filter((member) => member.clientId === parseInt(selectedClient))
    }

    return filtered
  }, [teamMembers, selectedClient])

  const filteredServices = useMemo(() => {
    let filtered = clientServices

    if (selectedClient !== 'all') {
      filtered = filtered.filter((service) => service.clientId === parseInt(selectedClient))
    }

    return filtered
  }, [clientServices, selectedClient])

  // Aggregation functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const aggregateByPeriod = (data: Invoice[], period: 'month' | 'quarter' | 'year') => {
    const grouped: { [key: string]: { date: string; revenue: number; count: number } } = {}

    data.forEach((item) => {
      const date = new Date(item.invoiceDate || item.periodStart || '')
      let key: string

      if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (period === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
      } else {
        key = `${date.getFullYear()}`
      }

      if (!grouped[key]) {
        grouped[key] = { date: key, revenue: 0, count: 0 }
      }

      if (item.status === 'paid') {
        grouped[key].revenue += item.total || item.amount || 0
        grouped[key].count += 1
      }
    })

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
  }

  const calculateTeamGrowth = (members: TeamMember[]) => {
    const growthData: { [key: string]: { date: string; count: number } } = {}

    members.forEach((member) => {
      if (!member.startDate) return

      const date = new Date(member.startDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!growthData[key]) {
        growthData[key] = { date: key, count: 0 }
      }
      growthData[key].count += 1
    })

    // Calculate cumulative sum
    const sorted = Object.values(growthData).sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    return sorted.map((item) => {
      cumulative += item.count
      return { date: item.date, teamSize: cumulative, newMembers: item.count }
    })
  }

  const calculateClientGrowth = (clientsList: Client[]) => {
    const growthData: { [key: string]: { date: string; count: number } } = {}

    clientsList.forEach((client) => {
      if (!client.createdAt) return

      const date = new Date(client.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!growthData[key]) {
        growthData[key] = { date: key, count: 0 }
      }
      growthData[key].count += 1
    })

    // Calculate cumulative sum
    const sorted = Object.values(growthData).sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    return sorted.map((item) => {
      cumulative += item.count
      return { date: item.date, totalClients: cumulative, newClients: item.count }
    })
  }

  // KPI Calculations
  const revenueData = useMemo(() => aggregateByPeriod(filteredInvoices, granularity), [filteredInvoices, granularity])
  const teamGrowthData = useMemo(() => calculateTeamGrowth(filteredTeamMembers), [filteredTeamMembers])
  const clientGrowthData = useMemo(() => {
    // When filtering by specific client, client growth doesn't make sense
    // Show all clients growth instead
    return calculateClientGrowth(clients)
  }, [clients, selectedClient])

  const totalRevenue = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0)

  const previousPeriodStart = new Date(startDate)
  previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1)
  const previousPeriodEnd = new Date(endDate)
  previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() - 1)

  const previousRevenue = allInvoices
    .filter((inv) => {
      const invDate = new Date(inv.invoiceDate || inv.periodStart || '')
      return invDate >= previousPeriodStart && invDate <= previousPeriodEnd && inv.status === 'paid'
    })
    .reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0)

  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0

  const activeClients = selectedClient === 'all'
    ? clients.filter((c) => c.isActive !== false).length
    : 1

  const activeTeamMembers = filteredTeamMembers.filter((m) => m.status === 'active').length

  const activeServices = filteredServices.filter((s) => s.isActive).length

  // Revenue by client for bar chart
  const revenueByClient = useMemo(() => {
    const clientRevenue: { [key: number]: { name: string; revenue: number } } = {}

    filteredInvoices.forEach((inv) => {
      if (inv.status !== 'paid') return

      if (!clientRevenue[inv.clientId]) {
        const client = clients.find((c) => c.id === inv.clientId)
        clientRevenue[inv.clientId] = {
          name: client?.name || `Client ${inv.clientId}`,
          revenue: 0,
        }
      }

      clientRevenue[inv.clientId].revenue += inv.total || inv.amount || 0
    })

    return Object.values(clientRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredInvoices, clients])

  // Invoice status distribution
  const invoiceStatusData = useMemo(() => {
    const statusCounts = { paid: 0, sent: 0, draft: 0, overdue: 0 }

    filteredInvoices.forEach((inv) => {
      if (inv.status === 'paid') {
        statusCounts.paid++
      } else if (inv.status === 'sent') {
        const now = new Date()
        // Simple overdue check - in production you'd check against due date
        statusCounts.sent++
      } else {
        statusCounts.draft++
      }
    })

    return [
      { name: 'Paid', value: statusCounts.paid, color: '#10b981' },
      { name: 'Sent', value: statusCounts.sent, color: '#f59e0b' },
      { name: 'Draft', value: statusCounts.draft, color: '#6b7280' },
    ].filter((item) => item.value > 0)
  }, [filteredInvoices])

  // Team status distribution
  const teamStatusData = useMemo(() => {
    const statusCounts: { [key: string]: number } = {}

    filteredTeamMembers.forEach((member) => {
      const status = member.status || 'unknown'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    return Object.entries(statusCounts).map(([name, value], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[index % COLORS.length],
    }))
  }, [filteredTeamMembers])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">Reports & Analytics</h1>
            <p className="stripe-text-secondary text-lg">
              Comprehensive insights into revenue, team growth, and client metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="stripe-card p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 stripe-text-muted" />
            <span className="text-sm font-medium stripe-text-secondary">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm stripe-text-secondary">Client:</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {isLoadingClients && (
                  <SelectItem value="loading">
                    Loading clients...
                  </SelectItem>
                )}
                {!isLoadingClients && clients.length === 0 && (
                  <SelectItem value="none">
                    No clients found
                  </SelectItem>
                )}
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm stripe-text-secondary">Period:</label>
            <Select value={datePreset} onValueChange={(val) => setDatePreset(val as DatePreset)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="allTime">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm stripe-text-secondary">Granularity:</label>
            <Select value={granularity} onValueChange={(val) => setGranularity(val as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(totalRevenue)}</div>
          <div className="text-sm text-gray-500 mb-2">Total Revenue</div>
          <div className={`flex items-center gap-1 text-sm ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {revenueGrowth >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(revenueGrowth).toFixed(1)}% vs previous period
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{activeTeamMembers}</div>
          <div className="text-sm text-gray-500 mb-2">Active Team Members</div>
          <div className="text-sm text-gray-600">
            {filteredTeamMembers.filter((m) => m.billable).length} billable
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{activeClients}</div>
          <div className="text-sm text-gray-500 mb-2">Active Clients</div>
          <div className="text-sm text-gray-600">
            {activeClients > 0 ? formatCurrency(totalRevenue / activeClients) : '$0'} avg revenue
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{activeServices}</div>
          <div className="text-sm text-gray-500 mb-2">Active Services</div>
          <div className="text-sm text-gray-600">
            Across {selectedClient === 'all' ? activeClients : 1} {activeClients === 1 ? 'client' : 'clients'}
          </div>
        </div>
      </div>

      {/* Tabs with Charts */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="stripe-card p-6">
            <h3 className="text-lg font-semibold stripe-text-primary mb-4">Revenue Growth</h3>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No revenue data available for selected period</p>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Team Growth</h3>
              {teamGrowthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={teamGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="teamSize" stroke="#635bff" strokeWidth={2} name="Team Size" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No team growth data available</p>
                </div>
              )}
            </div>

            <div className="stripe-card p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold stripe-text-primary">Client Acquisition</h3>
                <p className="text-xs stripe-text-muted mt-1">
                  Note: Shows all clients regardless of filter selection
                </p>
              </div>
              {clientGrowthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={clientGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="totalClients" stroke="#8b5cf6" strokeWidth={2} name="Total Clients" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No client data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Revenue Analytics Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="stripe-card p-6">
            <h3 className="text-lg font-semibold stripe-text-primary mb-4">Revenue Trend</h3>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No revenue data available</p>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Top Clients by Revenue</h3>
              {revenueByClient.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByClient} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" tickFormatter={formatCurrency} />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" width={120} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#635bff" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No client revenue data available</p>
                </div>
              )}
            </div>

            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Invoice Status Distribution</h3>
              {invoiceStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={invoiceStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {invoiceStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No invoice data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Team & Resources Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="stripe-card p-6">
            <h3 className="text-lg font-semibold stripe-text-primary mb-4">Team Size Over Time</h3>
            {teamGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={teamGrowthData}>
                  <defs>
                    <linearGradient id="colorTeam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635bff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#635bff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="teamSize"
                    stroke="#635bff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTeam)"
                    name="Team Size"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No team data available</p>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Team Status Distribution</h3>
              {teamStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={teamStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {teamStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No team status data available</p>
                </div>
              )}
            </div>

            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Key Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 stripe-surface rounded-lg">
                  <span className="text-sm font-medium stripe-text-secondary">Billable Members</span>
                  <span className="text-lg font-bold stripe-text-primary">
                    {filteredTeamMembers.filter((m) => m.billable).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 stripe-surface rounded-lg">
                  <span className="text-sm font-medium stripe-text-secondary">Non-Billable Members</span>
                  <span className="text-lg font-bold stripe-text-primary">
                    {filteredTeamMembers.filter((m) => !m.billable).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 stripe-surface rounded-lg">
                  <span className="text-sm font-medium stripe-text-secondary">Utilization Rate</span>
                  <span className="text-lg font-bold stripe-text-primary">
                    {filteredTeamMembers.length > 0
                      ? Math.round((filteredTeamMembers.filter((m) => m.billable).length / filteredTeamMembers.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Client Insights Tab */}
        <TabsContent value="clients" className="space-y-6">
          <div className="stripe-card p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold stripe-text-primary">Client Acquisition Timeline</h3>
              <p className="text-xs stripe-text-muted mt-1">
                Note: Shows all clients regardless of filter selection
              </p>
            </div>
            {clientGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={clientGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="newClients" fill="#8b5cf6" name="New Clients" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No client acquisition data available</p>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Active Services</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 stripe-surface rounded-lg">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{activeServices}</div>
                    <div className="text-sm text-gray-500">Total Active Services</div>
                  </div>
                  <Briefcase className="h-8 w-8 text-orange-600" />
                </div>
                <div className="flex items-center justify-between p-4 stripe-surface rounded-lg">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">
                      {activeServices > 0 && activeClients > 0 ? (activeServices / activeClients).toFixed(1) : '0'}
                    </div>
                    <div className="text-sm text-gray-500">Avg Services per Client</div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="stripe-card p-6">
              <h3 className="text-lg font-semibold stripe-text-primary mb-4">Client Portfolio</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 stripe-surface rounded-lg">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{activeClients}</div>
                    <div className="text-sm text-gray-500">Active Clients</div>
                  </div>
                  <Building2 className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex items-center justify-between p-4 stripe-surface rounded-lg">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">
                      {clients.filter((c) => c.isActive === false).length}
                    </div>
                    <div className="text-sm text-gray-500">Inactive Clients</div>
                  </div>
                  <Building2 className="h-8 w-8 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
