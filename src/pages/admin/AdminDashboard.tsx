import { lazy, Suspense } from 'react'
import { DeferredChart } from '@/components/DeferredChart'
const DashboardRevenueChart = lazy(() => import('@/components/charts/AdminDashboardCharts').then(module => ({default: module.DashboardRevenueChart})))
const AiInsightsPanel = lazy(() => import('@/components/AiInsights').then(module => ({default: module.AiInsightsPanel})))
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, MetricTile, SectionHeading } from '@/components/page-primitives'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { invoiceDaysOverdue } from '@/lib/invoiceDates'
import { dashboardSourceState, dashboardCashPosition } from '@/lib/dashboardAvailability'

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
  financePaymentExcluded?: boolean
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
  errors?: string[]
}

interface AdminDashboardSummaryResponse extends DashboardStatsResponse {
  clients: ClientDashboard[]
  teamMembers: TeamMemberDashboard[]
  leaveRequests: LeaveDashboard[]
  invoices: InvoiceDashboard[]
  financesOverview?: FinanceOverview
  reimbursements: ReimbursementDashboard[]
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

function QueueLink({
  href,
  title,
  detail,
  value,
}: {
  href: string
  title: string
  detail: string
  value: string
}) {
  return (
    <Link href={href} className="block">
      <div className="flex items-start justify-between gap-4 rounded-[1.15rem] border border-border/70 bg-white/72 px-4 py-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white/94">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <div className="shrink-0 text-sm font-semibold text-foreground">{value}</div>
      </div>
    </Link>
  )
}

function RiskBadge({ level }: { level: AlertItem['level'] }) {
  const className = level === 'high'
    ? 'bg-rose-100 text-rose-700'
    : level === 'medium'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-sky-100 text-sky-700'

  return (
    <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]', className)}>
      {level}
    </span>
  )
}

export function AdminDashboard() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [isSyncingAvatars, setIsSyncingAvatars] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  useShiftEvents()

  const {
    data: activeShiftsData,
    error: activeShiftsError,
    refetch: refetchActiveShifts,
    isFetching: isFetchingActiveShifts,
  } = useQuery({
    queryKey: ['adminActiveShifts'],
    queryFn: () => api.getAdminActiveShifts(),
    refetchInterval: 5 * 60 * 1000,
  })

  const {
    data: lateShiftData,
    error: lateShiftsError,
    refetch: refetchLateShifts,
  } = useQuery<AdminLateShifts>({
    queryKey: ['adminLateShifts'],
    queryFn: () => api.getAdminLateShifts(),
    refetchInterval: 5 * 60 * 1000,
  })

  const {
    data: dashboardSummary,
    error: dashboardError,
    refetch: refetchDashboardSummary,
    isLoading: isLoadingDashboardSummary,
  } = useQuery<AdminDashboardSummaryResponse>({
    queryKey: ['adminDashboardSummary'],
    queryFn: () => api.getAdminDashboardSummary(),
  })

  const {
    data: balances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery<FinanceBalances>({
    queryKey: ['financesBalancesDashboard'],
    queryFn: () => api.getFinancesBalances(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const dashboardData = dashboardSummary
  const clients = dashboardSummary?.clients ?? []
  const teamMembers = dashboardSummary?.teamMembers ?? []
  const leaveRequests = dashboardSummary?.leaveRequests ?? []
  const allInvoices = dashboardSummary?.invoices ?? []
  const financesOverview = dashboardSummary?.financesOverview
  const reimbursements = dashboardSummary?.reimbursements ?? []

  const activeShifts = activeShiftsData?.shifts ?? []
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
      await showAlert({ message: error.message || 'Failed to sync Slack avatars', type: 'error' })
    } finally {
      setIsSyncingAvatars(false)
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setRefreshError('')
    try {
      const names = ['Live shifts', 'Shift exceptions', 'Executive metrics', 'Bank balances']
      const results = await Promise.allSettled([
        refetchActiveShifts(), refetchLateShifts(), refetchDashboardSummary(), refetchBalances(),
      ])
      const failed = results.flatMap((result, index) => (
        result.status === 'rejected' || result.value.isError ? [names[index]] : []
      ))
      if (failed.length) {
        setRefreshError(`Refresh incomplete: ${failed.join(', ')}. Last successful data, where available, is retained below.`)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const summaryState = dashboardSourceState(dashboardSummary, dashboardError)
  const shiftsState = dashboardSourceState(activeShiftsData, activeShiftsError)
  const lateState = dashboardSourceState(lateShiftData, lateShiftsError)
  const cashPosition = dashboardCashPosition(balances, balancesError)
  const riskCoverageComplete = summaryState.fresh && lateState.fresh
  const shiftCountText = shiftsState.usable ? String(activeShifts.length) : 'Unavailable'
  const sourceErrors = [
    { name: 'Executive metrics', error: dashboardError, data: dashboardSummary, retry: refetchDashboardSummary },
    { name: 'Live shifts', error: activeShiftsError, data: activeShiftsData, retry: refetchActiveShifts },
    { name: 'Shift exceptions', error: lateShiftsError, data: lateShiftData, retry: refetchLateShifts },
    { name: 'Bank balances', error: balancesError, data: balances, retry: refetchBalances },
  ].filter(source => source.error)
  const sourceNotices = (
    <div className="space-y-2">
      {refreshError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{refreshError}</p>}
      {sourceErrors.map(source => (
        <div key={source.name} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <strong>{source.name} unavailable.</strong>{' '}
          {source.error instanceof Error ? source.error.message : 'The data source could not be loaded.'}{' '}
          {source.name === 'Bank balances'
            ? 'Cash and runway require a successful refresh.'
            : source.data
              ? 'Displayed values for this source are from its last successful refresh.'
              : 'No current values are shown for this source.'}
          <Button size="sm" variant="outline" className="ml-3" onClick={() => { setRefreshError(''); void source.retry() }}>
            Retry {source.name.toLowerCase()}
          </Button>
        </div>
      ))}
      {balances && !balancesError && cashPosition.reason && (
        <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {cashPosition.reason}. Cash and runway are unavailable.
          <Button size="sm" variant="outline" className="ml-3" onClick={() => { void refetchBalances() }}>Refresh balances</Button>
        </div>
      )}
    </div>
  )

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthStart = startOfMonth(previousMonthDate)
  const previousMonthEnd = endOfMonth(previousMonthDate)

  const normalizedInvoices = useMemo(() => {
    return allInvoices.map((invoice) => ({
      id: invoice.id,
      clientId: invoice.clientId,
      clientName: invoice.clientName || `Client #${invoice.clientId}`,
      invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
      amount: toNumber(invoice.total ?? invoice.amount),
      status: (invoice.status || 'draft').toLowerCase(),
      invoiceDate: toDate(invoice.invoiceDate),
      dueDate: toDate(invoice.dueDate),
      paidAt: toDate(invoice.paidAt),
      financePaymentExcluded: invoice.financePaymentExcluded === true,
    }))
  }, [allInvoices])

  const monthlyBreakdown = financesOverview?.monthlyBreakdown ?? []

  const financeSeries = useMemo(() => {
    const rows = [] as Array<{ label: string; revenue: number; burn: number; net: number }>

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = d.getMonth() + 1
      const year = d.getFullYear()
      const entry = monthlyBreakdown.find((row) => row.month === month && row.year === year)
      const revenue = entry ? toNumber(entry.client_payments) + toNumber(entry.income) : 0
      const burn = entry ? toNumber(entry.salary) + toNumber(entry.expense) + toNumber(entry.extra_payment) : 0

      rows.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        revenue,
        burn,
        net: revenue - burn,
      })
    }

    return rows
  }, [monthlyBreakdown, now])

  const currentMonthFinance = financeSeries[financeSeries.length - 1]
  const previousMonthFinance = financeSeries[financeSeries.length - 2]

  const paidThisMonth = normalizedInvoices.filter((invoice) => (
    invoice.status === 'paid' &&
    !invoice.financePaymentExcluded &&
    invoice.paidAt &&
    invoice.paidAt >= monthStart &&
    invoice.paidAt <= monthEnd
  ))

  const paidPreviousMonth = normalizedInvoices.filter((invoice) => (
    invoice.status === 'paid' &&
    !invoice.financePaymentExcluded &&
    invoice.paidAt &&
    invoice.paidAt >= previousMonthStart &&
    invoice.paidAt <= previousMonthEnd
  ))

  const invoicedThisMonth = normalizedInvoices.filter((invoice) => (
    invoice.status !== 'cancelled' && invoice.invoiceDate &&
    invoice.invoiceDate >= monthStart &&
    invoice.invoiceDate <= monthEnd
  ))

  const paidThisMonthTotal = paidThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0)
  const paidPreviousMonthTotal = paidPreviousMonth.reduce((sum, invoice) => sum + invoice.amount, 0)
  const invoicedThisMonthTotal = invoicedThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0)
  const revenueGrowthPct = paidPreviousMonthTotal > 0
    ? ((paidThisMonthTotal - paidPreviousMonthTotal) / paidPreviousMonthTotal) * 100
    : paidThisMonthTotal > 0
      ? 100
      : 0
  const collectionEfficiency = invoicedThisMonthTotal > 0 ? (paidThisMonthTotal / invoicedThisMonthTotal) * 100 : 0

  const outstandingInvoices = normalizedInvoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
  const outstandingReceivables = outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  const overdueInvoices = normalizedInvoices.filter((invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'draft') return false
    if (!invoice.dueDate) return invoice.status === 'overdue'
    return invoiceDaysOverdue(invoice.dueDate, now) > 0
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
    if (typeof client.isActive === 'boolean') return client.isActive
    return (client.status || '').toLowerCase() !== 'inactive'
  }).length

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const newClientsThisQuarter = clients.filter((client) => {
    const created = toDate(client.createdAt)
    return created ? created >= quarterStart : false
  }).length

  const totalTeamMembers = toNumber(dashboardData?.stats?.totalTeamMembers ?? teamMembers.length)
  const activeTeamMembers = toNumber(dashboardData?.stats?.activeTeamMembers ?? teamMembers.filter((member) => member.status === 'active').length)
  const benchMembers = teamMembers.filter((member) => member.status === 'bench').length
  const unavailableMembers = teamMembers.filter((member) => member.status === 'unavailable').length
  const billableMembers = teamMembers.filter((member) => member.isBillable === true).length
  const utilizationRate = totalTeamMembers > 0 ? (activeTeamMembers / totalTeamMembers) * 100 : 0
  const billableRate = totalTeamMembers > 0 ? (billableMembers / totalTeamMembers) * 100 : 0

  const pendingLeaveRequests = leaveRequests.filter((request) => {
    const status = request?.request?.status || request?.status
    return status === 'pending'
  }).length
  const pendingReimbursements = reimbursements.filter((request) => request.status === 'pending').length
  const awaitingEvidence = reimbursements.filter((request) => request.status === 'approved' && !request.evidenceUrl).length

  const lateToday = lateShiftData?.lateShifts?.length ?? 0
  const missedToday = lateShiftData?.missedShifts?.length ?? 0

  const cashAvailable = cashPosition.amount
  const recentBurns = financeSeries.map((row) => row.burn).filter((burn) => burn > 0).slice(-3)
  const avgMonthlyBurn = recentBurns.length > 0
    ? recentBurns.reduce((sum, value) => sum + value, 0) / recentBurns.length
    : 0
  const runwayMonths = summaryState.fresh && cashAvailable !== null && avgMonthlyBurn > 0 ? cashAvailable / avgMonthlyBurn : null

  const topClients = useMemo<TopClientRow[]>(() => {
    const last90Days = new Date(now)
    last90Days.setDate(last90Days.getDate() - 90)

    const aggregated = new Map<number, { name: string; revenue: number }>()

    for (const invoice of normalizedInvoices) {
      if (invoice.financePaymentExcluded || invoice.status !== 'paid' || !invoice.paidAt || invoice.paidAt < last90Days) continue

      const previous = aggregated.get(invoice.clientId)
      aggregated.set(invoice.clientId, {
        name: invoice.clientName,
        revenue: (previous?.revenue || 0) + invoice.amount,
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

  const overdueWatchlist = useMemo(() => (
    overdueInvoices
      .map((invoice) => ({
        ...invoice,
        overdueDays: invoiceDaysOverdue(invoice.dueDate, now),
      }))
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .slice(0, 5)
  ), [overdueInvoices, now])

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = []

    if (overdueInvoices.length > 0) {
      items.push({
        id: 'overdue-invoices',
        level: 'high',
        title: 'Overdue invoices need escalation',
        detail: `${overdueInvoices.length} invoices totaling ${formatCurrency(overdueTotal)} are now beyond due date.`,
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
        detail: `${pendingLeaveRequests} requests still need a decision.`,
        href: '/admin/vacation',
      })
    }

    if (pendingReimbursements > 0) {
      items.push({
        id: 'pending-reimbursements',
        level: 'medium',
        title: 'Pending reimbursements',
        detail: `${pendingReimbursements} reimbursements are waiting for approval.`,
        href: '/admin/reimbursements',
      })
    }

    const benchRate = totalTeamMembers > 0 ? (benchMembers / totalTeamMembers) * 100 : 0
    if (benchRate >= 20) {
      items.push({
        id: 'bench-capacity',
        level: 'low',
        title: 'Bench capacity is rising',
        detail: `${benchMembers} team members are on bench, or ${formatPercent(benchRate)} of the team.`,
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

  const executiveSummary = useMemo(() => {
    const net = currentMonthFinance?.net || 0
    const burn = currentMonthFinance?.burn || 0
    const summaryParts = [
      net >= 0 ? `Net positive ${formatShortCurrency(net)} this month` : `Net negative ${formatShortCurrency(Math.abs(net))} this month`,
      `burn at ${formatShortCurrency(burn)}`,
      topClientShare >= 40 ? `${formatPercent(topClientShare)} revenue from top client` : 'client concentration stable',
    ]

    if (overdueInvoices.length > 0) {
      summaryParts.push(`${overdueInvoices.length} overdue invoices in collections`)
    }

    return summaryParts.join(' • ')
  }, [currentMonthFinance, overdueInvoices.length, topClientShare])

  const isLoadingCore = isLoadingDashboardSummary

  if (!summaryState.usable) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Today</h1>
          <Button variant="outline" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh all'}
          </Button>
        </div>
        {sourceNotices}
        <Card>
          <CardContent className="py-6">
            <h2 className="font-semibold">{isLoadingCore ? 'Loading executive metrics…' : 'Executive metrics unavailable'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Revenue, staffing, collections and risk totals will appear when their source loads successfully.</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-6">
              <h2 className="font-semibold">Live shifts</h2>
              <p className="mt-2 text-2xl">{shiftCountText}</p>
              {shiftsState.usable && !shiftsState.fresh && <p className="text-sm text-amber-700">Last successful snapshot</p>}
              <Link href="/admin/shifts" className="text-sm underline">Open shifts</Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <h2 className="font-semibold">Shift exceptions</h2>
              <p className="mt-2">{lateState.usable ? `${lateToday} late starts · ${missedToday} missed shifts` : 'Unavailable'}</p>
              {lateState.usable && !lateState.fresh && <p className="text-sm text-amber-700">Last successful snapshot</p>}
              <p className="mt-3 text-sm">Connected USD cash: {cashAvailable === null ? 'Unavailable' : formatCurrency(cashAvailable)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sourceNotices}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Your business at a glance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} disabled={isRefreshing}><RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />{isRefreshing ? 'Refreshing' : 'Refresh'}</Button>
          <Button asChild><Link href="/admin/reports">View reports</Link></Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-xs text-muted-foreground">
        <span>Collection rate <strong className="ml-1 font-medium text-foreground">{collectionEfficiency.toFixed(0)}%</strong></span>
        <span>Runway <strong className="ml-1 font-medium text-foreground">{runwayMonths !== null && Number.isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)} months` : 'Unavailable'}</strong></span>
        <span>Top client <strong className="ml-1 font-medium text-foreground">{topClientShare.toFixed(0)}%</strong></span>
        <Link href="/admin/shifts" className="hover:text-foreground">{shiftsState.usable ? `${shiftCountText} active shifts` : 'Shift status unavailable'}</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Received this month"
          value={formatCurrency(paidThisMonthTotal)}
          hint={`${paidThisMonth.length} invoices paid this month`}
          tone="emerald"
          icon={<DollarSign className="h-5 w-5" />}
          trend={(
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              revenueGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
            )}>
              {revenueGrowthPct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {`${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(1)}% vs last month`}
            </div>
          )}
        />
        <MetricTile
          label="Expenses this month"
          value={formatCurrency(currentMonthFinance?.burn || 0)}
          hint="Salaries and operating expenses"
          tone="rose"
          icon={<TrendingDown className="h-5 w-5" />}
          trend={(
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {(previousMonthFinance?.burn || 0) > 0
                ? `${(((currentMonthFinance?.burn || 0) - (previousMonthFinance?.burn || 0)) / Math.max(1, previousMonthFinance?.burn || 1) * 100).toFixed(1)}% vs last month`
                : 'First month with burn data'}
            </div>
          )}
        />
        <MetricTile
          label="Net result"
          value={formatCurrency(currentMonthFinance?.net || 0)}
          hint="Revenue minus burn"
          tone="primary"
          icon={<Wallet className="h-5 w-5" />}
          trend={(
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              (currentMonthFinance?.net || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            )}>
              {(currentMonthFinance?.net || 0) >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {(currentMonthFinance?.net || 0) >= 0 ? 'Positive month so far' : 'Margin needs attention'}
            </div>
          )}
        />
        <MetricTile
          label="Unpaid invoices"
          value={formatCurrency(outstandingReceivables)}
          hint={`${outstandingInvoices.length} invoices still unpaid`}
          tone="amber"
          icon={<Receipt className="h-5 w-5" />}
          trend={(
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              overdueInvoices.length === 0 ? 'text-emerald-700' : 'text-amber-700'
            )}>
              {overdueInvoices.length === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {overdueInvoices.length === 0 ? 'No overdue invoices' : `${overdueInvoices.length} overdue`}
            </div>
          )}
        />
      </div>

      <section className="py-2">
        <SectionHeading title="Needs attention" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QueueLink href="/admin/invoices" title="Overdue invoices" detail={`${outstandingInvoices.length} invoices outstanding`} value={formatCurrency(overdueTotal)} />
          <QueueLink href="/admin/shifts" title="Shift exceptions" detail={lateState.usable ? `${lateToday} late · ${missedToday} missed` : 'Status unavailable'} value={lateState.usable ? `${lateToday + missedToday}` : '—'} />
          <QueueLink href="/admin/vacation" title="Leave requests" detail="Awaiting approval" value={`${pendingLeaveRequests}`} />
          <QueueLink href="/admin/reimbursements" title="Reimbursements" detail={`${awaitingEvidence} awaiting evidence`} value={`${pendingReimbursements}`} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <Card className="content-auto">
          <CardContent className="pt-5 sm:pt-5">
            <SectionHeading
              title="Revenue & expenses"
              description="Monthly revenue and operating expenses."
              action={(
                <span className="hidden rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
                  Rolling 6 months
                </span>
              )}
            />

            <div className="h-72">
              <DeferredChart><DashboardRevenueChart financeSeries={financeSeries} /></DeferredChart>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">This month invoiced</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{formatCurrency(invoicedThisMonthTotal)}</p>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Avg collection cycle</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{avgCollectionDays} days</p>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cash available</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{cashAvailable === null ? 'Unavailable' : formatCurrency(cashAvailable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="content-auto">
            <CardContent className="pt-5 sm:pt-5">
              <SectionHeading
                title="Risk board"
                description="Signals that need attention before they affect revenue or delivery."
              />

              {!riskCoverageComplete&&<p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Risk coverage is incomplete. Some sources are unavailable or show their last successful snapshot.</p>}
              {alerts.length === 0 ? (
                <EmptyState
                  title={riskCoverageComplete?'No critical alerts':'Current risk status unavailable'}
                  description={riskCoverageComplete?'The current snapshot does not show any escalations. Keep an eye on refreshes and live exceptions.':'Available sources contain no recorded alerts; this is not a complete current assessment.'}
                />
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <Link key={alert.id} href={alert.href} className="block">
                      <div className="rounded-[1.15rem] border border-border/70 bg-white/72 px-4 py-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white/94">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.detail}</p>
                          </div>
                          <RiskBadge level={alert.level} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="content-auto">
            <CardContent className="pt-5 sm:pt-5">
              <SectionHeading
                title="Ops tools"
                description="Sync team profile photos."
              />

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSyncSlackAvatars}
                disabled={isSyncingAvatars}
              >
                <RefreshCw className={cn('h-4 w-4', isSyncingAvatars && 'animate-spin')} />
                {isSyncingAvatars ? 'Syncing Slack avatars...' : 'Sync Slack avatars'}
              </Button>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Refreshes user profile photos from Slack so people and search results stay recognizable.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="content-auto">
          <CardContent className="pt-5 sm:pt-5">
            <SectionHeading
              title="Collections watchlist"
              description="Invoices most likely to delay cashflow if nobody follows up."
            />

            {overdueWatchlist.length === 0 ? (
              <EmptyState
                title={summaryState.fresh?'Collections look healthy':'Collections refresh unavailable'}
                description={summaryState.fresh?'There are no overdue invoices in the current watchlist.':'The last successful snapshot had no overdue invoices. Refresh executive metrics to check current collections.'}
              />
            ) : (
              <div className="space-y-3">
                {overdueWatchlist.map((invoice) => (
                  <div key={invoice.id} className="rounded-[1.15rem] border border-rose-100 bg-rose-50/55 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{invoice.clientName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {invoice.invoiceNumber} • {invoice.overdueDays} days overdue
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-rose-700">{formatCurrency(invoice.amount)}</p>
                        <p className="mt-1 text-xs text-rose-600">Action needed</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="content-auto">
          <CardContent className="pt-5 sm:pt-5">
            <SectionHeading
              title="Client concentration"
              description="How much paid revenue is currently tied to the largest accounts."
            />

            {topClients.length === 0 ? (
              <EmptyState
                title="No recent paid invoices"
                description="Revenue concentration will appear here once paid invoices land in the last 90 days."
              />
            ) : (
              <div className="space-y-4">
                {topClients.map((row) => (
                  <div key={row.clientId} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(row.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{row.share.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.55)]"
                        style={{ width: `${Math.min(100, row.share)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="content-auto">
          <CardContent className="pt-5 sm:pt-5">
            <SectionHeading
              title="Workforce and operating health"
              description="A compact readout of client load, utilization, billable mix, and live operations."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Active clients</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{activeClients}</p>
                <p className="mt-1 text-sm text-muted-foreground">+{newClientsThisQuarter} added this quarter</p>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Utilization</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{formatPercent(utilizationRate)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{activeTeamMembers}/{Math.max(totalTeamMembers, activeTeamMembers)} active team members</p>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Billable mix</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{formatPercent(billableRate)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{benchMembers} bench • {unavailableMembers} unavailable</p>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Live operations</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">{shiftCountText}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shiftsState.fresh?'On shift now':shiftsState.usable?'Last successful snapshot':'Current shift data unavailable'}{isFetchingActiveShifts ? ' • updating…' : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="content-auto">
          <CardContent className="pt-5 sm:pt-5">
            <SectionHeading
              title="Today at a glance"
              description="A compact board for exceptions and activity."
            />

            <div className="space-y-3">
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span className="text-sm font-semibold text-foreground">Overdue value</span>
                  </div>
                  <span className="text-sm font-semibold text-rose-700">{formatCurrency(overdueTotal)}</span>
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-foreground">Late starts</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{lateState.usable?lateToday:'Unavailable'}</span>
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-foreground">Missed shifts</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{lateState.usable?missedToday:'Unavailable'}</span>
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-foreground">Pending reimbursements</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{pendingReimbursements}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={
        <Card><CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />Loading AI insights...</CardContent></Card>
      }>
        <AiInsightsPanel />
      </Suspense>

      {isLoadingCore && (
        <Card>
          <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Loading the latest executive metrics...
          </CardContent>
        </Card>
      )}
    </div>
  )
}
