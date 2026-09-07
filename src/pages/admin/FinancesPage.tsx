import { lazy } from 'react'
import { DeferredChart } from '@/components/DeferredChart'
const FinanceProfitChart = lazy(() => import('@/components/charts/FinancesPageCharts').then(module => ({default: module.FinanceProfitChart})))
const FinanceRevenueChart = lazy(() => import('@/components/charts/FinancesPageCharts').then(module => ({default: module.FinanceRevenueChart})))
import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react'

import {
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Settings,
  X,
  Receipt,
  Activity,
  Banknote,
  Calendar,
  ArrowRight,
  ChevronDown,
  Clock3,
  Info,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip as InfoTooltip } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DateRangePicker } from '@/components/ui/advanced-date-picker'
import { useLocation } from 'wouter'
import { api, type FinanceCategory, type FinanceCategoryKind, type FinanceAuditLog, type SalaryHistoryEntry } from '@/lib/api'
import { CardSkeleton, MetricTileSkeleton, TableSkeleton } from '@/components/page-primitives'
import { useWorkflowAccess } from '@/lib/workflow'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type SalaryExtra = {
  label: string
  amount: string
}

type ParsedSalaryPayment = {
  salaryMonth: string
  plannedBase: number
  paidBase: number
  remainingBase: number
  extras: SalaryExtra[]
  note: string
}

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'last_year' | 'custom'
type TransactionDatePreset = 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom'

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'custom', label: 'Custom' },
]

const TRANSACTION_DATE_PRESETS: { key: TransactionDatePreset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
]

const FINANCE_TERM_INFO = {
  netProfitLoss: {
    title: 'Net Profit / Loss',
    description: 'Overall result for the selected date range after all revenue and costs are included.',
    formula: 'Client Revenue + Other Income - Salaries - Other Expenses',
  },
  margin: {
    title: 'Profit Margin',
    description: 'Shows how much of total revenue remains as profit or loss.',
    formula: '(Net Profit / Loss / Total Revenue) x 100',
  },
  salaryRatio: {
    title: 'Salary to Revenue',
    description: 'Shows what share of revenue is being spent on salaries.',
    formula: '(Salaries / Total Revenue) x 100',
  },
  totalRevenue: {
    title: 'Revenue',
    description: 'All income recorded in the selected date range.',
    formula: 'Client Revenue + Other Income',
  },
  totalCosts: {
    title: 'Costs',
    description: 'All expenses recorded in the selected date range.',
    formula: 'Salaries + Other Expenses',
  },
  clientRevenue: {
    title: 'Client Revenue',
    description: 'Payments received from clients during the selected date range.',
    formula: 'Sum of client payment entries in range',
  },
  otherIncome: {
    title: 'Other Income',
    description: 'Non-client income manually recorded in the selected date range.',
    formula: 'Sum of manual income entries in range',
  },
  salaries: {
    title: 'Salaries',
    description: 'Salary payments recorded in the selected date range.',
    formula: 'Sum of salary entries in range',
  },
  otherExpenses: {
    title: 'Other Expenses',
    description: 'Non-salary expenses recorded in the selected date range.',
    formula: 'Sum of manual expense entries in range',
  },
  avgMonthlyPL: {
    title: 'Avg Monthly P&L',
    description: 'Average monthly profit or loss across months that had revenue or expenses.',
    formula: 'Total Net Profit / Loss / Number of active months in range',
  },
  monthlyRevenueVsCosts: {
    title: 'Monthly Revenue vs Costs',
    description: 'Monthly comparison of income against costs for every month in the selected range.',
    formula: 'Revenue = Client Payments + Other Income; Costs = Salaries + Other Expenses',
  },
  cumulativePL: {
    title: 'Cumulative P&L',
    description: 'Running total of monthly profit or loss across the selected date range.',
    formula: 'Previous cumulative total + (Monthly Revenue - Monthly Costs)',
  },
  costBreakdown: {
    title: 'Cost Breakdown',
    description: 'Shows how total costs are split between salaries and other expenses.',
    formula: 'Each segment = Category amount / Total Costs',
  },
  revenueSources: {
    title: 'Revenue Sources',
    description: 'Shows how total revenue is split between client payments and other income.',
    formula: 'Each segment = Category amount / Total Revenue',
  },
  bestMonth: {
    title: 'Best Month',
    description: 'Month with the highest net result in the selected date range.',
    formula: 'Highest value of Monthly Revenue - Monthly Costs',
  },
  worstMonth: {
    title: 'Worst Month',
    description: 'Month with the lowest net result in the selected date range.',
    formula: 'Lowest value of Monthly Revenue - Monthly Costs',
  },
  monthlyPLSummary: {
    title: 'Monthly P&L Summary',
    description: 'Month-by-month breakdown for the current filtered date range.',
    formula: 'Revenue, Salaries, Other Costs, and Net shown for each month',
  },
  tableRevenue: {
    title: 'Revenue',
    description: 'Total income for that month.',
    formula: 'Client Payments + Other Income',
  },
  tableOtherCosts: {
    title: 'Other Costs',
    description: 'Non-salary expenses for that month.',
    formula: 'Manual expense entries for the month',
  },
  tableNet: {
    title: 'Net',
    description: 'Monthly profit or loss after all costs.',
    formula: 'Revenue - Salaries - Other Costs',
  },
} as const

type FinanceInfoKey = keyof typeof FINANCE_TERM_INFO

function FinanceInfoIcon({ infoKey, side = 'top' }: { infoKey: FinanceInfoKey; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const info = FINANCE_TERM_INFO[infoKey]

  return (
    <InfoTooltip
      side={side}
      content={
        <div className="space-y-1.5">
          <p className="font-semibold text-white">{info.title}</p>
          <p className="text-gray-100">{info.description}</p>
          <p className="text-[11px] text-gray-300">
            <span className="font-semibold text-white">Calculated as:</span> {info.formula}
          </p>
        </div>
      }
    >
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
    </InfoTooltip>
  )
}

function LabelWithInfo({
  label,
  infoKey,
  side = 'top',
  className = '',
}: {
  label: string
  infoKey: FinanceInfoKey
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{label}</span>
      <FinanceInfoIcon infoKey={infoKey} side={side} />
    </span>
  )
}

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getQuarter(month: number): number {
  return Math.floor(month / 3)
}

function getDateRangeForPreset(preset: DatePreset, today: Date = new Date()): { start: string; end: string } {
  const y = today.getFullYear()
  const m = today.getMonth()

  switch (preset) {
    case 'this_month':
      return { start: fmt(new Date(y, m, 1)), end: fmt(today) }
    case 'last_month':
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) }
    case 'this_quarter': {
      const qStart = getQuarter(m) * 3
      return { start: fmt(new Date(y, qStart, 1)), end: fmt(today) }
    }
    case 'last_quarter': {
      const qStart = getQuarter(m) * 3
      return { start: fmt(new Date(y, qStart - 3, 1)), end: fmt(new Date(y, qStart, 0)) }
    }
    case 'ytd':
      return { start: `${y}-01-01`, end: fmt(today) }
    case 'last_year':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'custom':
      return { start: `${y}-01-01`, end: fmt(today) }
  }
}

function getDateRangeForTransactionPreset(preset: TransactionDatePreset, today: Date = new Date()): { start: string; end: string } {
  const y = today.getFullYear()
  const m = today.getMonth()

  switch (preset) {
    case 'this_month':
      return { start: fmt(new Date(y, m, 1)), end: fmt(today) }
    case 'last_month':
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) }
    case 'this_year':
      return { start: `${y}-01-01`, end: fmt(today) }
    case 'last_year':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'all':
      return { start: '', end: '' }
    case 'custom':
      return { start: '', end: '' }
  }
}

function openNativeDatePicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget
  input.showPicker?.()
}

function getComparisonRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  // Calendar-aligned: shift both dates back by 1 year
  const prevStart = new Date(s.getFullYear() - 1, s.getMonth(), s.getDate())
  const prevEnd = new Date(e.getFullYear() - 1, e.getMonth(), e.getDate())
  return { start: fmt(prevStart), end: fmt(prevEnd) }
}

function formatDateRangeLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  const optsY: Intl.DateTimeFormatOptions = { ...opts, year: 'numeric' }
  if (sameYear) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', optsY)}`
  }
  return `${s.toLocaleDateString('en-US', optsY)} – ${e.toLocaleDateString('en-US', optsY)}`
}

function computeChange(current: number, previous: number): { delta: number; pct: number | null } {
  const delta = current - previous
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null
  return { delta, pct }
}

function getMonthsInRange(start: string, end: string): { month: number; year: number; name: string }[] {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const result: { month: number; year: number; name: string }[] = []
  let d = new Date(s.getFullYear(), s.getMonth(), 1)
  while (d <= e) {
    result.push({ month: d.getMonth() + 1, year: d.getFullYear(), name: MONTHS[d.getMonth()] })
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return result
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function toInputDate(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }
  return dateStr.split('T')[0]
}

function toInputMonth(dateStr?: string): string {
  const source = toInputDate(dateStr)
  return source.slice(0, 7)
}

function formatMonthLabel(monthValue: string): string {
  const [year, month] = monthValue.split('-')
  const monthIndex = Number(month) - 1
  if (!year || monthIndex < 0 || monthIndex >= MONTHS.length) {
    return monthValue
  }
  return `${MONTHS[monthIndex]} ${year}`
}

function getMonthRange(startMonth: string, endMonth: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth) || startMonth > endMonth) {
    return []
  }

  const [startYear, startMonthIndex] = startMonth.split('-').map(Number)
  const [endYear, endMonthIndex] = endMonth.split('-').map(Number)
  const result: string[] = []
  const cursor = new Date(startYear, startMonthIndex - 1, 1)
  const end = new Date(endYear, endMonthIndex - 1, 1)

  while (cursor <= end) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return result
}

function parseMoney(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(2).replace(/\.00$/, '')
}

function cloneSalaryExtras(extras: SalaryExtra[]): SalaryExtra[] {
  return extras.map((extra) => ({ ...extra }))
}

function normalizeSalaryExtras(value: unknown): SalaryExtra[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const label = typeof (item as { label?: unknown }).label === 'string'
      ? (item as { label: string }).label.trim()
      : ''
    const amount = parseMoney((item as { amount?: unknown }).amount as string | number | null | undefined)

    if (!label || amount <= 0) return []

    return [{
      label,
      amount: formatMoneyInput(amount),
    }]
  })
}

function getRemainingDefaultExtras(
  defaultExtras: SalaryExtra[],
  payments: Array<{ parsed: ParsedSalaryPayment }>
): SalaryExtra[] {
  const defaultsByLabel = new Map<string, { label: string; amount: number }>()

  for (const extra of defaultExtras) {
    const label = extra.label.trim()
    const amount = parseMoney(extra.amount)
    if (!label || amount <= 0) continue

    const key = label.toLowerCase()
    const existing = defaultsByLabel.get(key)
    defaultsByLabel.set(key, {
      label: existing?.label || label,
      amount: (existing?.amount || 0) + amount,
    })
  }

  const paidByLabel = new Map<string, number>()
  for (const payment of payments) {
    for (const extra of payment.parsed.extras) {
      const label = extra.label.trim()
      const amount = parseMoney(extra.amount)
      if (!label || amount <= 0) continue

      const key = label.toLowerCase()
      paidByLabel.set(key, (paidByLabel.get(key) || 0) + amount)
    }
  }

  return Array.from(defaultsByLabel.entries()).flatMap(([key, extra]) => {
    const remaining = Math.max(extra.amount - (paidByLabel.get(key) || 0), 0)
    if (remaining <= 0) return []

    return [{
      label: extra.label,
      amount: formatMoneyInput(remaining),
    }]
  })
}

function parseMonthLabel(monthLabel: string): string | null {
  const match = monthLabel.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return null

  const monthIndex = MONTHS.findIndex((month) => month.toLowerCase() === match[1].toLowerCase())
  if (monthIndex < 0) return null

  return `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}`
}

function parseSalaryPayment(payment: SalaryPayment): ParsedSalaryPayment {
  const data = payment.payrollData
  if (data?.version === 1) return { salaryMonth: data.salaryMonth, plannedBase: parseMoney(data.baseSalary), paidBase: parseMoney(data.paidBase), remainingBase: 0, extras: normalizeSalaryExtras(data.extras), note: data.note || '' }
  // Unstructured historical records are never parsed from descriptions. Editing explicitly reconciles them.
  return { salaryMonth: toInputMonth(payment.transactionDate), plannedBase: parseMoney(payment.amount), paidBase: parseMoney(payment.amount), remainingBase: 0, extras: [], note: '' }
}

interface OverviewData {
  totalIncome: number
  totalExpenses: number
  totalSalaries: number
  totalExtraPayments: number  // kept for API compatibility
  clientPayments: number
  manualIncome: number
  manualExpenses: number
  netProfitLoss: number
  monthlyBreakdown: Array<{
    month: number
    year: number
    income: number
    expense: number
    salary: number
    extra_payment: number  // kept for API compatibility
    client_payments: number
  }>
}

interface Transaction {
  id: number
  type: string
  amount: string | number
  transactionDate: string
  category: string | null
  description: string | null
  teamMemberId: number | null
  teamMemberName?: string | null
  clientId: number | null
  clientName?: string | null
  invoiceId: number | null
  isRecurring: boolean
  createdAt: string
}

interface ClientPayment {
  id: number
  invoiceNumber: string
  amount: string | number
  invoiceDate: string
  paidAt: string
  clientId: number
  clientName: string
  description: string | null
}

interface SalaryMember {
  employmentType?:string
  id: number
  name: string
  position: string | null
  startDate: string
  monthlyRate: number
  currentPeriod?: SalaryPeriod
  periods?: SalaryPeriod[]
  monthlySalaryExtras?: SalaryExtra[]
  hourlyRate: number | null
  isBillable: boolean
  avatarUrl: string | null
  status: string
  totalPaidThisYear: number
  lastPaymentDate: string | null
  paymentCount: number
}

interface RateHistoryEntry {
  id: number
  monthlyRate: string | number
  effectiveDate: string
  note: string | null
  createdBy: string | null
  createdAt: string
}

interface SalaryPeriod { employmentType?:string; salaryMonth: string; baseSalary: string; defaultExtras: SalaryExtra[]; remainingBase: string; paidBase: string; remainingExtras: SalaryExtra[]; remainingTotal: string; status: string; id?: number; legacyPaymentIds: number[]; requiresTermsReview?:boolean; termsEvidence?:{rateSource:string;extrasSource:string}; calculationNote?: string }
interface SalaryPayment {
  payrollData?: { version: number; salaryMonth: string; baseSalary: string; paidBase: string; extras: SalaryExtra[]; note: string } | null
  payrollPeriodId?: number | null
  id: number
  teamMemberId: number
  teamMemberName: string
  amount: string | number
  transactionDate: string
  description: string | null
}

interface SalariesData {
  members: SalaryMember[]
  recentPayments: SalaryPayment[]
  allPayments?: SalaryPayment[]
  year: number
}

interface BalancesData {
  stripe: { available: number; pending: number; currency: string } | null
  payoneer: { available: number; currency: string } | null
  fetchedAt: string
}

interface IntegrationConfigState {
  isActive: boolean
  isConfigured: boolean
  workspaceId?: string | null
  workspaceName?: string | null
  authorizedUserName?: string | null
}

type MergedRow = {
  id: number | string
  type: string
  amount: number
  date: string
  category: string
  description: string
  isClientPayment: boolean
  invoiceNumber?: string
  editable: boolean
  teamMemberName?: string
}

type FinanceSection = 'overview' | 'transactions' | 'salaries' | 'categories' | 'logs'

const FINANCE_SECTIONS: FinanceSection[] = ['overview', 'transactions', 'salaries', 'categories', 'logs']

export function FinancesPage() {
  const workflowAccess = useWorkflowAccess()
  const canRecordPayment = workflowAccess.data?.canRecordPayment === true && !workflowAccess.error
  const [loadErrors,setLoadErrors]=useState<Record<string,string|undefined>>({})
  const currentYear = new Date().getFullYear()
  const [location, setLocation] = useLocation()

  const sectionFromPath = location.split('/')[3]
  const activeTab: FinanceSection = FINANCE_SECTIONS.includes(sectionFromPath as FinanceSection)
    ? (sectionFromPath as FinanceSection)
    : 'overview'

  // Overview state — date range presets
  const [datePreset, setDatePreset] = useState<DatePreset>('ytd')
  const [dateRange, setDateRange] = useState(() => getDateRangeForPreset('ytd'))
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  // Comparison state
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [comparisonData, setComparisonData] = useState<OverviewData | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const [txTypeFilter, setTxTypeFilter] = useState(() => new URLSearchParams(window.location.search).get('type') ?? 'all')
  const [txDatePreset, setTxDatePreset] = useState<TransactionDatePreset>(() => {
    const preset = new URLSearchParams(window.location.search).get('period') as TransactionDatePreset | null
    return preset && TRANSACTION_DATE_PRESETS.some(item => item.key === preset) ? preset : 'this_month'
  })
  const [txStartDate, setTxStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const period = params.get('period') as TransactionDatePreset | null
    const defaultPreset = period && TRANSACTION_DATE_PRESETS.some(item => item.key === period) ? period : 'this_month'
    const defaultRange = getDateRangeForTransactionPreset(defaultPreset)
    return params.get('startDate') ?? defaultRange.start
  })
  const [txEndDate, setTxEndDate] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const period = params.get('period') as TransactionDatePreset | null
    const defaultPreset = period && TRANSACTION_DATE_PRESETS.some(item => item.key === period) ? period : 'this_month'
    const defaultRange = getDateRangeForTransactionPreset(defaultPreset)
    return params.get('endDate') ?? defaultRange.end
  })
  const [txSearch, setTxSearch] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [showTxModal, setShowTxModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [txForm, setTxForm] = useState({
    type: 'income' as string,
    amount: '',
    category: '',
    description: '',
    transactionDate: toInputDate(),
    isRecurring: false,
  })
  const [txSaving, setTxSaving] = useState(false)
  const [categories, setCategories] = useState<{
    income: FinanceCategory[]
    expense: FinanceCategory[]
  }>({
    income: [],
    expense: [],
  })
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesSaving, setCategoriesSaving] = useState(false)
  const [showNewTxCategoryInput, setShowNewTxCategoryInput] = useState(false)
  const [newTxCategoryName, setNewTxCategoryName] = useState('')
  const [newIncomeCategoryName, setNewIncomeCategoryName] = useState('')
  const [newExpenseCategoryName, setNewExpenseCategoryName] = useState('')

  // Salaries state
  const [salariesYear, setSalariesYear] = useState(currentYear)
  const [salariesData, setSalariesData] = useState<SalariesData | null>(null)
  const [salariesLoading, setSalariesLoading] = useState(true)
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<SalaryMember | null>(null)
  const [editingSalaryPayment, setEditingSalaryPayment] = useState<SalaryPayment | null>(null)
  const [salaryForm, setSalaryForm] = useState({
    salaryMonth: toInputMonth(),
    baseSalary: '',
    paymentAmount: '',
    extras: [] as SalaryExtra[],
    transactionDate: toInputDate(),
    note: '',
  })
  const [salarySaving, setSalarySaving] = useState(false)
  const [salaryReviewConfirmed,setSalaryReviewConfirmed]=useState(false)
  const [salaryPeriodInfo, setSalaryPeriodInfo] = useState<SalaryPeriod | null>(null)
  const [salaryRequestKey, setSalaryRequestKey] = useState('')

  // Rate editing state
  const [showRateModal, setShowRateModal] = useState(false)
  const [rateMember, setRateMember] = useState<SalaryMember | null>(null)
  const [rateForm, setRateForm] = useState({
    monthlyRate: '',
    effectiveDate: toInputDate(),
    note: '',
    monthlyExtras: [] as SalaryExtra[],
  })
  const [rateSaving, setRateSaving] = useState(false)
  const [rateHistory, setRateHistory] = useState<RateHistoryEntry[]>([])
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false)
  const [financeLogs, setFinanceLogs] = useState<FinanceAuditLog[]>([])
  const [financeLogsLoading, setFinanceLogsLoading] = useState(false)
  const [financeLogFilters, setFinanceLogFilters] = useState({
    action: '',
    entityType: '',
    teamMemberId: '',
    entityId: '',
    q: '',
    startDate: '',
    endDate: '',
  })
  const [showSalaryHistoryModal, setShowSalaryHistoryModal] = useState(false)
  const [salaryHistoryMember, setSalaryHistoryMember] = useState<SalaryMember | null>(null)
  const [salaryHistoryEntries, setSalaryHistoryEntries] = useState<SalaryHistoryEntry[]>([])
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false)


  // Balances state
  const [balances, setBalances] = useState<BalancesData | null>(null)
  const [balancesLoading, setBalancesLoading] = useState(true)

  // Integration config modal state
  const [showConfigModal, setShowConfigModal] = useState<'stripe' | 'payoneer' | 'clickup' | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [stripeForm, setStripeForm] = useState({ secretKey: '' })
  const [payoneerForm, setPayoneerForm] = useState({
    clientId: '',
    clientSecret: '',
    programId: '',
    environment: 'sandbox',
  })
  const [clickupForm, setClickupForm] = useState({ apiToken: '' })
  const [clickupIntegration, setClickupIntegration] = useState<IntegrationConfigState | null>(null)

  useEffect(() => {
    if (location === '/admin/finances' || location === '/admin/finances/') {
      setLocation('/admin/finances/overview', { replace: true })
      return
    }

    if (
      location.startsWith('/admin/finances/') &&
      !FINANCE_SECTIONS.includes((location.split('/')[3] || '') as FinanceSection)
    ) {
      setLocation('/admin/finances/overview', { replace: true })
    }
  }, [location, setLocation])

  useEffect(() => {
    const nextQuery = new URLSearchParams(window.location.search).get('q') ?? ''
    setTxSearch(nextQuery)
  }, [location])

  useEffect(() => {
    if (activeTab !== 'transactions') return

    const params = new URLSearchParams()
    if (txTypeFilter !== 'all') params.set('type', txTypeFilter)
    if (txDatePreset) params.set('period', txDatePreset)
    if (txStartDate) params.set('startDate', txStartDate)
    if (txEndDate) params.set('endDate', txEndDate)
    if (txSearch) params.set('q', txSearch)

    const nextUrl = `/admin/finances/transactions${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', nextUrl)
  }, [activeTab, txTypeFilter, txDatePreset, txStartDate, txEndDate, txSearch])

  // Load balances on mount
  useEffect(() => {
    loadBalances()
    loadClickUpIntegration()
  }, [])

  // Load overview data when date range changes
  useEffect(() => {
    if (activeTab === 'overview') loadOverview()
  }, [activeTab, dateRange.start, dateRange.end])

  // Load comparison data when enabled or range changes
  useEffect(() => {
    if (activeTab === 'overview' && compareEnabled) {
      loadComparison()
    } else {
      setComparisonData(null)
    }
  }, [activeTab, compareEnabled, dateRange.start, dateRange.end])

  // Load transactions data
  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions()
    }
  }, [activeTab, txTypeFilter, txStartDate, txEndDate])

  // Load salaries data
  useEffect(() => {
    if (activeTab === 'salaries') {
      loadSalaries()
    }
  }, [activeTab, salariesYear])

  // Load finance logs
  useEffect(() => {
    if (activeTab === 'logs') {
      if (!salariesData?.members?.length) {
        loadSalaries()
      }
      loadFinanceLogs()
    }
  }, [activeTab])

  // Load categories on relevant pages
  useEffect(() => {
    if (activeTab === 'transactions' || activeTab === 'categories') {
      loadCategories()
    }
  }, [activeTab])

  const loadBalances = async () => {
    try {
      setBalancesLoading(true)
      const data = await api.getFinancesBalances()
      setBalances(data)
    } catch (error) {
      console.error('Failed to load balances:', error)
    } finally {
      setBalancesLoading(false)
    }
  }

  const loadClickUpIntegration = async () => {
    try {
      const data = await api.getIntegration('clickup')
      setClickupIntegration(data)
    } catch (error) {
      console.error('Failed to load ClickUp integration:', error)
      setClickupIntegration(null)
    }
  }

  const openConfigModal = (provider: 'stripe' | 'payoneer' | 'clickup') => {
    setStripeForm({ secretKey: '' })
    setPayoneerForm({ clientId: '', clientSecret: '', programId: '', environment: 'sandbox' })
    setClickupForm({ apiToken: '' })
    setShowConfigModal(provider)
  }

  const handleSaveIntegration = async () => {
    if (!showConfigModal) return
    try {
      setConfigSaving(true)
      if (showConfigModal === 'stripe') {
        await api.saveIntegration('stripe', { secretKey: stripeForm.secretKey })
      } else if (showConfigModal === 'clickup') {
        await api.saveIntegration('clickup', { apiToken: clickupForm.apiToken })
      } else {
        await api.saveIntegration('payoneer', payoneerForm)
      }
      setShowConfigModal(null)
      await Promise.all([loadBalances(), loadClickUpIntegration()])
    } catch (error) {
      console.error('Failed to save integration:', error)
    } finally {
      setConfigSaving(false)
    }
  }

  const handleDisconnectIntegration = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? This will remove saved credentials.`)) return
    try {
      await api.deleteIntegration(provider)
      await Promise.all([loadBalances(), loadClickUpIntegration()])
      setShowConfigModal(null)
    } catch (error) {
      console.error('Failed to disconnect integration:', error)
    }
  }

  const loadOverview = async () => {
    try {
      setOverviewLoading(true)
      setLoadErrors(previous=>({...previous,overview:undefined}))
      const data = await api.getFinancesOverview({
        startDate: dateRange.start,
        endDate: dateRange.end,
      })
      setOverviewData(data)
    } catch (error) {
      setLoadErrors(previous=>({...previous,overview:error instanceof Error?error.message:'Financial data could not be loaded'}))
    } finally {
      setOverviewLoading(false)
    }
  }

  const loadComparison = async () => {
    try {
      setComparisonLoading(true)
      setLoadErrors(previous=>({...previous,comparison:undefined}))
      const compRange = getComparisonRange(dateRange.start, dateRange.end)
      const data = await api.getFinancesOverview({
        startDate: compRange.start,
        endDate: compRange.end,
      })
      setComparisonData(data)
    } catch (error) {
      setLoadErrors(previous=>({...previous,comparison:error instanceof Error?error.message:'Financial data could not be loaded'}))
    } finally {
      setComparisonLoading(false)
    }
  }

  const handlePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const range = getDateRangeForPreset(preset)
      setDateRange(range)
    }
  }, [])

  const handleCustomDateApply = useCallback(() => {
    if (customStart && customEnd) {
      setDateRange({ start: customStart, end: customEnd })
    }
  }, [customStart, customEnd])

  const handleTransactionPresetChange = useCallback((preset: TransactionDatePreset) => {
    setTxDatePreset(preset)

    if (preset !== 'custom') {
      const range = getDateRangeForTransactionPreset(preset)
      setTxStartDate(range.start)
      setTxEndDate(range.end)
    }
  }, [])

  const loadTransactions = async () => {
    try {
      setTxLoading(true)
      setLoadErrors(previous=>({...previous,transactions:undefined}))
      const params: Record<string, any> = {}
      if (txTypeFilter !== 'all') params.type = txTypeFilter
      if (txStartDate) params.startDate = txStartDate
      if (txEndDate) params.endDate = txEndDate

      const [txResult, cpResult] = await Promise.allSettled([
        api.getFinancialTransactions(params),
        api.getClientPayments(
          txStartDate || txEndDate
            ? { startDate: txStartDate || undefined, endDate: txEndDate || undefined }
            : undefined
        ),
      ])
      if(txResult.status==='rejected')throw txResult.reason
      if(cpResult.status==='rejected')throw cpResult.reason
      setTransactions(txResult.status === 'fulfilled' ? txResult.value : [])
      setClientPayments(cpResult.status === 'fulfilled' ? cpResult.value : [])
    } catch (error) {
      setLoadErrors(previous=>({...previous,transactions:error instanceof Error?error.message:'Financial data could not be loaded'}))
    } finally {
      setTxLoading(false)
    }
  }

  const loadSalaries = async () => {
    try {
      setSalariesLoading(true)
      const data = await api.getFinancesSalaries(salariesYear)
      setSalariesData(data)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Salary data is unavailable')
    } finally {
      setSalariesLoading(false)
    }
  }

  const loadFinanceLogs = async (filters = financeLogFilters) => {
    try {
      setFinanceLogsLoading(true)
      const data = await api.getFinanceLogs({
        limit: 150,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        teamMemberId: filters.teamMemberId ? Number(filters.teamMemberId) : undefined,
        entityId: filters.entityId ? Number(filters.entityId) : undefined,
        q: filters.q || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      })
      setFinanceLogs(data || [])
    } catch (error) {
      console.error('Failed to load finance logs:', error)
      setFinanceLogs([])
    } finally {
      setFinanceLogsLoading(false)
    }
  }

  const applyFinanceLogFilters = async () => {
    await loadFinanceLogs(financeLogFilters)
  }

  const clearFinanceLogFilters = async () => {
    const resetFilters = {
      action: '',
      entityType: '',
      teamMemberId: '',
      entityId: '',
      q: '',
      startDate: '',
      endDate: '',
    }
    setFinanceLogFilters(resetFilters)
    await loadFinanceLogs(resetFilters)
  }

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true)
      const data = await api.getFinanceCategories()
      if (data && typeof data === 'object' && 'income' in data && 'expense' in data) {
        setCategories({
          income: data.income || [],
          expense: data.expense || [],
        })
      }
    } catch (error) {
      console.error('Failed to load finance categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const createCategory = async (kind: FinanceCategoryKind, rawName: string) => {
    const name = rawName.trim()
    if (!name) return null
    try {
      setCategoriesSaving(true)
      const created = await api.createFinanceCategory({ kind, name })
      await loadCategories()
      return created
    } catch (error) {
      console.error('Failed to create category:', error)
      alert(error instanceof Error ? error.message : 'Failed to create category')
      return null
    } finally {
      setCategoriesSaving(false)
    }
  }

  const handleQuickCreateTxCategory = async () => {
    const kind: FinanceCategoryKind = txForm.type === 'income' ? 'income' : 'expense'
    const created = await createCategory(kind, newTxCategoryName)
    if (!created) return
    setTxForm((prev) => ({ ...prev, category: created.name }))
    setShowNewTxCategoryInput(false)
    setNewTxCategoryName('')
  }

  const handleAddCategoryFromSettings = async (kind: FinanceCategoryKind) => {
    const value = kind === 'income' ? newIncomeCategoryName : newExpenseCategoryName
    const created = await createCategory(kind, value)
    if (!created) return
    if (kind === 'income') {
      setNewIncomeCategoryName('')
    } else {
      setNewExpenseCategoryName('')
    }
  }

  const handleRenameCategory = async (category: FinanceCategory) => {
    const nextName = prompt('Rename category', category.name)?.trim()
    if (!nextName || nextName === category.name) return

    try {
      setCategoriesSaving(true)
      await api.updateFinanceCategory(category.id, { name: nextName })
      await loadCategories()
      if (txForm.category.toLowerCase() === category.name.toLowerCase()) {
        setTxForm((prev) => ({ ...prev, category: nextName }))
      }
    } catch (error) {
      console.error('Failed to rename category:', error)
      alert(error instanceof Error ? error.message : 'Failed to rename category')
    } finally {
      setCategoriesSaving(false)
    }
  }

  const handleDeleteCategory = async (category: FinanceCategory) => {
    if (!confirm(`Delete "${category.name}" from ${category.kind === 'income' ? 'Income' : 'Cost'} categories?`)) return
    try {
      setCategoriesSaving(true)
      await api.deleteFinanceCategory(category.id)
      await loadCategories()
      if (txForm.category.toLowerCase() === category.name.toLowerCase()) {
        setTxForm((prev) => ({ ...prev, category: '' }))
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete category')
    } finally {
      setCategoriesSaving(false)
    }
  }

  // Merge transactions and client payments for table
  const getMergedRows = (): MergedRow[] => {
    const rows: MergedRow[] = []

    // Add manual transactions
    for (const tx of transactions) {
      const isSalary = tx.type === 'salary'
      rows.push({
        id: tx.id,
        type: tx.type,
        amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
        date: tx.transactionDate,
        category: tx.category || '',
        description: tx.description || '',
        isClientPayment: false,
        editable: !isSalary,
        teamMemberName: isSalary ? tx.teamMemberName || undefined : undefined,
      })
    }

    // Add client payments only if type filter is 'all' or 'income'
    if (txTypeFilter === 'all' || txTypeFilter === 'income') {
      for (const cp of clientPayments) {
        rows.push({
          id: `cp-${cp.id}`,
          type: 'income',
          amount: typeof cp.amount === 'string' ? parseFloat(cp.amount) : cp.amount,
          date: cp.paidAt || cp.invoiceDate,
          category: 'Client Payment',
          description: cp.clientName + (cp.description ? ` - ${cp.description}` : ''),
          isClientPayment: true,
          invoiceNumber: cp.invoiceNumber,
          editable: false,
        })
      }
    }

    // Apply search filter
    const filtered = txSearch
      ? rows.filter(
          (r) =>
            String(r.id).toLowerCase().includes(txSearch.toLowerCase()) ||
            r.type.toLowerCase().includes(txSearch.toLowerCase()) ||
            r.description.toLowerCase().includes(txSearch.toLowerCase()) ||
            r.category.toLowerCase().includes(txSearch.toLowerCase()) ||
            (r.teamMemberName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
            (r.invoiceNumber || '').toLowerCase().includes(txSearch.toLowerCase())
        )
      : rows

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return filtered
  }

  // Transaction CRUD
  const openAddTransaction = (type: 'income' | 'expense') => {
    setEditingTx(null)
    setTxForm({
      type,
      amount: '',
      category: '',
      description: '',
      transactionDate: toInputDate(),
      isRecurring: false,
    })
    setShowNewTxCategoryInput(false)
    setNewTxCategoryName('')
    loadCategories()
    setShowTxModal(true)
  }

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx)
    setTxForm({
      type: tx.type,
      amount: String(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount),
      category: tx.category || '',
      description: tx.description || '',
      transactionDate: toInputDate(tx.transactionDate),
      isRecurring: tx.isRecurring,
    })
    setShowNewTxCategoryInput(false)
    setNewTxCategoryName('')
    loadCategories()
    setShowTxModal(true)
  }

  const handleSaveTransaction = async () => {
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) return
    try {
      setTxSaving(true)
      const payload = {
        type: txForm.type,
        amount: parseFloat(txForm.amount),
        transactionDate: txForm.transactionDate,
        category: txForm.category || undefined,
        description: txForm.description || undefined,
        isRecurring: txForm.isRecurring,
      }
      if (editingTx) {
        await api.updateFinancialTransaction(editingTx.id, payload)
      } else {
        await api.createFinancialTransaction(payload)
      }
      setShowTxModal(false)
      setEditingTx(null)
      await loadTransactions()
      // Refresh overview if on that tab too
      loadOverview()
    } catch (error) {
      console.error('Failed to save transaction:', error)
    } finally {
      setTxSaving(false)
    }
  }

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    const previousTransactions = transactions
    setTransactions((current) => current.filter((transaction) => transaction.id !== id))
    try {
      await api.deleteFinancialTransaction(id)
      loadOverview()
    } catch (error) {
      setTransactions(previousTransactions)
      console.error('Failed to delete transaction:', error)
    }
  }

  const parsedSalaryPayments = useMemo(() => {
    const payments = salariesData?.allPayments ?? salariesData?.recentPayments ?? []
    return payments.map((payment) => ({
      payment,
      parsed: parseSalaryPayment(payment),
    }))
  }, [salariesData])

  const getSalaryMonthContext = (teamMemberId: number, salaryMonth: string, excludePaymentId?: number) => {
    const matchingPayments = parsedSalaryPayments.filter(({ payment, parsed }) => {
      if (payment.payrollData?.version!==1 || payment.teamMemberId !== teamMemberId) return false
      if (parsed.salaryMonth !== salaryMonth) return false
      if (excludePaymentId && payment.id === excludePaymentId) return false
      return true
    })

    const alreadyPaidBase = matchingPayments.reduce((sum, entry) => sum + entry.parsed.paidBase, 0)
    const existingBase =
      matchingPayments.find((entry) => entry.parsed.plannedBase > 0)?.parsed.plannedBase ?? 0

    return {
      matchingPayments,
      alreadyPaidBase,
      existingBase,
    }
  }

  const salaryMonthContext = useMemo(() => {
    if (!selectedMember) {
      return {
        matchingPayments: [],
        alreadyPaidBase: 0,
        existingBase: 0,
      }
    }

    return getSalaryMonthContext(selectedMember.id, salaryForm.salaryMonth, editingSalaryPayment?.id)
  }, [selectedMember, salaryForm.salaryMonth, editingSalaryPayment?.id, parsedSalaryPayments])

  const remainingSalaryByMember = useMemo(() => new Map((salariesData?.members || []).map(member => {
    const periods = member.periods || []
    const byMonth = periods.filter(p => parseMoney(p.remainingTotal) > 0).map(p => ({month:p.salaryMonth, amount:parseMoney(p.remainingTotal)}))
    return [member.id, {total:byMonth.reduce((sum,p)=>sum+p.amount,0),byMonth}]
  })), [salariesData])

  const plannedSalaryAmount = parseMoney(salaryForm.baseSalary)
  const salaryPaymentAmount = parseMoney(salaryForm.paymentAmount)
  const salaryBenefitFactor=salaryPeriodInfo?.employmentType==='part_time'?0.5:1
  const extrasTotal = salaryForm.extras.reduce((sum, extra) => sum + Math.round(parseMoney(extra.amount)*100*salaryBenefitFactor)/100, 0)
  const salaryTotal = Math.round((salaryPaymentAmount + extrasTotal) * 100) / 100
  const maxSalaryPayment = Math.max(plannedSalaryAmount - salaryMonthContext.alreadyPaidBase, 0)
  const remainingSalary = Math.max(plannedSalaryAmount - salaryMonthContext.alreadyPaidBase - salaryPaymentAmount, 0)
  const salaryOverpayment = Math.max(salaryPaymentAmount - maxSalaryPayment, 0)
  const salaryBaseTooLow = plannedSalaryAmount < salaryMonthContext.alreadyPaidBase
  const salaryNeedsReview=Boolean(salaryPeriodInfo?.requiresTermsReview || (editingSalaryPayment&&editingSalaryPayment.payrollData?.version!==1))
  const salaryCanSave = canRecordPayment && (!salaryNeedsReview||(salaryReviewConfirmed&&Boolean(salaryForm.note.trim()))) && salaryTotal > 0 && salaryPaymentAmount >= 0 && plannedSalaryAmount >= 0 && salaryForm.extras.every(e => e.label.trim() && parseMoney(e.amount) > 0) && !salaryBaseTooLow && salaryOverpayment <= 0 && (!salaryPeriodInfo?.legacyPaymentIds?.length || !!editingSalaryPayment)
  const salaryIsAdvance = remainingSalary > 0

  // Salary payment
  const openRecordSalary = async (member: SalaryMember) => {
    if (!canRecordPayment) return
    try {
      const salaryMonth=toInputMonth()
      const period:SalaryPeriod=await api.request(`/finances/salaries/${member.id}/period/${salaryMonth}`)
      setSalaryPeriodInfo(period)
      setSalaryReviewConfirmed(false)
      setSalaryRequestKey(crypto.randomUUID())
      setEditingSalaryPayment(null)
      setSelectedMember(member)
      setSalaryForm({salaryMonth,baseSalary:formatMoneyInput(parseMoney(period.baseSalary)),paymentAmount:formatMoneyInput(parseMoney(period.remainingBase)),extras:normalizeSalaryExtras(period.remainingExtras).map(e=>({...e,amount:formatMoneyInput(parseMoney(e.amount)*(period.employmentType==='part_time'?2:1))})),transactionDate:toInputDate(),note:''})
      setShowSalaryModal(true)
    }catch(error){window.alert(error instanceof Error?error.message:'Failed to load salary period')}
  }
  const handleSalaryMonthChange = async (salaryMonth:string) => {
    if(!selectedMember) return
    try{
      const period:SalaryPeriod=await api.request(`/finances/salaries/${selectedMember.id}/period/${salaryMonth}`)
      setSalaryPeriodInfo(period)
      setSalaryReviewConfirmed(false)
      setSalaryForm(prev=>({...prev,salaryMonth,baseSalary:formatMoneyInput(parseMoney(period.baseSalary)),paymentAmount:editingSalaryPayment?prev.paymentAmount:formatMoneyInput(parseMoney(period.remainingBase)),extras:editingSalaryPayment?prev.extras:normalizeSalaryExtras(period.remainingExtras).map(e=>({...e,amount:formatMoneyInput(parseMoney(e.amount)*(period.employmentType==='part_time'?2:1))}))}))
    }catch(error){window.alert(error instanceof Error?error.message:'Failed to load salary period')}
  }

  const addSalaryExtra = () => {
    setSalaryForm((prev) => ({
      ...prev,
      extras: [...prev.extras, { label: '', amount: '' }],
    }))
  }

  const updateSalaryExtra = (index: number, field: 'label' | 'amount', value: string) => {
    setSalaryForm((prev) => {
      const extras = [...prev.extras]
      extras[index] = { ...extras[index], [field]: value }
      return { ...prev, extras }
    })
  }

  const removeSalaryExtra = (index: number) => {
    setSalaryForm((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }))
  }

  const handleRecordSalary = async () => {
    if (!selectedMember || !salaryCanSave) return
    try {
      setSalarySaving(true)
      const payload = {teamMemberId:selectedMember.id,amount:salaryTotal,transactionDate:salaryForm.transactionDate,salaryMonth:salaryForm.salaryMonth,baseSalary:plannedSalaryAmount,salaryPaidNow:salaryPaymentAmount,extras:salaryForm.extras,note:salaryForm.note,historicalTermsConfirmed:salaryReviewConfirmed,idempotencyKey:salaryRequestKey}
      if(editingSalaryPayment) {
        await api.request(`/finances/salaries/payments/${editingSalaryPayment.id}`,{method:'PUT',body:JSON.stringify(payload)})
      } else {
        const response=await api.recordSalaryPayment(payload)
        if(response.email && !response.email.delivered && !response.email.skipped) window.alert(`Salary recorded. Email delivery failed: ${response.email.error || 'Please check email settings.'}`)
      }
      setShowSalaryModal(false)
      setSelectedMember(null)
      setEditingSalaryPayment(null)
      await loadSalaries()
      loadOverview()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to record salary payment')
    } finally {
      setSalarySaving(false)
    }
  }

  // Edit structured components, or explicitly reconcile an unstructured historical payment.
  const openEditSalaryPayment = async (payment: SalaryPayment) => {
    if (!canRecordPayment) return
    const member = salariesData?.members.find((m) => m.id === payment.teamMemberId)
    if (!member) return

    const parsed = parseSalaryPayment(payment)
    let period:SalaryPeriod
    try { period=await api.request(`/finances/salaries/${member.id}/period/${parsed.salaryMonth}`);setSalaryPeriodInfo(period);setSalaryReviewConfirmed(false) } catch(error){window.alert(error instanceof Error?error.message:'Failed to load salary period');return}
    const monthContext = getSalaryMonthContext(member.id, parsed.salaryMonth, payment.id)
    const baseSalary = period.id || payment.payrollData?.version!==1 ? parseMoney(period.baseSalary) : parsed.plannedBase || monthContext.existingBase || parseMoney(period.baseSalary)

    setEditingSalaryPayment(payment)
    setSelectedMember(member)
    setSalaryForm({
      salaryMonth: parsed.salaryMonth,
      baseSalary: formatMoneyInput(baseSalary),
      paymentAmount: formatMoneyInput(parsed.paidBase),
      extras: parsed.extras.map(e=>({...e,amount:formatMoneyInput(parseMoney(e.amount)*(period.employmentType==='part_time'?2:1))})),
      transactionDate: toInputDate(payment.transactionDate),
      note: parsed.note,
    })
    setShowSalaryModal(true)
  }

  // Delete salary payment
  const handleDeleteSalaryPayment = async (id: number) => {
    if (!canRecordPayment) return
    if (!confirm('Void this recorded payment? The original record and audit history will be preserved.')) return
    try {
      await api.deleteFinancialTransaction(id)
      await loadSalaries()
      loadOverview()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to void salary payment')
    }
  }

  const addRateExtra = () => {
    setRateForm((prev) => ({
      ...prev,
      monthlyExtras: [...prev.monthlyExtras, { label: '', amount: '' }],
    }))
  }

  const updateRateExtra = (index: number, field: 'label' | 'amount', value: string) => {
    setRateForm((prev) => {
      const monthlyExtras = [...prev.monthlyExtras]
      monthlyExtras[index] = { ...monthlyExtras[index], [field]: value }
      return { ...prev, monthlyExtras }
    })
  }

  const removeRateExtra = (index: number) => {
    setRateForm((prev) => ({
      ...prev,
      monthlyExtras: prev.monthlyExtras.filter((_, i) => i !== index),
    }))
  }

  // Rate editing
  const openRateModal = async (member: SalaryMember) => {
    setRateMember(member)
    setRateForm({
      monthlyRate: String(member.monthlyRate || 0),
      effectiveDate: toInputDate(),
      note: '',
      monthlyExtras: normalizeSalaryExtras(member.monthlySalaryExtras),
    })
    setShowRateModal(true)
    // Load history
    setRateHistoryLoading(true)
    try {
      const history = await api.getSalaryRateHistory(member.id)
      setRateHistory(history)
    } catch {
      setRateHistory([])
    } finally {
      setRateHistoryLoading(false)
    }
  }

  const openSalaryHistory = async (member: SalaryMember) => {
    setSalaryHistoryMember(member)
    setSalaryHistoryEntries([])
    setShowSalaryHistoryModal(true)
    setSalaryHistoryLoading(true)

    try {
      const response = await api.getSalaryHistory(member.id)
      setSalaryHistoryEntries(response.history || [])
    } catch (error) {
      console.error('Failed to load salary history:', error)
      setSalaryHistoryEntries([])
    } finally {
      setSalaryHistoryLoading(false)
    }
  }

  const handleSaveRate = async () => {
    if (!rateMember || !rateForm.monthlyRate || parseFloat(rateForm.monthlyRate) < 0) return
    try {
      setRateSaving(true)
      const normalizedRate = parseMoney(rateForm.monthlyRate)
      await api.request(`/finances/salaries/${rateMember.id}/rate`, {method:'PUT',body:JSON.stringify({monthlyRate:normalizedRate,effectiveDate:rateForm.effectiveDate,note:rateForm.note || undefined,monthlyExtras:rateForm.monthlyExtras})})
      setShowRateModal(false)
      setRateMember(null)
      await loadSalaries()
    } catch (error) {
      window.alert(error instanceof Error?error.message:'Failed to update salary terms')
    } finally {
      setRateSaving(false)
    }
  }

  const formatHistoryValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—'
    if (Array.isArray(value)) {
      return value.map((item) => formatHistoryValue(item)).join(', ')
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) return '—'
      return entries.map(([key, next]) => `${key}: ${formatHistoryValue(next)}`).join(' • ')
    }
    return String(value)
  }

  const formatHistoryAction = (action: string) => action.replace(/_/g, ' ')

  const getHistoryBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action.includes('deleted')) return 'destructive'
    if (action.includes('updated')) return 'secondary'
    return 'default'
  }

  // Months in selected range
  const rangeMonths = useMemo(() => getMonthsInRange(dateRange.start, dateRange.end), [dateRange.start, dateRange.end])

  // Chart data — break expenses into Salaries vs Other Expenses (stacked), filtered to date range
  const chartData = useMemo(() => {
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const income = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const salaries = entry ? parseFloat(String(entry.salary || 0)) : 0
      const otherExpenses = entry ? (parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.extra_payment || 0))) : 0
      return { name: rangeMonths.length > 12 ? `${name} ${year}` : name, Income: income, Salaries: salaries, 'Other Expenses': otherExpenses }
    })
  }, [overviewData, rangeMonths])

  // Comparison computed values
  const compTotalIncome = comparisonData ? (comparisonData.clientPayments || 0) + (comparisonData.manualIncome || 0) : 0
  const compTotalExpenses = comparisonData ? comparisonData.totalExpenses : 0
  const compNetPL = comparisonData?.netProfitLoss || 0
  const comparisonRange = useMemo(() => getComparisonRange(dateRange.start, dateRange.end), [dateRange.start, dateRange.end])

  const txCategoryKind: FinanceCategoryKind = txForm.type === 'income' ? 'income' : 'expense'
  const txCategoryOptions = categories[txCategoryKind] || []
  const txCategoryExists = !!txForm.category && txCategoryOptions.some(
    (category) => category.name.toLowerCase() === txForm.category.toLowerCase()
  )

  // Computed overview values
  const totalIncome = (overviewData?.clientPayments || 0) + (overviewData?.manualIncome || 0)
  const totalExpenses = (overviewData?.totalExpenses || 0)
  const netPL = overviewData?.netProfitLoss || 0
  const profitMargin = totalIncome > 0 ? (netPL / totalIncome) * 100 : 0
  const salaryToRevenue = totalIncome > 0 ? ((overviewData?.totalSalaries || 0) / totalIncome) * 100 : 0

  // Monthly cumulative P&L for area chart (filtered to date range)
  const cumulativePLData = useMemo(() => {
    let cumulative = 0
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const monthIncome = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const monthExpense = entry ? (parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.extra_payment || 0))) + parseFloat(String(entry.salary || 0)) : 0
      cumulative += monthIncome - monthExpense
      return { name: rangeMonths.length > 12 ? `${name} ${year}` : name, cumulative, income: monthIncome, expense: monthExpense }
    })
  }, [overviewData, rangeMonths])

  // Best/worst months (filtered to date range)
  const monthlyNetArr = useMemo(() => {
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const inc = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const exp = entry ? (parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.extra_payment || 0))) + parseFloat(String(entry.salary || 0)) : 0
      return { name, month, year, net: inc - exp, income: inc, expense: exp }
    }).filter(m => m.income > 0 || m.expense > 0)
  }, [overviewData, rangeMonths])

  const bestMonth = monthlyNetArr.length > 0 ? monthlyNetArr.reduce((a, b) => a.net > b.net ? a : b) : null
  const worstMonth = monthlyNetArr.length > 0 ? monthlyNetArr.reduce((a, b) => a.net < b.net ? a : b) : null

  // Year options for salaries tab
  const yearOptions = useMemo(() => {
    const opts = []
    for (let y = currentYear; y >= currentYear - 5; y--) opts.push(y)
    return opts
  }, [currentYear])

  // Current month (for highlighting)
  const currentMonth = new Date().getMonth() // 0-indexed
  const currentMonthYear = new Date().getFullYear()

  return (
    <div className="space-y-6">
      {Object.values(loadErrors).some(Boolean)&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">Some financial data is unavailable: {Object.values(loadErrors).filter(Boolean).join('; ')} <Button variant="outline" onClick={()=>{loadOverview();loadComparison();loadTransactions()}}>Retry</Button></div>}
      {/* Page Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold stripe-text-primary">Finances</h1>
          <p className="stripe-text-secondary text-sm mt-1">
            Financial overview, transactions, and payroll management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Compact balance indicators */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openConfigModal('stripe')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors text-sm"
              title="Stripe balance"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-indigo-600" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
              </svg>
              <span className="font-semibold text-gray-900">
                {balancesLoading ? '...' : balances?.stripe ? formatCurrency(balances.stripe.available) : '--'}
              </span>
              {!balances?.stripe && !balancesLoading && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
            <button
              onClick={() => openConfigModal('payoneer')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors text-sm"
              title="Payoneer balance"
            >
              <Banknote className="w-3.5 h-3.5 text-orange-600" />
              <span className="font-semibold text-gray-900">
                {balancesLoading ? '...' : balances?.payoneer ? formatCurrency(balances.payoneer.available) : '--'}
              </span>
              {!balances?.payoneer && !balancesLoading && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
            <button
              onClick={() => setLocation('/admin/time-tracking')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-colors text-sm"
              title="Open ClickUp time tracking"
            >
              <Clock3 className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-semibold text-gray-900">
                {clickupIntegration?.workspaceName || 'Time Tracking'}
              </span>
              {clickupIntegration?.isActive ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setLocation(`/admin/finances/${value}`)} className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 touch-scroll-x sm:grid sm:grid-cols-5 sm:justify-center sm:overflow-visible">
          <TabsTrigger value="overview" className="min-w-[6.5rem] flex-none sm:min-w-0 sm:flex-1">Overview</TabsTrigger>
          <TabsTrigger value="transactions" className="min-w-[8.25rem] flex-none sm:min-w-0 sm:flex-1">Transactions</TabsTrigger>
          <TabsTrigger value="salaries" className="min-w-[6.5rem] flex-none sm:min-w-0 sm:flex-1">Salaries</TabsTrigger>
          <TabsTrigger value="categories" className="min-w-[7rem] flex-none sm:min-w-0 sm:flex-1">Categories</TabsTrigger>
          <TabsTrigger value="logs" className="min-w-[5.75rem] flex-none sm:min-w-0 sm:flex-1">Logs</TabsTrigger>
        </TabsList>

        {/* ========== TAB 1: OVERVIEW ========== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Date Range Presets Bar */}
          <div className="stripe-card p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Preset chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePresetChange(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      datePreset === p.key
                        ? 'bg-[var(--stripe-primary)] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom date inputs */}
              {datePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onClick={openNativeDatePicker}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg border-gray-200 bg-white text-xs text-gray-900"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onClick={openNativeDatePicker}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg border-gray-200 bg-white text-xs text-gray-900"
                  />
                  <button
                    onClick={handleCustomDateApply}
                    disabled={!customStart || !customEnd}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--stripe-primary)] text-white disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Separator + Compare toggle */}
              <div className="lg:ml-auto flex items-center gap-3">
                {/* Date range label */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateRangeLabel(dateRange.start, dateRange.end)}</span>
                </div>

                {/* Compare toggle */}
                <button
                  onClick={() => setCompareEnabled(!compareEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    compareEnabled
                      ? 'border-[var(--stripe-primary)] bg-indigo-50 text-[var(--stripe-primary)]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <ArrowRight className="h-3 w-3" />
                  Compare
                </button>
              </div>
            </div>

            {/* Comparison info bar */}
            {compareEnabled && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[var(--stripe-primary)] font-medium">
                  Current
                </span>
                <span>{formatDateRangeLabel(dateRange.start, dateRange.end)}</span>
                <span className="text-gray-300 mx-1">vs</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                  Previous
                </span>
                <span>{formatDateRangeLabel(comparisonRange.start, comparisonRange.end)}</span>
                {comparisonLoading && <div className="ml-1 inline-block h-3 w-14 animate-pulse rounded-full bg-[var(--stripe-primary)]/25" />}
              </div>
            )}
          </div>

          {overviewLoading ? (
            <div className="space-y-4 py-2">
              <CardSkeleton titleWidth="w-44" lines={3} tall />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <MetricTileSkeleton key={index} />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CardSkeleton titleWidth="w-40" lines={4} tall />
                <CardSkeleton titleWidth="w-40" lines={4} tall />
              </div>
            </div>
          ) : (
            <>
              {/* Hero P&L Card */}
              <div className={`stripe-card overflow-hidden border-l-4 p-4 sm:p-6 ${netPL >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      <LabelWithInfo label="Net Profit / Loss" infoKey="netProfitLoss" />
                    </p>
                    <p className={`text-[1.75rem] font-bold leading-none sm:text-3xl ${netPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(netPL)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <span className="text-xs text-gray-500">
                        <LabelWithInfo label="Margin" infoKey="margin" className="font-normal" />:{' '}
                        <span className={`font-semibold ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{profitMargin.toFixed(1)}%</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        <LabelWithInfo label="Salary/Revenue" infoKey="salaryRatio" className="font-normal" />:{' '}
                        <span className="font-semibold text-blue-600">{salaryToRevenue.toFixed(1)}%</span>
                      </span>
                      {compareEnabled && comparisonData && (() => {
                        const ch = computeChange(netPL, compNetPL)
                        return (
                          <span className={`text-xs font-semibold ${ch.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {ch.delta >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(ch.delta))}
                            {ch.pct !== null && ` (${ch.pct >= 0 ? '+' : ''}${ch.pct.toFixed(1)}%)`}
                            <span className="text-gray-400 font-normal ml-1">vs prior</span>
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="grid w-full min-w-0 grid-cols-2 gap-3 border-t border-gray-100 pt-4 lg:w-auto lg:border-t-0 lg:pt-0 lg:pl-6">
                    <div className="min-w-0 text-left lg:text-right">
                      <p className="mb-0.5 text-xs text-gray-500">
                        <LabelWithInfo label="Revenue" infoKey="totalRevenue" />
                      </p>
                      <p className="truncate text-base font-bold text-emerald-600 sm:text-lg">{formatCurrency(totalIncome)}</p>
                      {compareEnabled && comparisonData ? (() => {
                        const ch = computeChange(totalIncome, compTotalIncome)
                        return (
                          <p className={`text-[10px] font-medium mt-0.5 ${ch.delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {ch.delta >= 0 ? '↑' : '↓'} {ch.pct !== null ? `${ch.pct >= 0 ? '+' : ''}${ch.pct.toFixed(1)}%` : formatCurrency(Math.abs(ch.delta))}
                          </p>
                        )
                      })() : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">Clients: {formatCurrency(overviewData?.clientPayments || 0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 border-l border-gray-200 pl-3 text-left lg:text-right">
                      <p className="mb-0.5 text-xs text-gray-500">
                        <LabelWithInfo label="Costs" infoKey="totalCosts" />
                      </p>
                      <p className="truncate text-base font-bold text-red-500 sm:text-lg">{formatCurrency(totalExpenses)}</p>
                      {compareEnabled && comparisonData ? (() => {
                        const ch = computeChange(totalExpenses, compTotalExpenses)
                        return (
                          <p className={`text-[10px] font-medium mt-0.5 ${ch.delta <= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {ch.delta > 0 ? '↑' : '↓'} {ch.pct !== null ? `${ch.pct >= 0 ? '+' : ''}${ch.pct.toFixed(1)}%` : formatCurrency(Math.abs(ch.delta))}
                          </p>
                        )
                      })() : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">Salaries: {formatCurrency(overviewData?.totalSalaries || 0)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Client Revenue', infoKey: 'clientRevenue' as FinanceInfoKey, value: overviewData?.clientPayments || 0, compValue: comparisonData?.clientPayments || 0, icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />, bg: 'bg-emerald-50', positive: true },
                  { label: 'Other Income', infoKey: 'otherIncome' as FinanceInfoKey, value: overviewData?.manualIncome || 0, compValue: comparisonData?.manualIncome || 0, icon: <Receipt className="h-3.5 w-3.5 text-teal-600" />, bg: 'bg-teal-50', positive: true },
                  { label: 'Salaries', infoKey: 'salaries' as FinanceInfoKey, value: overviewData?.totalSalaries || 0, compValue: comparisonData?.totalSalaries || 0, icon: <Users className="h-3.5 w-3.5 text-blue-600" />, bg: 'bg-blue-50', positive: false },
                  { label: 'Other Expenses', infoKey: 'otherExpenses' as FinanceInfoKey, value: overviewData?.manualExpenses || 0, compValue: comparisonData?.manualExpenses || 0, icon: <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />, bg: 'bg-red-50', positive: false },
                  { label: 'Avg Monthly P&L', infoKey: 'avgMonthlyPL' as FinanceInfoKey, value: monthlyNetArr.length > 0 ? netPL / monthlyNetArr.length : 0, compValue: (() => { const compMonthly = comparisonData?.monthlyBreakdown?.filter(m => { const inc2 = parseFloat(String(m.client_payments || 0)) + parseFloat(String(m.income || 0)); const exp2 = parseFloat(String(m.expense || 0)) + parseFloat(String(m.salary || 0)); return inc2 > 0 || exp2 > 0 }) || []; return compMonthly.length > 0 ? compNetPL / compMonthly.length : 0 })(), icon: <Activity className="h-3.5 w-3.5 text-amber-600" />, bg: 'bg-amber-50', positive: true },
                ].map((kpi) => {
                  const ch = compareEnabled && comparisonData ? computeChange(kpi.value, kpi.compValue) : null
                  const isGood = ch ? (kpi.positive ? ch.delta >= 0 : ch.delta <= 0) : true
                  return (
                    <div key={kpi.label} className="stripe-stat-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-md ${kpi.bg} flex items-center justify-center`}>
                          {kpi.icon}
                        </div>
                        <span className="text-xs text-gray-500">
                          <LabelWithInfo label={kpi.label} infoKey={kpi.infoKey} />
                        </span>
                      </div>
                      <p className={`text-xl font-bold ${kpi.label === 'Avg Monthly P&L' ? (kpi.value >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-900'}`}>
                        {formatCurrency(kpi.value)}
                      </p>
                      {ch && (
                        <p className={`text-[10px] font-medium mt-1 ${isGood ? 'text-emerald-500' : 'text-red-400'}`}>
                          {ch.delta >= 0 ? '↑' : '↓'} {ch.pct !== null ? `${ch.pct >= 0 ? '+' : ''}${ch.pct.toFixed(1)}%` : formatCurrency(Math.abs(ch.delta))}
                          <span className="text-gray-400 font-normal ml-1">vs prior</span>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Monthly Income vs Expenses Bar Chart - 2/3 */}
                <div className="lg:col-span-2 stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    <LabelWithInfo label="Monthly Revenue vs Costs" infoKey="monthlyRevenueVsCosts" />
                  </h3>
                  <div className="h-72">
                    <DeferredChart><FinanceRevenueChart chartData={chartData} /></DeferredChart>
                  </div>
                </div>

                {/* Cumulative P&L Area Chart - 1/3 */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    <LabelWithInfo label="Cumulative P&L" infoKey="cumulativePL" />
                  </h3>
                  <div className="h-72">
                    <DeferredChart><FinanceProfitChart cumulativePLData={cumulativePLData} netPL={netPL} /></DeferredChart>
                  </div>
                </div>
              </div>

              {/* Insights Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cost Breakdown */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    <LabelWithInfo label="Cost Breakdown" infoKey="costBreakdown" />
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Salaries', value: overviewData?.totalSalaries || 0, color: 'bg-indigo-500', pct: totalExpenses > 0 ? ((overviewData?.totalSalaries || 0) / totalExpenses) * 100 : 0 },
                      { label: 'Other Expenses', value: overviewData?.manualExpenses || 0, color: 'bg-red-400', pct: totalExpenses > 0 ? ((overviewData?.manualExpenses || 0) / totalExpenses) * 100 : 0 },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900">{formatCurrency(item.value)}</span>
                            <span className="text-[10px] text-gray-400 w-10 text-right">{item.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Total Costs</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    <LabelWithInfo label="Revenue Sources" infoKey="revenueSources" />
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Client Payments', value: overviewData?.clientPayments || 0, color: 'bg-emerald-500', pct: totalIncome > 0 ? ((overviewData?.clientPayments || 0) / totalIncome) * 100 : 0 },
                      { label: 'Other Income', value: overviewData?.manualIncome || 0, color: 'bg-teal-400', pct: totalIncome > 0 ? ((overviewData?.manualIncome || 0) / totalIncome) * 100 : 0 },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900">{formatCurrency(item.value)}</span>
                            <span className="text-[10px] text-gray-400 w-10 text-right">{item.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Total Revenue</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(totalIncome)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Highlights */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Highlights</h3>
                  <div className="space-y-4">
                    {bestMonth && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            <LabelWithInfo label="Best Month" infoKey="bestMonth" />
                          </p>
                          <p className="text-sm font-semibold text-gray-900">{bestMonth.name}</p>
                          <p className="text-xs text-emerald-600 font-medium">{formatCurrency(bestMonth.net)} net</p>
                        </div>
                      </div>
                    )}
                    {worstMonth && worstMonth.name !== bestMonth?.name && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            <LabelWithInfo label="Worst Month" infoKey="worstMonth" />
                          </p>
                          <p className="text-sm font-semibold text-gray-900">{worstMonth.name}</p>
                          <p className="text-xs text-red-500 font-medium">{formatCurrency(worstMonth.net)} net</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          <LabelWithInfo label="Salary to Revenue" infoKey="salaryRatio" />
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{salaryToRevenue.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400">
                          {salaryToRevenue < 50 ? 'Healthy ratio' : salaryToRevenue < 70 ? 'Watch closely' : 'High ratio'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${profitMargin >= 20 ? 'bg-emerald-50' : profitMargin >= 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <Activity className={`h-3.5 w-3.5 ${profitMargin >= 20 ? 'text-emerald-600' : profitMargin >= 0 ? 'text-amber-600' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          <LabelWithInfo label="Profit Margin" infoKey="margin" />
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{profitMargin.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400">
                          {profitMargin >= 20 ? 'Strong' : profitMargin >= 10 ? 'Moderate' : profitMargin >= 0 ? 'Thin' : 'Negative'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly P&L Table */}
              <div className="stripe-card">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">
                    <LabelWithInfo label="Monthly P&L Summary" infoKey="monthlyPLSummary" />
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <LabelWithInfo label="Revenue" infoKey="tableRevenue" className="justify-end" />
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <LabelWithInfo label="Salaries" infoKey="salaries" className="justify-end" />
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <LabelWithInfo label="Other Costs" infoKey="tableOtherCosts" className="justify-end" />
                        </th>
                        <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <LabelWithInfo label="Net" infoKey="tableNet" className="justify-end" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rangeMonths.map(({ month, year, name }) => {
                        const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
                        const inc = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
                        const sal = entry ? parseFloat(String(entry.salary || 0)) : 0
                        const other = entry ? (parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.extra_payment || 0))) : 0
                        const net = inc - sal - other
                        const isEmpty = inc === 0 && sal === 0 && other === 0
                        const isCurrent = month - 1 === currentMonth && year === currentMonthYear

                        return (
                          <tr
                            key={`${year}-${month}`}
                            className={`${isEmpty ? 'text-gray-300' : ''} ${isCurrent ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'} transition-colors`}
                          >
                            <td className="px-6 py-2.5 font-medium text-gray-700">
                              {rangeMonths.length > 12 ? `${name} ${year}` : name}
                              {isCurrent && <span className="ml-2 text-[10px] text-blue-500 font-normal">current</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-emerald-600">
                              {isEmpty ? '-' : formatCurrency(inc)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">
                              {isEmpty ? '-' : formatCurrency(sal)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">
                              {isEmpty ? '-' : formatCurrency(other)}
                            </td>
                            <td className={`px-6 py-2.5 text-right font-semibold ${isEmpty ? '' : net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {isEmpty ? '-' : formatCurrency(net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/50 font-semibold">
                        <td className="px-6 py-3 text-gray-900">Total</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(totalIncome)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(overviewData?.totalSalaries || 0)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(overviewData?.manualExpenses || 0)}</td>
                        <td className={`px-6 py-3 text-right ${netPL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(netPL)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ========== TAB 2: TRANSACTIONS ========== */}
        <TabsContent value="transactions" className="space-y-6">
          {/* Filter Row */}
          <div className="stripe-card p-4">
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
              {/* Type filter */}
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="salary">Salary</option>
              </select>

              {/* Date range */}
              <div className="grid gap-2 sm:grid-cols-[180px_280px]">
                <select
                  value={txDatePreset}
                  onChange={(e) => handleTransactionPresetChange(e.target.value as TransactionDatePreset)}
                  className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                >
                  {TRANSACTION_DATE_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>{preset.label}</option>
                  ))}
                </select>
                {txDatePreset === 'custom' && (
                  <DateRangePicker
                    startDate={txStartDate}
                    endDate={txEndDate}
                    onStartDateChange={(date) => setTxStartDate(date || '')}
                    onEndDateChange={(date) => setTxEndDate(date || '')}
                  />
                )}
              </div>

              {/* Search */}
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search transactions..."
                className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm flex-1 min-w-[200px]"
              />

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setLocation('/admin/finances/categories')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border stripe-border stripe-text-primary hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Categories
                </button>
                <button
                  onClick={() => openAddTransaction('income')}
                  className="stripe-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: '#22c55e', color: '#fff' }}
                >
                  <Plus className="w-4 h-4" />
                  Add Income
                </button>
                <button
                  onClick={() => openAddTransaction('expense')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  <Plus className="w-4 h-4" />
                  Add Cost
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="stripe-card overflow-hidden">
            {txLoading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b stripe-border">
                      <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Category
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Description
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y stripe-border">
                    {getMergedRows().length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <Wallet className="w-12 h-12 mx-auto stripe-text-muted opacity-50 mb-3" />
                          <p className="stripe-text-muted">No transactions found</p>
                        </td>
                      </tr>
                    ) : (
                      getMergedRows().map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm stripe-text-primary whitespace-nowrap">
                            {formatDate(row.date)}
                          </td>
                          <td className="px-6 py-4">
                            {row.isClientPayment ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <CreditCard className="w-3 h-3" />
                                Invoice #{row.invoiceNumber}
                              </span>
                            ) : row.type === 'salary' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Banknote className="w-3 h-3" />
                                Salary
                              </span>
                            ) : row.type === 'income' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <ArrowUpRight className="w-3 h-3" />
                                Income
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <ArrowDownRight className="w-3 h-3" />
                                Expense
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm stripe-text-secondary">
                            {row.category || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm stripe-text-primary max-w-[300px] truncate">
                            {row.teamMemberName ? (
                              <span>
                                <span className="font-medium">{row.teamMemberName}</span>
                                {row.description ? ` — ${row.description}` : ''}
                              </span>
                            ) : (
                              row.description || '-'
                            )}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm font-semibold text-right whitespace-nowrap ${
                              row.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {row.type === 'income' ? '+' : '-'}
                            {formatCurrency(Math.abs(row.amount))}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {row.editable ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    const tx = transactions.find((t) => t.id === row.id)
                                    if (tx) openEditTransaction(tx)
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors stripe-text-muted hover:stripe-text-primary"
                                  title="Edit transaction"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(row.id as number)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400 hover:text-red-600"
                                  title="Delete transaction"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs stripe-text-muted">{row.type === 'salary' ? 'Salary' : 'Auto'}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========== TAB 3: SALARIES ========== */}
        <TabsContent value="salaries" className="space-y-6">
          {workflowAccess.error ? <div role="alert" className="rounded-md border p-4 text-sm">Payroll payment permissions could not be loaded. Payment history is still available. <Button variant="link" onClick={() => void workflowAccess.refetch()}>Try again</Button></div>
            : !workflowAccess.isLoading && !canRecordPayment && <p className="rounded-md border p-4 text-sm text-muted-foreground">Salary payments are read only. The workflow owner and finance deputy can record, edit and void payments.</p>}
          {/* Year Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium stripe-text-secondary">Year:</label>
            <select
              value={salariesYear}
              onChange={(e) => setSalariesYear(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {salariesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <CardSkeleton key={index} titleWidth="w-36" lines={4} />
              ))}
            </div>
          ) : (
            <>
              {/* Team Member Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(salariesData?.members || []).map((member) => {
                  const initials = member.name.split(' ').map((n) => n[0]).join('')
                  const monthlyExtras = normalizeSalaryExtras(member.monthlySalaryExtras).map(extra=>({...extra,amount:Math.round(parseMoney(extra.amount)*100*(member.employmentType==='part_time'?0.5:1))/100}))
                  const monthlyExtrasTotal = monthlyExtras.reduce((sum, extra) => sum + parseMoney(extra.amount), 0)
                  const monthlyTotalWithExtras = parseMoney(member.monthlyRate) + monthlyExtrasTotal
                  const remainingBalance = remainingSalaryByMember.get(member.id) ?? { total: 0, byMonth: [] }
                  const remainingToPay = remainingBalance.total

                  return (
                    <div key={member.id} className="stripe-card p-6">
                      <div className="flex items-start gap-3 mb-4">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-slate-700 text-white font-medium flex items-center justify-center text-sm ring-2 ring-gray-100">
                              {initials}
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                            member.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold stripe-text-primary text-base truncate">
                            {member.name}
                          </h4>
                          <p className="text-sm stripe-text-muted truncate">{member.position || 'Team Member'}{member.employmentType==='part_time'?' · Part-time':''}</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="stripe-text-secondary">Monthly Base</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium stripe-text-primary">
                              {formatCurrency(member.monthlyRate)}
                            </span>
                            <button
                              onClick={() => openRateModal(member)}
                              className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600"
                              title="Edit monthly rate"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {monthlyExtras.length > 0 ? (
                          <details className="group rounded-lg border stripe-border bg-gray-50/50">
                            <summary className="list-none cursor-pointer px-3 py-2">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="stripe-text-secondary">Monthly Extras</span>
                                  <span className="text-xs stripe-text-muted whitespace-nowrap">
                                    {monthlyExtras.length} item{monthlyExtras.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="font-medium stripe-text-primary">
                                    {formatCurrency(monthlyExtrasTotal)}
                                  </span>
                                  <ChevronDown className="w-4 h-4 stripe-text-muted transition-transform group-open:rotate-180" />
                                </div>
                              </div>
                            </summary>
                            <div className="px-3 pb-3 pt-0 space-y-1 border-t stripe-border">
                              {monthlyExtras.map((extra, index) => (
                                <div
                                  key={`${member.id}-${extra.label}-${index}`}
                                  className="flex justify-between gap-3 text-xs stripe-text-muted pt-2"
                                >
                                  <span className="truncate">{extra.label}</span>
                                  <span className="whitespace-nowrap">{formatCurrency(extra.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <div className="flex justify-between text-sm">
                            <span className="stripe-text-secondary">Monthly Extras</span>
                            <span className="font-medium stripe-text-primary">
                              {formatCurrency(monthlyExtrasTotal)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Monthly Total</span>
                          <span className="font-semibold text-blue-600">
                            {formatCurrency(monthlyTotalWithExtras)}
                          </span>
                        </div>
                        <details className="group rounded-lg border stripe-border bg-gray-50/50">
                          <summary className="list-none cursor-pointer px-3 py-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="stripe-text-secondary">Recorded periods outstanding</span>
                                <span className="text-xs stripe-text-muted whitespace-nowrap">
                                  {remainingBalance.byMonth.length} month{remainingBalance.byMonth.length === 1 ? '' : 's'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-semibold ${remainingToPay > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {formatCurrency(remainingToPay)}
                                </span>
                                <ChevronDown className="w-4 h-4 stripe-text-muted transition-transform group-open:rotate-180" />
                              </div>
                            </div>
                          </summary>
                          <div className="px-3 pb-3 pt-0 space-y-1 border-t stripe-border">
                            {remainingBalance.byMonth.length > 0 ? (
                              remainingBalance.byMonth.map((entry) => (
                                <div
                                  key={`${member.id}-${entry.month}`}
                                  className="flex justify-between gap-3 text-xs stripe-text-muted pt-2"
                                >
                                  <span className="truncate">{formatMonthLabel(entry.month)}</span>
                                  <span className="whitespace-nowrap">{formatCurrency(entry.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="pt-2 text-xs stripe-text-muted">No unpaid balance in recorded salary periods.</p>
                            )}
                          </div>
                        </details>
                        <p className="text-xs text-amber-700">Earlier months without a recorded salary period have not been reconciled. This balance does not assert that historical salary is fully paid.</p>
                        {!member.currentPeriod?.id && <div className="rounded border p-3 text-sm"><p>Current month accrual has not been opened.</p><Button size="sm" variant="outline" className="mt-2" disabled={!!member.currentPeriod?.legacyPaymentIds?.length} onClick={async()=>{try{await api.request(`/finances/salaries/${member.id}/period/${new Date().toISOString().slice(0,7)}/initialize`,{method:'POST',body:'{}'});await loadSalaries()}catch(error){window.alert(error instanceof Error?error.message:'Unable to open salary period')}}}>Open current month accrual</Button></div>}
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Paid This Year</span>
                          <span className="font-medium stripe-text-primary">
                            {formatCurrency(member.totalPaidThisYear)}
                          </span>
                        </div>
                      </div>

                      <div className={`grid gap-2 ${canRecordPayment ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {canRecordPayment && <button
                          onClick={() => openRecordSalary(member)}
                          className="stripe-btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          <Wallet className="w-4 h-4" />
                          Record Payment
                        </button>}
                        <button
                          onClick={() => openSalaryHistory(member)}
                          className="flex items-center justify-center gap-2 rounded-lg border stripe-border px-4 py-2 text-sm font-medium stripe-text-primary hover:bg-gray-50 transition-colors"
                        >
                          <Clock3 className="w-4 h-4" />
                          History
                        </button>
                      </div>
                    </div>
                  )
                })}

                {(salariesData?.members || []).length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <Users className="w-12 h-12 mx-auto stripe-text-muted opacity-50 mb-3" />
                    <p className="stripe-text-muted">No team members found</p>
                  </div>
                )}
              </div>

              {/* Payment History */}
              {(salariesData?.recentPayments || []).length > 0 && (
                <div className="stripe-card overflow-hidden">
                  <div className="px-6 py-4 border-b stripe-border">
                    <h3 className="text-lg font-semibold stripe-text-primary">Payment History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b stripe-border">
                          <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Date
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Team Member
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Description
                          </th>
                          <th className="text-right px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Amount
                          </th>
                          {canRecordPayment && <th className="text-right px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Actions
                          </th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y stripe-border">
                        {(salariesData!.allPayments || salariesData!.recentPayments).filter(p => toInputMonth(p.transactionDate).startsWith(String(salariesYear))).map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm stripe-text-primary whitespace-nowrap">
                              {formatDate(payment.transactionDate)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium stripe-text-primary">
                              {payment.teamMemberName}
                            </td>
                            <td className="px-6 py-4 text-sm stripe-text-secondary">
                              {payment.description || '-'}{!payment.payrollData && <span className="ml-2 text-amber-700">Review required</span>}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right whitespace-nowrap">
                              {formatCurrency(payment.amount)}
                            </td>
                            {canRecordPayment && <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditSalaryPayment(payment)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600"
                                  title="Edit salary payment"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSalaryPayment(payment.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400 hover:text-red-600"
                                  title="Void salary payment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== TAB 4: LOGS ========== */}
        <TabsContent value="logs" className="space-y-6">
          <div className="stripe-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold stripe-text-primary">Finance Activity Logs</h3>
                <p className="mt-1 text-sm stripe-text-muted">
                  Audit trail for invoices, transactions, salary payments, and salary updates.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={applyFinanceLogFilters}
                  className="inline-flex items-center gap-2 rounded-lg border stripe-border px-3 py-2 text-sm font-medium stripe-text-primary hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Apply filters
                </button>
                <button
                  onClick={clearFinanceLogFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="stripe-card p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">Search</span>
                <input
                  type="text"
                  value={financeLogFilters.q}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Search summary or JSON details"
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">Action</span>
                <select
                  value={financeLogFilters.action}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, action: e.target.value }))}
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                >
                  <option value="">All actions</option>
                  <option value="invoice_created">Invoice created</option>
                  <option value="invoice_updated">Invoice updated</option>
                  <option value="invoice_deleted">Invoice deleted</option>
                  <option value="transaction_created">Transaction created</option>
                  <option value="transaction_updated">Transaction updated</option>
                  <option value="transaction_deleted">Transaction deleted</option>
                  <option value="salary_payment_created">Salary payment created</option>
                  <option value="salary_payment_updated">Salary payment updated</option>
                  <option value="salary_payment_deleted">Salary payment deleted</option>
                  <option value="salary_rate_updated">Salary rate updated</option>
                  <option value="salary_extras_updated">Salary extras updated</option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">Entity Type</span>
                <select
                  value={financeLogFilters.entityType}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, entityType: e.target.value }))}
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                >
                  <option value="">All entities</option>
                  <option value="invoice">Invoice</option>
                  <option value="transaction">Transaction</option>
                  <option value="salary_payment">Salary payment</option>
                  <option value="salary_rate">Salary rate</option>
                  <option value="salary_extras">Salary extras</option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">Team Member</span>
                <select
                  value={financeLogFilters.teamMemberId}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, teamMemberId: e.target.value }))}
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                >
                  <option value="">All team members</option>
                  {(salariesData?.members || []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">Entity ID</span>
                <input
                  type="number"
                  min="1"
                  value={financeLogFilters.entityId}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, entityId: e.target.value }))}
                  placeholder="Optional entity record id"
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">From</span>
                <input
                  type="date"
                  value={financeLogFilters.startDate}
                  onClick={openNativeDatePicker}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="block font-medium stripe-text-secondary">To</span>
                <input
                  type="date"
                  value={financeLogFilters.endDate}
                  onClick={openNativeDatePicker}
                  onChange={(e) => setFinanceLogFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-lg border stripe-border bg-white px-3 py-2 stripe-text-primary"
                />
              </label>
            </div>
          </div>

          {financeLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-40 animate-pulse rounded-full bg-blue-200/50" />
            </div>
          ) : financeLogs.length === 0 ? (
            <div className="stripe-card p-6 text-sm stripe-text-muted">
              No finance activity has been logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {financeLogs.map((entry) => (
                <div key={entry.id} className="stripe-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getHistoryBadgeVariant(entry.action)}>
                          {formatHistoryAction(entry.action)}
                        </Badge>
                        <span className="text-sm font-semibold stripe-text-primary">{entry.summary}</span>
                      </div>
                      <p className="text-xs stripe-text-muted">
                        By {entry.actorName || 'Unknown'} • {formatDate(entry.createdAt)} • {entry.entityType} #{entry.entityId}
                      </p>
                    </div>
                  </div>

                  {(entry.beforeData || entry.afterData || entry.metadata) && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {entry.beforeData && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">Before</p>
                          <p className="text-sm stripe-text-primary">{formatHistoryValue(entry.beforeData)}</p>
                        </div>
                      )}
                      {entry.afterData && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">After</p>
                          <p className="text-sm stripe-text-primary">{formatHistoryValue(entry.afterData)}</p>
                        </div>
                      )}
                      {entry.metadata && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">Details</p>
                          <p className="text-sm stripe-text-primary">{formatHistoryValue(entry.metadata)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>


        {/* ========== TAB 5: CATEGORIES ========== */}
        <TabsContent value="categories" className="space-y-6">
          <div className="stripe-card p-6">
            <h3 className="text-lg font-semibold stripe-text-primary">Category Settings</h3>
            <p className="text-sm stripe-text-muted mt-1">
              Manage separate category lists for Income and Cost transactions.
            </p>
          </div>

          {categoriesLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <CardSkeleton titleWidth="w-40" lines={4} tall />
              <CardSkeleton titleWidth="w-40" lines={4} tall />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="stripe-card p-6 space-y-4">
                <div>
                  <h4 className="text-base font-semibold text-green-700">Income Categories</h4>
                  <p className="text-xs stripe-text-muted mt-0.5">Used in Add Income popup</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newIncomeCategoryName}
                    onChange={(e) => setNewIncomeCategoryName(e.target.value)}
                    placeholder="Add income category"
                    className="flex-1 px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                  <button
                    onClick={() => handleAddCategoryFromSettings('income')}
                    disabled={categoriesSaving || !newIncomeCategoryName.trim()}
                    className="px-3 py-2 rounded-lg text-sm font-medium stripe-btn-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {categories.income.length === 0 ? (
                    <p className="text-sm stripe-text-muted italic">No categories yet.</p>
                  ) : (
                    categories.income.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-lg border stripe-border px-3 py-2"
                      >
                        <span className="text-sm stripe-text-primary">{category.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRenameCategory(category)}
                            disabled={categoriesSaving}
                            className="p-1.5 rounded-md hover:bg-gray-100 stripe-text-muted hover:stripe-text-primary disabled:opacity-50"
                            title="Rename category"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            disabled={categoriesSaving}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="stripe-card p-6 space-y-4">
                <div>
                  <h4 className="text-base font-semibold text-red-700">Cost Categories</h4>
                  <p className="text-xs stripe-text-muted mt-0.5">Used in Add Cost popup</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newExpenseCategoryName}
                    onChange={(e) => setNewExpenseCategoryName(e.target.value)}
                    placeholder="Add cost category"
                    className="flex-1 px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                  <button
                    onClick={() => handleAddCategoryFromSettings('expense')}
                    disabled={categoriesSaving || !newExpenseCategoryName.trim()}
                    className="px-3 py-2 rounded-lg text-sm font-medium stripe-btn-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {categories.expense.length === 0 ? (
                    <p className="text-sm stripe-text-muted italic">No categories yet.</p>
                  ) : (
                    categories.expense.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-lg border stripe-border px-3 py-2"
                      >
                        <span className="text-sm stripe-text-primary">{category.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRenameCategory(category)}
                            disabled={categoriesSaving}
                            className="p-1.5 rounded-md hover:bg-gray-100 stripe-text-muted hover:stripe-text-primary disabled:opacity-50"
                            title="Rename category"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            disabled={categoriesSaving}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ========== TRANSACTION ADD/EDIT MODAL ========== */}
      {showTxModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTxModal(false)}
        >
          <div
            className="stripe-card p-6 w-full max-w-md rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold stripe-text-primary mb-1">
              {editingTx ? 'Edit Transaction' : 'Add Transaction'}
            </h3>
            <p className="text-sm stripe-text-muted mb-5">
              {editingTx ? 'Update transaction details' : 'Create a new financial transaction'}
            </p>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Type
                </label>
                <select
                  value={txForm.type}
                  onChange={(e) => {
                    const nextType = e.target.value
                    const nextKind: FinanceCategoryKind = nextType === 'income' ? 'income' : 'expense'
                    const hasCategoryInNextList = categories[nextKind].some(
                      (category) => category.name.toLowerCase() === txForm.category.toLowerCase()
                    )

                    setTxForm({
                      ...txForm,
                      type: nextType,
                      category: hasCategoryInNextList ? txForm.category : '',
                    })
                    setShowNewTxCategoryInput(false)
                    setNewTxCategoryName('')
                  }}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Category
                </label>
                <select
                  value={showNewTxCategoryInput ? '__new__' : txForm.category}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '__new__') {
                      setShowNewTxCategoryInput(true)
                      setNewTxCategoryName('')
                      return
                    }

                    setShowNewTxCategoryInput(false)
                    setTxForm({ ...txForm, category: value })
                  }}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                >
                  <option value="">Select category</option>
                  {txCategoryOptions.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                  {txForm.category && !txCategoryExists && (
                    <option value={txForm.category}>{txForm.category}</option>
                  )}
                  <option value="__new__">+ Create new category</option>
                </select>
                {categoriesLoading && (
                  <p className="text-xs stripe-text-muted mt-1.5">Loading categories...</p>
                )}
                {showNewTxCategoryInput && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={newTxCategoryName}
                      onChange={(e) => setNewTxCategoryName(e.target.value)}
                      placeholder={`New ${txCategoryKind === 'income' ? 'income' : 'cost'} category`}
                      className="flex-1 px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleQuickCreateTxCategory}
                      disabled={categoriesSaving || !newTxCategoryName.trim()}
                      className="px-3 py-2 rounded-lg text-sm font-medium stripe-btn-primary disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTxCategoryInput(false)
                        setNewTxCategoryName('')
                      }}
                      className="px-3 py-2 rounded-lg text-sm font-medium border stripe-border stripe-text-primary hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm resize-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={txForm.transactionDate}
                  onClick={openNativeDatePicker}
                  onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              {/* Is Recurring */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border stripe-border">
                <input
                  type="checkbox"
                  id="txRecurring"
                  checked={txForm.isRecurring}
                  onChange={(e) => setTxForm({ ...txForm, isRecurring: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="txRecurring"
                  className="text-sm font-medium stripe-text-primary cursor-pointer"
                >
                  Label as a recurring expense (manual entry each period)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg stripe-border stripe-text-primary text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTransaction}
                  disabled={txSaving || !txForm.amount}
                  className="flex-1 stripe-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {txSaving ? 'Saving...' : editingTx ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== SALARY PAYMENT MODAL ========== */}
      {showSalaryModal && selectedMember && canRecordPayment && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowSalaryModal(false); setEditingSalaryPayment(null) }}
        >
          <div
            className="stripe-card p-6 w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold stripe-text-primary mb-1">
              {editingSalaryPayment ? 'Edit Salary Payment' : 'Record Salary Payment'}
            </h3>
            <p className="text-sm stripe-text-muted mb-5">
              {selectedMember.name} — {selectedMember.position || 'Team Member'}
            </p>

            <div className="space-y-4">
              {/* Salary Month */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Salary Month
                </label>
                <input
                  type="month"
                  value={salaryForm.salaryMonth}
                  onChange={(e) => handleSalaryMonthChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
                <p className="text-xs stripe-text-muted mt-1.5">
                  Salary terms apply to periods beginning on or after their effective date, and are saved when the accrual is opened or the first payment is recorded. Attendance does not automatically change the fixed monthly amount.
                  {salaryPeriodInfo?.legacyPaymentIds?.length ? <span className="block text-amber-700">Historical payments require review: {salaryPeriodInfo.legacyPaymentIds.join(', ')}. Open each payment in History and reconcile its month and components.</span> : null}
                </p>
              </div>

              {salaryNeedsReview&&<div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>Historical terms need review. The suggested base may come from the current profile; unknown past monthly extras are not added automatically. Verify the salary month and every component against payroll records.</p>{editingSalaryPayment?.payrollData?.version!==1&&editingSalaryPayment?.description&&<p className="mt-2 whitespace-pre-wrap text-xs">Original description (reference only): {editingSalaryPayment.description}</p>}<label className="mt-3 flex gap-2 items-start"><input type="checkbox" checked={salaryReviewConfirmed} onChange={event=>setSalaryReviewConfirmed(event.target.checked)}/><span>I confirmed the month, base salary and extras. My reconciliation reason is entered in Note.</span></label></div>}

              {/* Planned Salary */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Full Salary For Month
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!!salaryPeriodInfo?.id}
                    value={salaryForm.baseSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                </div>
                <p className="text-xs stripe-text-muted mt-1.5">
                  Fixed monthly USD salary. An adjustment requires a reason in the note; saved periods retain their base salary.
                </p>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Pay Salary Now
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={maxSalaryPayment > 0 ? maxSalaryPayment : undefined}
                    value={salaryForm.paymentAmount}
                    onChange={(e) => setSalaryForm({ ...salaryForm, paymentAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                </div>
                <p className="text-xs stripe-text-muted mt-1.5">
                  Enter a partial payout to record an advance. Use extras for bonuses. Record workspace reimbursements from the Reimbursements page to keep their payment references linked.
                </p>
              </div>

              {/* Extras */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium stripe-text-secondary">Extras</label>
                  <button
                    type="button"
                    onClick={addSalaryExtra}
                    className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--stripe-primary)' }}
                  >
                    + Add Extra
                  </button>
                </div>
                {salaryBenefitFactor===0.5&&<p className="mb-3 text-sm text-blue-700">Enter full-time bonus and benefit amounts below. This part-time payment includes 50% of each extra. The actual base salary is unchanged.</p>}
                {salaryForm.extras.length === 0 && (
                  <p className="text-xs stripe-text-muted italic py-2">
                    No extras added. Click "+ Add Extra" for subscriptions, bonuses, etc.
                  </p>
                )}
                <div className="space-y-2">
                  {salaryForm.extras.map((extra, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={extra.label}
                        onChange={(e) => updateSalaryExtra(i, 'label', e.target.value)}
                        placeholder="e.g. Cursor, Extra work"
                        className="flex-1 px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                      />
                      <div className="relative w-28 flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={extra.amount}
                          onChange={(e) => updateSalaryExtra(i, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSalaryExtra(i)}
                        className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg p-3 stripe-surface stripe-border" style={{ borderWidth: '1px' }}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs stripe-text-muted uppercase tracking-wide">Already Paid</p>
                    <p className="font-semibold stripe-text-primary">
                      {formatCurrency(salaryMonthContext.alreadyPaidBase)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs stripe-text-muted uppercase tracking-wide">Remaining After</p>
                    <p className={`font-semibold ${remainingSalary > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatCurrency(remainingSalary)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs stripe-text-muted uppercase tracking-wide">Extras</p>
                    <p className="font-semibold stripe-text-primary">
                      {formatCurrency(extrasTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs stripe-text-muted uppercase tracking-wide">Total Payout Now</p>
                    <p className="text-lg font-bold" style={{ color: 'var(--stripe-primary)' }}>
                      {formatCurrency(salaryTotal)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--stripe-border)' }}>
                  <div className="flex justify-between text-xs stripe-text-muted">
                    <span>Salary month</span>
                    <span>{formatMonthLabel(salaryForm.salaryMonth)}</span>
                  </div>
                  <div className="flex justify-between text-xs stripe-text-muted">
                    <span>Full salary</span>
                    <span>{formatCurrency(plannedSalaryAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs stripe-text-muted">
                    <span>Paying now</span>
                    <span>{formatCurrency(salaryPaymentAmount)}</span>
                  </div>
                </div>
                {salaryForm.extras.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-0.5" style={{ borderColor: 'var(--stripe-border)' }}>
                    <div className="flex justify-between text-xs stripe-text-muted">
                      <span>Salary now</span>
                      <span>{formatCurrency(salaryPaymentAmount)}</span>
                    </div>
                    {salaryForm.extras.map((extra, i) => (
                      extra.label && extra.amount ? (
                        <div key={i} className="flex justify-between text-xs stripe-text-muted">
                          <span>{extra.label}</span>
                          <span>{formatCurrency(Math.round(parseMoney(extra.amount)*100*salaryBenefitFactor)/100)}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  {salaryIsAdvance ? (
                    <p className="text-xs font-medium text-amber-600">
                      This payout will be recorded as an advance for {formatMonthLabel(salaryForm.salaryMonth)}.
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-emerald-600">
                      This payout closes the salary balance for {formatMonthLabel(salaryForm.salaryMonth)}.
                    </p>
                  )}
                  {salaryBaseTooLow && (
                    <p className="text-xs font-medium text-red-600 mt-1.5">
                      Full salary cannot be lower than what has already been paid for this month.
                    </p>
                  )}
                  {salaryOverpayment > 0 && (
                    <p className="text-xs font-medium text-red-600 mt-1.5">
                      Salary payment exceeds the remaining balance by {formatCurrency(salaryOverpayment)}.
                    </p>
                  )}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Date</label>
                <input
                  type="date"
                  value={salaryForm.transactionDate}
                  onClick={openNativeDatePicker}
                  onChange={(e) => setSalaryForm({ ...salaryForm, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={salaryForm.note}
                  onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                  placeholder="Any additional notes"
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowSalaryModal(false); setEditingSalaryPayment(null) }}
                  className="flex-1 px-4 py-2 border rounded-lg stripe-border stripe-text-primary text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordSalary}
                  disabled={salarySaving || !salaryCanSave}
                  className="flex-1 stripe-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {salarySaving
                    ? (editingSalaryPayment ? 'Saving...' : 'Recording...')
                    : (editingSalaryPayment ? `Save ${formatCurrency(salaryTotal)}` : `Record ${formatCurrency(salaryTotal)}`)
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== SALARY RATE EDIT MODAL ========== */}
      {showRateModal && rateMember && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRateModal(false)}
        >
          <div
            className="stripe-card p-6 w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-shrink-0">
                {rateMember.avatarUrl ? (
                  <img src={rateMember.avatarUrl} alt={rateMember.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-medium flex items-center justify-center text-sm">
                    {rateMember.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold stripe-text-primary">Salary Settings</h3>
                <p className="text-sm stripe-text-muted">{rateMember.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Monthly Rate */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Monthly Rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rateForm.monthlyRate}
                    onChange={(e) => setRateForm({ ...rateForm, monthlyRate: e.target.value })}
                    className="w-full pl-7 pr-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                </div>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Effective Date</label>
                <input
                  type="date"
                  value={rateForm.effectiveDate}
                  onClick={openNativeDatePicker}
                  onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={rateForm.note}
                  onChange={(e) => setRateForm({ ...rateForm, note: e.target.value })}
                  placeholder="e.g. Annual raise, promotion"
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              <div className="pt-2 border-t stripe-border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary">Default Monthly Extras</label>
                    <p className="text-xs stripe-text-muted mt-1">
                      Rates and defaults apply to monthly periods beginning on or after this date. Saved salary periods retain their original terms.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRateExtra}
                    className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--stripe-primary)' }}
                  >
                    + Add Extra
                  </button>
                </div>

                {rateForm.monthlyExtras.length === 0 && (
                  <p className="text-xs stripe-text-muted italic py-2">
                    Enter default bonuses and subscriptions at their full-time amounts. Part-time payroll automatically pays 50%. Workspace reimbursements are paid from the Reimbursements page.
                  </p>
                )}

                <div className="space-y-2">
                  {rateForm.monthlyExtras.map((extra, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={extra.label}
                        onChange={(e) => updateRateExtra(index, 'label', e.target.value)}
                        placeholder="e.g. Bonus, Cursor"
                        className="flex-1 px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                      />
                      <div className="relative w-28 flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={extra.amount}
                          onChange={(e) => updateRateExtra(index, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRateExtra(index)}
                        className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowRateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg stripe-border stripe-text-primary text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRate}
                  disabled={rateSaving || !rateForm.monthlyRate}
                  className="flex-1 stripe-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {rateSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              {/* Rate History */}
              <div className="pt-3 border-t stripe-border">
                <h4 className="text-sm font-semibold stripe-text-primary mb-3">Rate History</h4>
                {rateHistoryLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-blue-200/50" />
                  </div>
                ) : rateHistory.length === 0 ? (
                  <p className="text-xs stripe-text-muted italic py-2">No rate changes recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rateHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between py-2 px-3 rounded-lg stripe-surface text-sm">
                        <div>
                          <span className="font-medium stripe-text-primary">
                            {formatCurrency(entry.monthlyRate)}
                          </span>
                          <span className="stripe-text-muted ml-2">
                            from {formatDate(entry.effectiveDate)}
                          </span>
                          {entry.note && (
                            <p className="text-xs stripe-text-muted mt-0.5">{entry.note}</p>
                          )}
                        </div>
                        <span className="text-xs stripe-text-muted whitespace-nowrap ml-3">
                          {entry.createdBy || 'System'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={showSalaryHistoryModal}
        onOpenChange={(open) => {
          setShowSalaryHistoryModal(open)
          if (!open) {
            setSalaryHistoryMember(null)
            setSalaryHistoryEntries([])
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>
                  Salary History{salaryHistoryMember ? ` • ${salaryHistoryMember.name}` : ''}
                </DialogTitle>
                <DialogDescription>
                  Audit trail for salary payments, salary rate changes, and default extras.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSalaryHistoryModal(false)
                  setLocation('/admin/finances/logs')
                }}
                className="inline-flex items-center gap-2 rounded-lg border stripe-border px-3 py-2 text-xs font-medium stripe-text-primary hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Logs page
              </button>
            </div>
          </DialogHeader>

          {salaryHistoryLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-40 animate-pulse rounded-full bg-blue-200/50" />
            </div>
          ) : salaryHistoryEntries.length === 0 ? (
            <div className="rounded-xl border stripe-border bg-gray-50/70 p-6 text-sm stripe-text-muted">
              No salary history found for this team member yet.
            </div>
          ) : (
            <div className="space-y-3">
              {salaryHistoryEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border stripe-border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getHistoryBadgeVariant(entry.action)}>
                          {formatHistoryAction(entry.action)}
                        </Badge>
                        <span className="text-sm font-semibold stripe-text-primary">
                          {entry.title}
                        </span>
                      </div>
                      <p className="text-xs stripe-text-muted">
                        By {entry.actorName || 'Unknown'} • {formatDate(entry.createdAt)}
                        {entry.effectiveDate ? ` • Effective ${formatMonthLabel(entry.effectiveDate)}` : ''}
                      </p>
                    </div>
                  </div>

                  {entry.note && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm stripe-text-secondary">
                      {entry.note}
                    </p>
                  )}

                  {(entry.beforeData || entry.afterData || entry.metadata) && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {entry.beforeData && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">
                            Before
                          </p>
                          <p className="text-sm stripe-text-primary">
                            {formatHistoryValue(entry.beforeData)}
                          </p>
                        </div>
                      )}
                      {entry.afterData && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">
                            After
                          </p>
                          <p className="text-sm stripe-text-primary">
                            {formatHistoryValue(entry.afterData)}
                          </p>
                        </div>
                      )}
                      {entry.metadata && (
                        <div className="rounded-lg border stripe-border bg-gray-50/70 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] stripe-text-muted">
                            Details
                          </p>
                          <p className="text-sm stripe-text-primary">
                            {formatHistoryValue(entry.metadata)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========== INTEGRATION CONFIG MODAL ========== */}
      {showConfigModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowConfigModal(null)}
        >
          <div
            className="stripe-card p-6 w-full max-w-md rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold stripe-text-primary">
                {showConfigModal === 'stripe' ? 'Stripe' : showConfigModal === 'payoneer' ? 'Payoneer' : 'ClickUp'} Integration
              </h3>
              <button
                onClick={() => setShowConfigModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors stripe-text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm stripe-text-muted mb-5">
              {showConfigModal === 'stripe'
                ? 'Enter your Stripe secret key to connect your account.'
                : showConfigModal === 'payoneer'
                  ? 'Enter your Payoneer API credentials to connect your account.'
                  : 'Enter your ClickUp API token to validate the workspace and enable time syncing.'}
            </p>

            <div className="space-y-4">
              {showConfigModal === 'stripe' ? (
                <div>
                  <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                    Secret Key
                  </label>
                  <input
                    type="password"
                    value={stripeForm.secretKey}
                    onChange={(e) => setStripeForm({ secretKey: e.target.value })}
                    placeholder="sk_live_..."
                    className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm font-mono"
                  />
                  <p className="text-xs stripe-text-muted mt-1.5">
                    Find it at dashboard.stripe.com/apikeys
                  </p>
                </div>
              ) : showConfigModal === 'payoneer' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={payoneerForm.clientId}
                      onChange={(e) => setPayoneerForm({ ...payoneerForm, clientId: e.target.value })}
                      placeholder="Your Payoneer Client ID"
                      className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={payoneerForm.clientSecret}
                      onChange={(e) => setPayoneerForm({ ...payoneerForm, clientSecret: e.target.value })}
                      placeholder="Your Payoneer Client Secret"
                      className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                      Program ID
                    </label>
                    <input
                      type="text"
                      value={payoneerForm.programId}
                      onChange={(e) => setPayoneerForm({ ...payoneerForm, programId: e.target.value })}
                      placeholder="Your Payoneer Program ID"
                      className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                      Environment
                    </label>
                    <select
                      value={payoneerForm.environment}
                      onChange={(e) => setPayoneerForm({ ...payoneerForm, environment: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                      Personal API token
                    </label>
                    <input
                      type="password"
                      value={clickupForm.apiToken}
                      onChange={(e) => setClickupForm({ apiToken: e.target.value })}
                      placeholder="pk_..."
                      className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm font-mono"
                    />
                    <p className="text-xs stripe-text-muted mt-1.5">
                      Use a ClickUp workspace owner or admin token so Vestov Hub can fetch time entries across the team.
                    </p>
                  </div>
                  {clickupIntegration?.isActive && (
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                      <p className="font-medium">{clickupIntegration.workspaceName || 'Connected workspace'}</p>
                      <p className="mt-1 text-xs text-sky-800">
                        Workspace ID: {clickupIntegration.workspaceId || 'N/A'}
                        {clickupIntegration.authorizedUserName ? ` · Token owner: ${clickupIntegration.authorizedUserName}` : ''}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                {((showConfigModal === 'stripe' && balances?.stripe) ||
                  (showConfigModal === 'payoneer' && balances?.payoneer) ||
                  (showConfigModal === 'clickup' && clickupIntegration?.isActive)) && (
                  <button
                    onClick={() => handleDisconnectIntegration(showConfigModal)}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setShowConfigModal(null)}
                  className="px-4 py-2 border rounded-lg stripe-border stripe-text-primary text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIntegration}
                  disabled={
                    configSaving ||
                    (showConfigModal === 'stripe' && !stripeForm.secretKey) ||
                    (showConfigModal === 'payoneer' &&
                      (!payoneerForm.clientId || !payoneerForm.clientSecret || !payoneerForm.programId)) ||
                    (showConfigModal === 'clickup' && !clickupForm.apiToken)
                  }
                  className="stripe-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {configSaving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
