import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Link } from 'wouter'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  Receipt,
  RefreshCw,
  Settings,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Users2,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface DashboardStatsResponse {
  stats?: {
    totalClients?: number | string
    totalTeamMembers?: number | string
    activeTeamMembers?: number | string
    pendingLeaveRequests?: number | string
  }
}

interface TeamMemberDashboard {
  id: number
  name?: string
  status?: string
  isBillable?: boolean
}

interface ClientDashboard {
  id: number
  name: string
  status?: string
  isActive?: boolean
  createdAt?: string
}

interface InvoiceDashboard {
  id: number
  clientId: number
  clientName?: string
  invoiceNumber?: string
  amount?: number | string
  total?: number | string
  status?: string
  invoiceDate?: string
  dueDate?: string | null
  paidAt?: string | null
}

interface LeaveDashboard {
  status?: string
  request?: {
    status?: string
  }
}

interface ReimbursementDashboard {
  id: number
  status?: string
  evidenceUrl?: string | null
}

interface FinanceOverview {
  monthlyBreakdown?: Array<{
    month: number
    year: number
    income: number
    expense: number
    salary: number
    extra_payment: number
    client_payments: number
  }>
}

interface FinanceBalances {
  stripe: { available: number; pending: number; currency: string } | null
  payoneer: { available: number; currency: string } | null
  fetchedAt: string
}

interface AdminLateShifts {
  lateShifts?: Array<{
    shift?: {
      lateMinutes?: number
    }
    employee?: {
      name?: string
    }
  }>
  missedShifts?: Array<{
    schedule?: {
      startTime?: string
    }
    employee?: {
      name?: string
    }
  }>
}

interface TopClientRow {
  clientId: number
  name: string
  revenue: number
  share: number
}

interface AlertItem {
  id: string
  level: 'high' | 'medium' | 'low'
  title: string
  detail: string
  href: string
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount)
}

function formatShortCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function daysDiff(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function KpiCard({
  title,
  value,
  hint,
  trend,
  trendPositive,
  icon,
}: {
  title: string
  value: string
  hint: string
  trend?: string
  trendPositive?: boolean
  icon: React.ReactNode
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
        <div className="flex min-h-[2.9rem] items-start justify-between gap-3.5 sm:min-h-[3.25rem] sm:items-center sm:gap-4">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] leading-4 text-muted-foreground sm:text-[0.7rem] sm:leading-5">{title}</p>
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/75 bg-white/76 text-primary shadow-[0_18px_32px_-24px_rgba(15,23,42,0.28)] sm:mt-0 sm:h-11 sm:w-11 sm:rounded-[1.05rem]">
            {icon}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end">
          <p className="font-display text-[1.8rem] font-semibold leading-none text-foreground sm:text-[2rem]">{value}</p>
          <p className="mt-2.5 text-sm text-muted-foreground sm:mt-3">{hint}</p>
          {trend && (
            <div
              className={cn(
                'mt-3 inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold sm:mt-4',
                trendPositive
                  ? 'border-emerald-200/80 bg-emerald-50/85 text-emerald-700'
                  : 'border-rose-200/80 bg-rose-50/85 text-rose-700'
              )}
            >
              {trendPositive ? <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 h-3.5 w-3.5" />}
              {trend}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminDashboard() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [isSyncingAvatars, setIsSyncingAvatars] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Real-time shift events
  useShiftEvents()

  const {
    data: activeShiftsData,
    refetch: refetchActiveShifts,
    isFetching: isFetchingActiveShifts,
  } = useQuery({
    queryKey: ['adminActiveShifts'],
    queryFn: () => api.getAdminActiveShifts(),
    refetchInterval: 5 * 60 * 1000,
  })

  const {
    data: lateShiftData,
    refetch: refetchLateShifts,
  } = useQuery<AdminLateShifts>({
    queryKey: ['adminLateShifts'],
    queryFn: () => api.getAdminLateShifts(),
    refetchInterval: 5 * 60 * 1000,
  })

  const {
    data: dashboardData,
    refetch: refetchDashboard,
    isLoading: isLoadingDashboard,
  } = useQuery<DashboardStatsResponse>({
    queryKey: ['adminDashboard'],
    queryFn: () => api.getAdminDashboard(),
  })

  const {
    data: clients = [],
    refetch: refetchClients,
    isLoading: isLoadingClients,
  } = useQuery<ClientDashboard[]>({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  })

  const {
    data: teamMembers = [],
    refetch: refetchTeamMembers,
    isLoading: isLoadingTeamMembers,
  } = useQuery<TeamMemberDashboard[]>({
    queryKey: ['teamMembersDashboard'],
    queryFn: () => api.getTeamMembers(),
  })

  const {
    data: leaveRequests = [],
    refetch: refetchLeaveRequests,
  } = useQuery<LeaveDashboard[]>({
    queryKey: ['leaveRequestsDashboard'],
    queryFn: () => api.getLeaveRequests(),
  })

  const {
    data: allInvoices = [],
    refetch: refetchInvoices,
    isLoading: isLoadingInvoices,
  } = useQuery<InvoiceDashboard[]>({
    queryKey: ['allInvoicesDashboard'],
    queryFn: () => api.getAllInvoices(),
  })

  const currentYear = new Date().getFullYear()
  const {
    data: financesOverview,
    refetch: refetchFinances,
    isLoading: isLoadingFinances,
  } = useQuery<FinanceOverview>({
    queryKey: ['financesOverviewDashboard', currentYear],
    queryFn: () => api.getFinancesOverview({
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
    }),
  })

  const {
    data: balances,
    refetch: refetchBalances,
  } = useQuery<FinanceBalances>({
    queryKey: ['financesBalancesDashboard'],
    queryFn: () => api.getFinancesBalances(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: reimbursements = [],
    refetch: refetchReimbursements,
  } = useQuery<ReimbursementDashboard[]>({
    queryKey: ['reimbursementsDashboard'],
    queryFn: () => api.request('/reimbursements') as Promise<ReimbursementDashboard[]>,
  })

  const activeShifts = activeShiftsData?.shifts ?? []

  // Keep shift refetchers fresh for websocket callback
  const shiftRefetchRef = useRef({
    refetchActiveShifts,
    refetchLateShifts,
  })

  useEffect(() => {
    shiftRefetchRef.current = {
      refetchActiveShifts,
      refetchLateShifts,
    }
  }, [refetchActiveShifts, refetchLateShifts])

  const handleShiftUpdate = useCallback(() => {
    shiftRefetchRef.current.refetchActiveShifts()
    shiftRefetchRef.current.refetchLateShifts()
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
        type: 'success',
      })
    } catch (error: any) {
      console.error('Failed to sync Slack avatars:', error)
      await showAlert({ message: error.message || 'Failed to sync Slack avatars', type: 'error' })
    } finally {
      setIsSyncingAvatars(false)
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.allSettled([
        refetchActiveShifts(),
        refetchLateShifts(),
        refetchDashboard(),
        refetchClients(),
        refetchTeamMembers(),
        refetchLeaveRequests(),
        refetchInvoices(),
        refetchFinances(),
        refetchBalances(),
        refetchReimbursements(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthStart = startOfMonth(previousMonthDate)
  const previousMonthEnd = endOfMonth(previousMonthDate)

  const normalizedInvoices = useMemo(() => {
    return allInvoices.map((invoice) => {
      const amount = toNumber(invoice.total ?? invoice.amount)
      return {
        id: invoice.id,
        clientId: invoice.clientId,
        clientName: invoice.clientName || `Client #${invoice.clientId}`,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
        amount,
        status: (invoice.status || 'draft').toLowerCase(),
        invoiceDate: toDate(invoice.invoiceDate),
        dueDate: toDate(invoice.dueDate),
        paidAt: toDate(invoice.paidAt),
      }
    })
  }, [allInvoices])

  const monthlyBreakdown = financesOverview?.monthlyBreakdown ?? []

  const financeSeries = useMemo(() => {
    const rows = [] as Array<{ label: string; revenue: number; burn: number; net: number; month: number; year: number }>

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = d.getMonth() + 1
      const year = d.getFullYear()
      const entry = monthlyBreakdown.find((row) => row.month === month && row.year === year)
      const revenue = entry ? toNumber(entry.client_payments) + toNumber(entry.income) : 0
      const burn = entry ? toNumber(entry.salary) + toNumber(entry.expense) : 0
      rows.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        revenue,
        burn,
        net: revenue - burn,
        month,
        year,
      })
    }

    return rows
  }, [monthlyBreakdown, now])

  const currentMonthFinance = financeSeries[financeSeries.length - 1]
  const previousMonthFinance = financeSeries[financeSeries.length - 2]

  const paidThisMonth = normalizedInvoices.filter((invoice) => {
    if (invoice.status !== 'paid' || !invoice.paidAt) return false
    return invoice.paidAt >= monthStart && invoice.paidAt <= monthEnd
  })

  const paidPreviousMonth = normalizedInvoices.filter((invoice) => {
    if (invoice.status !== 'paid' || !invoice.paidAt) return false
    return invoice.paidAt >= previousMonthStart && invoice.paidAt <= previousMonthEnd
  })

  const invoicedThisMonth = normalizedInvoices.filter((invoice) => {
    if (!invoice.invoiceDate) return false
    return invoice.invoiceDate >= monthStart && invoice.invoiceDate <= monthEnd
  })

  const paidThisMonthTotal = paidThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0)
  const paidPreviousMonthTotal = paidPreviousMonth.reduce((sum, invoice) => sum + invoice.amount, 0)
  const invoicedThisMonthTotal = invoicedThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0)

  const revenueGrowthPct = paidPreviousMonthTotal > 0
    ? ((paidThisMonthTotal - paidPreviousMonthTotal) / paidPreviousMonthTotal) * 100
    : paidThisMonthTotal > 0
      ? 100
      : 0

  const collectionEfficiency = invoicedThisMonthTotal > 0
    ? (paidThisMonthTotal / invoicedThisMonthTotal) * 100
    : 0

  const outstandingInvoices = normalizedInvoices.filter((invoice) =>
    invoice.status === 'sent' || invoice.status === 'overdue'
  )
  const outstandingReceivables = outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  const overdueInvoices = normalizedInvoices.filter((invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'draft') {
      return false
    }

    if (invoice.status === 'overdue') return true

    if (!invoice.dueDate) return false
    return invoice.dueDate < now
  })

  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  const avgCollectionDays = (() => {
    const valid = normalizedInvoices
      .filter((invoice) => invoice.status === 'paid' && invoice.invoiceDate && invoice.paidAt)
      .map((invoice) => daysDiff(invoice.invoiceDate as Date, invoice.paidAt as Date))

    if (valid.length === 0) return 0
    return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
  })()

  const activeClients = clients.filter((client) => {
    if (typeof client.isActive === 'boolean') {
      return client.isActive
    }
    return (client.status || '').toLowerCase() !== 'inactive'
  }).length

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const newClientsThisQuarter = clients.filter((client) => {
    const created = toDate(client.createdAt)
    return created ? created >= quarterStart : false
  }).length

  const totalTeamMembers = toNumber(dashboardData?.stats?.totalTeamMembers ?? teamMembers.length)
  const activeTeamMembers = toNumber(
    dashboardData?.stats?.activeTeamMembers ?? teamMembers.filter((member) => member.status === 'active').length
  )

  const benchMembers = teamMembers.filter((member) => member.status === 'bench').length
  const unavailableMembers = teamMembers.filter((member) => member.status === 'unavailable').length
  const billableMembers = teamMembers.filter((member) => member.isBillable === true).length

  const utilizationRate = totalTeamMembers > 0
    ? (activeTeamMembers / totalTeamMembers) * 100
    : 0

  const billableRate = totalTeamMembers > 0
    ? (billableMembers / totalTeamMembers) * 100
    : 0

  const pendingLeaveRequests = leaveRequests.filter((request) => {
    const status = request?.request?.status || request?.status
    return status === 'pending'
  }).length

  const pendingReimbursements = reimbursements.filter((request) => request.status === 'pending').length
  const awaitingEvidence = reimbursements.filter(
    (request) => request.status === 'approved' && !request.evidenceUrl
  ).length

  const lateToday = lateShiftData?.lateShifts?.length ?? 0
  const missedToday = lateShiftData?.missedShifts?.length ?? 0

  const cashAvailable = (balances?.stripe?.available || 0) + (balances?.payoneer?.available || 0)

  const recentBurns = financeSeries
    .map((row) => row.burn)
    .filter((burn) => burn > 0)
    .slice(-3)

  const avgMonthlyBurn = recentBurns.length > 0
    ? recentBurns.reduce((sum, value) => sum + value, 0) / recentBurns.length
    : 0

  const runwayMonths = avgMonthlyBurn > 0 ? cashAvailable / avgMonthlyBurn : null

  const topClients = useMemo<TopClientRow[]>(() => {
    const last90Days = new Date(now)
    last90Days.setDate(last90Days.getDate() - 90)

    const aggregated = new Map<number, { name: string; revenue: number }>()

    for (const invoice of normalizedInvoices) {
      if (invoice.status !== 'paid' || !invoice.paidAt || invoice.paidAt < last90Days) continue

      const prev = aggregated.get(invoice.clientId)
      aggregated.set(invoice.clientId, {
        name: invoice.clientName,
        revenue: (prev?.revenue || 0) + invoice.amount,
      })
    }

    const total = Array.from(aggregated.values()).reduce((sum, row) => sum + row.revenue, 0)

    return Array.from(aggregated.entries())
      .map(([clientId, row]) => ({
        clientId,
        name: row.name,
        revenue: row.revenue,
        share: total > 0 ? (row.revenue / total) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [normalizedInvoices, now])

  const topClientShare = topClients[0]?.share || 0

  const overdueWatchlist = useMemo(() => {
    return overdueInvoices
      .map((invoice) => ({
        ...invoice,
        overdueDays: invoice.dueDate ? daysDiff(invoice.dueDate, now) : 0,
      }))
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .slice(0, 5)
  }, [overdueInvoices, now])

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = []

    if (overdueInvoices.length > 0) {
      items.push({
        id: 'overdue-invoices',
        level: 'high',
        title: 'Overdue invoices need escalation',
        detail: `${overdueInvoices.length} overdue invoices totaling ${formatCurrency(overdueTotal)}.`,
        href: '/admin/invoices',
      })
    }

    if (missedToday > 0) {
      items.push({
        id: 'missed-shifts',
        level: 'high',
        title: 'Missed shifts today',
        detail: `${missedToday} scheduled shifts were not started on time today.`,
        href: '/admin/shifts',
      })
    }

    if (pendingLeaveRequests > 0) {
      items.push({
        id: 'leave-approvals',
        level: 'medium',
        title: 'Pending leave approvals',
        detail: `${pendingLeaveRequests} leave requests are waiting for decision.`,
        href: '/admin/vacation',
      })
    }

    if (pendingReimbursements > 0) {
      items.push({
        id: 'pending-reimbursements',
        level: 'medium',
        title: 'Pending reimbursements',
        detail: `${pendingReimbursements} reimbursement requests await approval.`,
        href: '/admin/reimbursements',
      })
    }

    const benchRate = totalTeamMembers > 0 ? (benchMembers / totalTeamMembers) * 100 : 0
    if (benchRate >= 20) {
      items.push({
        id: 'bench-capacity',
        level: 'low',
        title: 'High bench capacity',
        detail: `${benchMembers} members are on bench (${formatPercent(benchRate)} of team).`,
        href: '/admin/team',
      })
    }

    return items.slice(0, 5)
  }, [
    overdueInvoices.length,
    overdueTotal,
    missedToday,
    pendingLeaveRequests,
    pendingReimbursements,
    totalTeamMembers,
    benchMembers,
  ])

  const ceoSummary = useMemo(() => {
    const burn = currentMonthFinance?.burn || 0
    const net = currentMonthFinance?.net || 0
    const summaryParts: string[] = []

    if (net >= 0) {
      summaryParts.push(`Net positive ${formatShortCurrency(net)} this month`)
    } else {
      summaryParts.push(`Net negative ${formatShortCurrency(Math.abs(net))} this month`)
    }

    summaryParts.push(`burn at ${formatShortCurrency(burn)}`)

    if (topClientShare >= 40) {
      summaryParts.push(`high concentration risk (${formatPercent(topClientShare)} from top client)`)
    } else {
      summaryParts.push(`client concentration in acceptable range`)
    }

    if (overdueInvoices.length > 0) {
      summaryParts.push(`${overdueInvoices.length} overdue invoices require follow-up`)
    }

    return summaryParts.join(' • ')
  }, [currentMonthFinance, topClientShare, overdueInvoices.length])

  const isLoadingCore = isLoadingDashboard || isLoadingClients || isLoadingInvoices || isLoadingFinances || isLoadingTeamMembers

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="relative overflow-hidden border-white/70 bg-[rgba(255,255,255,0.82)] text-foreground shadow-[0_40px_90px_-52px_rgba(15,23,42,0.44)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(15,23,42,0.05),transparent_20%)]" />
        <CardContent className="relative p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-[52rem]">
              <Badge variant="outline" className="border-white/85 bg-white/80 text-muted-foreground shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)]">
                Executive Console
              </Badge>
              <h1 className="mt-2.5 max-w-3xl font-display text-[1.78rem] font-semibold leading-tight text-foreground sm:text-[2.2rem]">
                Admin dashboard redesigned around signals and action.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Real-time executive view of cashflow, collections, delivery risk and workforce capacity, rebuilt with clearer hierarchy and shadcn surfaces.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
                <span>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                <span>{activeShifts.length} people currently on shift</span>
                <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                <span>{overdueInvoices.length} overdue invoices on watch</span>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full px-3 sm:w-auto"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Link href="/admin/reports" className="block sm:block">
                <Button size="sm" className="h-9 w-full px-3 sm:w-auto">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Open Reports
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,1fr))]">
            <div className="inline-flex min-h-11 items-center gap-2.5 rounded-[1.2rem] border border-white/80 bg-white/74 px-4 py-3 text-sm shadow-[0_22px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] border border-blue-200/70 bg-blue-50/85 text-blue-700">
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Executive brief</span>
                <span className="mt-1 block text-sm text-foreground">{ceoSummary}</span>
              </div>
            </div>

            <div className="inline-flex min-h-11 items-center justify-between gap-3 rounded-[1.2rem] border border-white/80 bg-white/74 px-4 py-3 text-sm shadow-[0_22px_36px_-30px_rgba(15,23,42,0.24)]">
              <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Collection</span>
              <span className="font-display text-xl font-semibold text-foreground">{collectionEfficiency.toFixed(0)}%</span>
            </div>

            <div className="rounded-[1.2rem] border border-white/80 bg-white/74 px-4 py-3 shadow-[0_22px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Runway</span>
                <span className="font-display text-xl font-semibold text-foreground">
                  {runwayMonths !== null && Number.isFinite(runwayMonths) ? runwayMonths.toFixed(1) : 'N/A'}
                </span>
              </div>
              <span className="mt-1 block text-sm text-muted-foreground">
                {cashAvailable > 0 ? `${formatShortCurrency(cashAvailable)} cash` : 'Cash unavailable'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible xl:grid-cols-4">
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <KpiCard
            title="Cash In (MTD)"
            value={formatCurrency(paidThisMonthTotal)}
            hint={`${paidThisMonth.length} paid invoices this month`}
            trend={`${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(1)}% vs last month`}
            trendPositive={revenueGrowthPct >= 0}
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          />
        </div>

        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <KpiCard
            title="Burn (MTD)"
            value={formatCurrency(currentMonthFinance?.burn || 0)}
            hint="Salaries + expenses"
            trend={previousMonthFinance
              ? `${(currentMonthFinance?.burn || 0) >= (previousMonthFinance.burn || 0) ? '+' : ''}${(((currentMonthFinance?.burn || 0) - (previousMonthFinance.burn || 0)) / Math.max(1, previousMonthFinance.burn || 1) * 100).toFixed(1)}% vs last month`
              : undefined
            }
            trendPositive={(currentMonthFinance?.burn || 0) <= (previousMonthFinance?.burn || 0)}
            icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
          />
        </div>

        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <KpiCard
            title="Net (MTD)"
            value={formatCurrency(currentMonthFinance?.net || 0)}
            hint="Revenue minus burn"
            trend={collectionEfficiency > 0 ? `Collections efficiency ${collectionEfficiency.toFixed(0)}%` : 'No billed invoices yet this month'}
            trendPositive={(currentMonthFinance?.net || 0) >= 0}
            icon={<Wallet className="h-5 w-5 text-indigo-600" />}
          />
        </div>

        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <KpiCard
            title="Outstanding A/R"
            value={formatCurrency(outstandingReceivables)}
            hint={`${outstandingInvoices.length} sent/overdue invoices`}
            trend={overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : 'No overdue invoices'}
            trendPositive={overdueInvoices.length === 0}
            icon={<Receipt className="h-5 w-5 text-amber-600" />}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">Revenue vs Burn</h3>
                <p className="text-sm text-muted-foreground">Monthly operating pulse for fast decision making</p>
              </div>
              <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                Rolling 6 months
              </div>
            </div>

            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financeSeries} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9edf2" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7c93" />
                  <YAxis
                    stroke="#6b7c93"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) => formatShortCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #dbe3ec',
                      boxShadow: '0 10px 24px rgba(10,37,64,0.08)',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0f8da1" fill="url(#revenueGradient)" strokeWidth={2.2} />
                  <Area type="monotone" dataKey="burn" name="Burn" stroke="#ef4444" fill="url(#burnGradient)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </div>
          </Card>

          <Card className="content-auto">
            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">Collections Watchlist</h3>
                <p className="text-sm text-muted-foreground">Invoices at risk of delaying cashflow</p>
              </div>
              <Link href="/admin/invoices">
                <Button variant="outline">Open invoices</Button>
              </Link>
            </div>

            {overdueWatchlist.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                No overdue invoices. Collections are currently healthy.
              </div>
            ) : (
              <div className="space-y-3">
                {overdueWatchlist.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{invoice.clientName}</p>
                      <p className="text-xs text-muted-foreground">{invoice.invoiceNumber} • {invoice.overdueDays} days overdue</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-rose-700">{formatCurrency(invoice.amount)}</p>
                      <p className="text-xs text-rose-600">Action needed</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card className="content-auto">
            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h3 className="font-display text-xl font-semibold text-foreground">Risk Board</h3>
            </div>

            {alerts.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                No critical alerts right now.
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Link key={alert.id} href={alert.href}>
                    <button className="w-full rounded-[1.2rem] border border-border/70 bg-white/85 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${alert.level === 'high' ? 'bg-rose-100 text-rose-700' : alert.level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                          {alert.level.toUpperCase()}
                        </span>
                      </div>
                    </button>
                  </Link>
                ))}
              </div>
            )}
            </div>
          </Card>

          <Card className="content-auto">
            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-600" />
              <h3 className="font-display text-xl font-semibold text-foreground">Action Center</h3>
            </div>

            <div className="space-y-2">
              <Link href="/admin/vacation">
                <button className="w-full rounded-[1.2rem] border border-border/70 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5">
                  <p className="text-sm font-medium text-foreground">Leave approvals</p>
                  <p className="text-xs text-muted-foreground">{pendingLeaveRequests} pending</p>
                </button>
              </Link>
              <Link href="/admin/reimbursements">
                <button className="w-full rounded-[1.2rem] border border-border/70 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5">
                  <p className="text-sm font-medium text-foreground">Reimbursements</p>
                  <p className="text-xs text-muted-foreground">{pendingReimbursements} pending, {awaitingEvidence} awaiting evidence</p>
                </button>
              </Link>
              <Link href="/admin/shifts">
                <button className="w-full rounded-[1.2rem] border border-border/70 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5">
                  <p className="text-sm font-medium text-foreground">Shift exceptions</p>
                  <p className="text-xs text-muted-foreground">{lateToday} late starts, {missedToday} missed today</p>
                </button>
              </Link>
              <Link href="/admin/invoices">
                <button className="w-full rounded-[1.2rem] border border-border/70 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5">
                  <p className="text-sm font-medium text-foreground">Collections queue</p>
                  <p className="text-xs text-muted-foreground">{overdueInvoices.length} overdue invoices</p>
                </button>
              </Link>
            </div>
            </div>
          </Card>

          <Card className="content-auto">
            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
            <div className="mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-display text-xl font-semibold text-foreground">Ops Tools</h3>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSyncSlackAvatars}
              disabled={isSyncingAvatars}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingAvatars ? 'animate-spin' : ''}`} />
              {isSyncingAvatars ? 'Syncing avatars...' : 'Sync Slack Avatars'}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Refreshes user profile photos from Slack by email.</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card className="content-auto">
          <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">Top Clients</h3>
              <p className="text-sm text-muted-foreground">Paid revenue concentration in the last 90 days</p>
            </div>
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>

          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid invoices in the last 90 days.</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((row) => (
                <div key={row.clientId} className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(row.revenue)}</p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.55)]"
                      style={{ width: `${Math.min(100, row.share)}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.share.toFixed(1)}% of paid revenue</p>
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>

        <Card className="content-auto">
          <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">Workforce & Operating Health</h3>
              <p className="text-sm text-muted-foreground">Capacity, delivery and working capital signals</p>
            </div>
            <Users2 className="h-5 w-5 text-indigo-600" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground">Active clients</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{activeClients}</p>
              <p className="text-xs text-muted-foreground">+{newClientsThisQuarter} this quarter</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground">Team utilization</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatPercent(utilizationRate)}</p>
              <p className="text-xs text-muted-foreground">{activeTeamMembers}/{Math.max(totalTeamMembers, activeTeamMembers)} active</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground">Billable mix</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatPercent(billableRate)}</p>
              <p className="text-xs text-muted-foreground">{benchMembers} bench • {unavailableMembers} unavailable</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground">Avg collection cycle</p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">{avgCollectionDays} days</p>
              <p className="text-xs text-muted-foreground">Across paid invoices</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-medium text-foreground">Live operations</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeShifts.length} on shift now
                {isFetchingActiveShifts ? ' • updating...' : ''}
              </p>
            </div>

            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-medium text-foreground">Runway estimate</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {runwayMonths !== null && Number.isFinite(runwayMonths)
                  ? `${runwayMonths.toFixed(1)} months at avg burn (${formatCurrency(avgMonthlyBurn)}/mo)`
                  : 'Not enough data for runway estimate'}
              </p>
              {cashAvailable > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Cash available: {formatCurrency(cashAvailable)}</p>
              )}
            </div>
          </div>
          </div>
        </Card>
      </div>

      {isLoadingCore && (
        <Card>
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Loading latest executive metrics...
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/80 bg-white/82">
          <div className="px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-xl font-semibold text-rose-700">{formatCurrency(overdueTotal)}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          </div>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <div className="px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Live shifts</p>
              <p className="text-xl font-semibold text-foreground">{activeShifts.length}</p>
            </div>
            <Briefcase className="h-5 w-5 text-emerald-600" />
          </div>
          </div>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <div className="px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Late starts today</p>
              <p className="text-xl font-semibold text-foreground">{lateToday}</p>
            </div>
            <CalendarClock className="h-5 w-5 text-amber-600" />
          </div>
          </div>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <div className="px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Missed shifts today</p>
              <p className="text-xl font-semibold text-foreground">{missedToday}</p>
            </div>
            {missedToday > 0 ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
