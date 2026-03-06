import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart,
  Bar,
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
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocation } from 'wouter'
import { api, type FinanceCategory, type FinanceCategoryKind } from '@/lib/api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'last_year' | 'custom'

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'custom', label: 'Custom' },
]

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
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
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
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function toInputDate(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }
  return dateStr.split('T')[0]
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
  id: number
  name: string
  role: string | null
  monthlyRate: number
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

interface SalaryPayment {
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
  year: number
}

interface BalancesData {
  stripe: { available: number; pending: number; currency: string } | null
  payoneer: { available: number; currency: string } | null
  fetchedAt: string
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
}

type FinanceSection = 'overview' | 'transactions' | 'salaries' | 'categories'

const FINANCE_SECTIONS: FinanceSection[] = ['overview', 'transactions', 'salaries', 'categories']

export function FinancesPage() {
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
  const [txTypeFilter, setTxTypeFilter] = useState('all')
  const [txStartDate, setTxStartDate] = useState('')
  const [txEndDate, setTxEndDate] = useState('')
  const [txSearch, setTxSearch] = useState('')
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
    baseSalary: '',
    extras: [] as { label: string; amount: string }[],
    transactionDate: toInputDate(),
    note: '',
  })
  const [salarySaving, setSalarySaving] = useState(false)

  // Rate editing state
  const [showRateModal, setShowRateModal] = useState(false)
  const [rateMember, setRateMember] = useState<SalaryMember | null>(null)
  const [rateForm, setRateForm] = useState({ monthlyRate: '', effectiveDate: toInputDate(), note: '' })
  const [rateSaving, setRateSaving] = useState(false)
  const [rateHistory, setRateHistory] = useState<RateHistoryEntry[]>([])
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false)


  // Balances state
  const [balances, setBalances] = useState<BalancesData | null>(null)
  const [balancesLoading, setBalancesLoading] = useState(true)

  // Integration config modal state
  const [showConfigModal, setShowConfigModal] = useState<'stripe' | 'payoneer' | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [stripeForm, setStripeForm] = useState({ secretKey: '' })
  const [payoneerForm, setPayoneerForm] = useState({
    clientId: '',
    clientSecret: '',
    programId: '',
    environment: 'sandbox',
  })

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

  // Load balances on mount
  useEffect(() => {
    loadBalances()
  }, [])

  // Load overview data when date range changes
  useEffect(() => {
    loadOverview()
  }, [dateRange.start, dateRange.end])

  // Load comparison data when enabled or range changes
  useEffect(() => {
    if (compareEnabled) {
      loadComparison()
    } else {
      setComparisonData(null)
    }
  }, [compareEnabled, dateRange.start, dateRange.end])

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

  const openConfigModal = (provider: 'stripe' | 'payoneer') => {
    setStripeForm({ secretKey: '' })
    setPayoneerForm({ clientId: '', clientSecret: '', programId: '', environment: 'sandbox' })
    setShowConfigModal(provider)
  }

  const handleSaveIntegration = async () => {
    if (!showConfigModal) return
    try {
      setConfigSaving(true)
      if (showConfigModal === 'stripe') {
        await api.saveIntegration('stripe', { secretKey: stripeForm.secretKey })
      } else {
        await api.saveIntegration('payoneer', payoneerForm)
      }
      setShowConfigModal(null)
      await loadBalances()
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
      await loadBalances()
      setShowConfigModal(null)
    } catch (error) {
      console.error('Failed to disconnect integration:', error)
    }
  }

  const loadOverview = async () => {
    try {
      setOverviewLoading(true)
      const data = await api.getFinancesOverview({
        startDate: dateRange.start,
        endDate: dateRange.end,
      })
      setOverviewData(data)
    } catch (error) {
      console.error('Failed to load finances overview:', error)
    } finally {
      setOverviewLoading(false)
    }
  }

  const loadComparison = async () => {
    try {
      setComparisonLoading(true)
      const compRange = getComparisonRange(dateRange.start, dateRange.end)
      const data = await api.getFinancesOverview({
        startDate: compRange.start,
        endDate: compRange.end,
      })
      setComparisonData(data)
    } catch (error) {
      console.error('Failed to load comparison data:', error)
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

  const loadTransactions = async () => {
    try {
      setTxLoading(true)
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
      setTransactions(txResult.status === 'fulfilled' ? txResult.value : [])
      setClientPayments(cpResult.status === 'fulfilled' ? cpResult.value : [])
    } catch (error) {
      console.error('Failed to load transactions:', error)
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
      console.error('Failed to load salaries:', error)
    } finally {
      setSalariesLoading(false)
    }
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

    // Add manual transactions (filter out salary type for this tab)
    for (const tx of transactions) {
      if (tx.type === 'salary') continue
      rows.push({
        id: tx.id,
        type: tx.type,
        amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
        date: tx.transactionDate,
        category: tx.category || '',
        description: tx.description || '',
        isClientPayment: false,
        editable: true,
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
            r.description.toLowerCase().includes(txSearch.toLowerCase()) ||
            r.category.toLowerCase().includes(txSearch.toLowerCase())
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
    try {
      await api.deleteFinancialTransaction(id)
      await loadTransactions()
      loadOverview()
    } catch (error) {
      console.error('Failed to delete transaction:', error)
    }
  }

  // Salary payment
  const openRecordSalary = (member: SalaryMember) => {
    setEditingSalaryPayment(null)
    setSelectedMember(member)
    setSalaryForm({
      baseSalary: String(member.monthlyRate || 0),
      extras: [],
      transactionDate: toInputDate(),
      note: '',
    })
    setShowSalaryModal(true)
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

  const salaryTotal = (() => {
    const base = parseFloat(salaryForm.baseSalary) || 0
    const extrasSum = salaryForm.extras.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    return base + extrasSum
  })()

  const handleRecordSalary = async () => {
    if (!selectedMember || salaryTotal <= 0) return
    try {
      setSalarySaving(true)
      const txDate = new Date(salaryForm.transactionDate)
      const monthName = MONTHS[txDate.getMonth()]

      // Build description with breakdown
      const parts: string[] = [`Base Salary: $${parseFloat(salaryForm.baseSalary).toFixed(2)}`]
      for (const extra of salaryForm.extras) {
        if (extra.label && extra.amount) {
          parts.push(`${extra.label}: $${parseFloat(extra.amount).toFixed(2)}`)
        }
      }
      if (salaryForm.note) parts.push(`Note: ${salaryForm.note}`)
      const description = `${monthName} ${txDate.getFullYear()} — ${parts.join(' + ')}`

      if (editingSalaryPayment) {
        await api.updateFinancialTransaction(editingSalaryPayment.id, {
          amount: salaryTotal,
          transactionDate: salaryForm.transactionDate,
          description,
        })
      } else {
        await api.recordSalaryPayment({
          teamMemberId: selectedMember.id,
          amount: salaryTotal,
          transactionDate: salaryForm.transactionDate,
          description,
        })
      }
      setShowSalaryModal(false)
      setSelectedMember(null)
      setEditingSalaryPayment(null)
      await loadSalaries()
      loadOverview()
    } catch (error) {
      console.error('Failed to record salary payment:', error)
    } finally {
      setSalarySaving(false)
    }
  }

  // Edit salary payment — parse description back into form fields
  const openEditSalaryPayment = (payment: SalaryPayment) => {
    const member = salariesData?.members.find((m) => m.id === payment.teamMemberId)
    if (!member) return

    let baseSalary = String(member.monthlyRate || 0)
    const extras: { label: string; amount: string }[] = []
    let note = ''

    // Parse description: "Jan 2026 — Base Salary: $3000.00 + Cursor: $20.00 + Note: some text"
    const desc = payment.description || ''
    const dashIdx = desc.indexOf('—')
    const breakdown = dashIdx >= 0 ? desc.slice(dashIdx + 1).trim() : desc
    const parts = breakdown.split(/\s*\+\s*/)

    for (const part of parts) {
      const match = part.match(/^(.+?):\s*\$?([\d.]+)$/)
      if (match) {
        const label = match[1].trim()
        const amount = match[2]
        if (label === 'Base Salary') {
          baseSalary = amount
        } else {
          extras.push({ label, amount })
        }
      } else if (part.startsWith('Note:')) {
        note = part.slice(5).trim()
      }
    }

    setEditingSalaryPayment(payment)
    setSelectedMember(member)
    setSalaryForm({
      baseSalary,
      extras,
      transactionDate: toInputDate(payment.transactionDate),
      note,
    })
    setShowSalaryModal(true)
  }

  // Delete salary payment
  const handleDeleteSalaryPayment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this salary payment?')) return
    try {
      await api.deleteFinancialTransaction(id)
      await loadSalaries()
      loadOverview()
    } catch (error) {
      console.error('Failed to delete salary payment:', error)
    }
  }

  // Rate editing
  const openRateModal = async (member: SalaryMember) => {
    setRateMember(member)
    setRateForm({
      monthlyRate: String(member.monthlyRate || 0),
      effectiveDate: toInputDate(),
      note: '',
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

  const handleSaveRate = async () => {
    if (!rateMember || !rateForm.monthlyRate || parseFloat(rateForm.monthlyRate) < 0) return
    try {
      setRateSaving(true)
      await api.updateSalaryRate(rateMember.id, {
        monthlyRate: parseFloat(rateForm.monthlyRate),
        effectiveDate: rateForm.effectiveDate,
        note: rateForm.note || undefined,
      })
      setShowRateModal(false)
      setRateMember(null)
      await loadSalaries()
    } catch (error) {
      console.error('Failed to update salary rate:', error)
    } finally {
      setRateSaving(false)
    }
  }

  // Months in selected range
  const rangeMonths = useMemo(() => getMonthsInRange(dateRange.start, dateRange.end), [dateRange.start, dateRange.end])

  // Chart data — break expenses into Salaries vs Other Expenses (stacked), filtered to date range
  const chartData = useMemo(() => {
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const income = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const salaries = entry ? parseFloat(String(entry.salary || 0)) : 0
      const otherExpenses = entry ? parseFloat(String(entry.expense || 0)) : 0
      return { name: rangeMonths.length > 12 ? `${name} ${year}` : name, Income: income, Salaries: salaries, 'Other Expenses': otherExpenses }
    })
  }, [overviewData, rangeMonths])

  // Comparison computed values
  const compTotalIncome = comparisonData ? (comparisonData.clientPayments || 0) + (comparisonData.manualIncome || 0) : 0
  const compTotalExpenses = comparisonData ? (comparisonData.manualExpenses || 0) + (comparisonData.totalSalaries || 0) : 0
  const compNetPL = comparisonData?.netProfitLoss || 0
  const comparisonRange = useMemo(() => getComparisonRange(dateRange.start, dateRange.end), [dateRange.start, dateRange.end])

  const txCategoryKind: FinanceCategoryKind = txForm.type === 'income' ? 'income' : 'expense'
  const txCategoryOptions = categories[txCategoryKind] || []
  const txCategoryExists = !!txForm.category && txCategoryOptions.some(
    (category) => category.name.toLowerCase() === txForm.category.toLowerCase()
  )

  // Computed overview values
  const totalIncome = (overviewData?.clientPayments || 0) + (overviewData?.manualIncome || 0)
  const totalExpenses = (overviewData?.manualExpenses || 0) + (overviewData?.totalSalaries || 0)
  const netPL = overviewData?.netProfitLoss || 0
  const profitMargin = totalIncome > 0 ? (netPL / totalIncome) * 100 : 0
  const salaryToRevenue = totalIncome > 0 ? ((overviewData?.totalSalaries || 0) / totalIncome) * 100 : 0

  // Monthly cumulative P&L for area chart (filtered to date range)
  const cumulativePLData = useMemo(() => {
    let cumulative = 0
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const monthIncome = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const monthExpense = entry ? parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.salary || 0)) : 0
      cumulative += monthIncome - monthExpense
      return { name: rangeMonths.length > 12 ? `${name} ${year}` : name, cumulative, income: monthIncome, expense: monthExpense }
    })
  }, [overviewData, rangeMonths])

  // Best/worst months (filtered to date range)
  const monthlyNetArr = useMemo(() => {
    return rangeMonths.map(({ month, year, name }) => {
      const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
      const inc = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
      const exp = entry ? parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.salary || 0)) : 0
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold stripe-text-primary">Finances</h1>
          <p className="stripe-text-secondary text-sm mt-1">
            Financial overview, transactions, and payroll management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Compact balance indicators */}
          <div className="flex items-center gap-3 mr-2">
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
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setLocation(`/admin/finances/${value}`)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="salaries">Salaries</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
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
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg border-gray-200 bg-white text-xs text-gray-900"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="date"
                    value={customEnd}
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
                {comparisonLoading && <div className="animate-spin rounded-full h-3 w-3 border-b border-[var(--stripe-primary)] ml-1" />}
              </div>
            )}
          </div>

          {overviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--stripe-primary)]"></div>
            </div>
          ) : (
            <>
              {/* Hero P&L Card */}
              <div className={`stripe-card p-6 border-l-4 ${netPL >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Net Profit / Loss</p>
                    <p className={`text-3xl font-bold ${netPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(netPL)}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-500">
                        Margin: <span className={`font-semibold ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{profitMargin.toFixed(1)}%</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        Salary/Revenue: <span className="font-semibold text-blue-600">{salaryToRevenue.toFixed(1)}%</span>
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
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">Revenue</p>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
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
                    <div className="w-px h-12 bg-gray-200" />
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">Costs</p>
                      <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
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
                  { label: 'Client Revenue', value: overviewData?.clientPayments || 0, compValue: comparisonData?.clientPayments || 0, icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />, bg: 'bg-emerald-50', positive: true },
                  { label: 'Other Income', value: overviewData?.manualIncome || 0, compValue: comparisonData?.manualIncome || 0, icon: <Receipt className="h-3.5 w-3.5 text-teal-600" />, bg: 'bg-teal-50', positive: true },
                  { label: 'Salaries', value: overviewData?.totalSalaries || 0, compValue: comparisonData?.totalSalaries || 0, icon: <Users className="h-3.5 w-3.5 text-blue-600" />, bg: 'bg-blue-50', positive: false },
                  { label: 'Other Expenses', value: overviewData?.manualExpenses || 0, compValue: comparisonData?.manualExpenses || 0, icon: <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />, bg: 'bg-red-50', positive: false },
                  { label: 'Avg Monthly P&L', value: monthlyNetArr.length > 0 ? netPL / monthlyNetArr.length : 0, compValue: (() => { const compMonthly = comparisonData?.monthlyBreakdown?.filter(m => { const inc2 = parseFloat(String(m.client_payments || 0)) + parseFloat(String(m.income || 0)); const exp2 = parseFloat(String(m.expense || 0)) + parseFloat(String(m.salary || 0)); return inc2 > 0 || exp2 > 0 }) || []; return compMonthly.length > 0 ? compNetPL / compMonthly.length : 0 })(), icon: <Activity className="h-3.5 w-3.5 text-amber-600" />, bg: 'bg-amber-50', positive: true },
                ].map((kpi) => {
                  const ch = compareEnabled && comparisonData ? computeChange(kpi.value, kpi.compValue) : null
                  const isGood = ch ? (kpi.positive ? ch.delta >= 0 : ch.delta <= 0) : true
                  return (
                    <div key={kpi.label} className="stripe-stat-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-md ${kpi.bg} flex items-center justify-center`}>
                          {kpi.icon}
                        </div>
                        <span className="text-xs text-gray-500">{kpi.label}</span>
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
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Revenue vs Costs</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,.07)', fontSize: '12px' }}
                          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Bar dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="Salaries" stackId="costs" fill="#6366f1" maxBarSize={32} />
                        <Bar dataKey="Other Expenses" stackId="costs" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cumulative P&L Area Chart - 1/3 */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Cumulative P&L</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cumulativePLData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="plGradientPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="plGradientNeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v <= -1000 ? `-$${(Math.abs(v) / 1000).toFixed(0)}k` : `$${v}`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke={netPL >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={2}
                          fill={netPL >= 0 ? 'url(#plGradientPos)' : 'url(#plGradientNeg)'}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Insights Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cost Breakdown */}
                <div className="stripe-card p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
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
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Sources</h3>
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
                          <p className="text-xs text-gray-500">Best Month</p>
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
                          <p className="text-xs text-gray-500">Worst Month</p>
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
                        <p className="text-xs text-gray-500">Salary to Revenue</p>
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
                        <p className="text-xs text-gray-500">Profit Margin</p>
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
                  <h3 className="text-sm font-semibold text-gray-900">Monthly P&L Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Salaries</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Other Costs</th>
                        <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rangeMonths.map(({ month, year, name }) => {
                        const entry = overviewData?.monthlyBreakdown?.find((m) => m.month === month && m.year === year)
                        const inc = entry ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0)) : 0
                        const sal = entry ? parseFloat(String(entry.salary || 0)) : 0
                        const other = entry ? parseFloat(String(entry.expense || 0)) : 0
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
              </select>

              {/* Date range */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={txStartDate}
                  onChange={(e) => setTxStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  placeholder="Start date"
                />
                <span className="stripe-text-muted text-sm">to</span>
                <input
                  type="date"
                  value={txEndDate}
                  onChange={(e) => setTxEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  placeholder="End date"
                />
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
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
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
                            {row.description || '-'}
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
                              <span className="text-xs stripe-text-muted">Auto</span>
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
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Team Member Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(salariesData?.members || []).map((member) => {
                  const initials = member.name.split(' ').map((n) => n[0]).join('')

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
                          <p className="text-sm stripe-text-muted truncate">{member.role || 'Team Member'}</p>
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
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Paid This Year</span>
                          <span className="font-medium stripe-text-primary">
                            {formatCurrency(member.totalPaidThisYear)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openRecordSalary(member)}
                        className="w-full stripe-btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        <Wallet className="w-4 h-4" />
                        Record Payment
                      </button>
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
                          <th className="text-right px-6 py-3 text-xs font-medium stripe-text-muted uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y stripe-border">
                        {salariesData!.recentPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm stripe-text-primary whitespace-nowrap">
                              {formatDate(payment.transactionDate)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium stripe-text-primary">
                              {payment.teamMemberName}
                            </td>
                            <td className="px-6 py-4 text-sm stripe-text-secondary">
                              {payment.description || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-blue-600 text-right whitespace-nowrap">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-6 py-4 text-right">
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
                                  title="Delete salary payment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
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


        {/* ========== TAB 5: CATEGORIES ========== */}
        <TabsContent value="categories" className="space-y-6">
          <div className="stripe-card p-6">
            <h3 className="text-lg font-semibold stripe-text-primary">Category Settings</h3>
            <p className="text-sm stripe-text-muted mt-1">
              Manage separate category lists for Income and Cost transactions.
            </p>
          </div>

          {categoriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                  This is a recurring transaction
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
      {showSalaryModal && selectedMember && (
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
              {selectedMember.name} — {selectedMember.role || 'Team Member'}
            </p>

            <div className="space-y-4">
              {/* Base Salary */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Base Salary
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm stripe-text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryForm.baseSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                  />
                </div>
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

              {/* Total */}
              <div className="rounded-lg p-3 stripe-surface stripe-border" style={{ borderWidth: '1px' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold stripe-text-primary">Total Payment</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--stripe-primary)' }}>
                    {formatCurrency(salaryTotal)}
                  </span>
                </div>
                {salaryForm.extras.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-0.5" style={{ borderColor: 'var(--stripe-border)' }}>
                    <div className="flex justify-between text-xs stripe-text-muted">
                      <span>Base</span>
                      <span>{formatCurrency(parseFloat(salaryForm.baseSalary) || 0)}</span>
                    </div>
                    {salaryForm.extras.map((extra, i) => (
                      extra.label && extra.amount ? (
                        <div key={i} className="flex justify-between text-xs stripe-text-muted">
                          <span>{extra.label}</span>
                          <span>{formatCurrency(parseFloat(extra.amount) || 0)}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">Date</label>
                <input
                  type="date"
                  value={salaryForm.transactionDate}
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
                  disabled={salarySaving || salaryTotal <= 0}
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
                <h3 className="text-lg font-semibold stripe-text-primary">Edit Monthly Base</h3>
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
                  {rateSaving ? 'Saving...' : 'Save Rate'}
                </button>
              </div>

              {/* Rate History */}
              <div className="pt-3 border-t stripe-border">
                <h4 className="text-sm font-semibold stripe-text-primary mb-3">Rate History</h4>
                {rateHistoryLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
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
                {showConfigModal === 'stripe' ? 'Stripe' : 'Payoneer'} Integration
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
                : 'Enter your Payoneer API credentials to connect your account.'}
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
              ) : (
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
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                {(showConfigModal === 'stripe' ? balances?.stripe : balances?.payoneer) && (
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
                      (!payoneerForm.clientId || !payoneerForm.clientSecret || !payoneerForm.programId))
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
