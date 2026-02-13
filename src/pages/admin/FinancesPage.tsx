import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign,
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
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const EXTRA_PAYMENT_CATEGORIES = ['Subscription', 'Equipment', 'Bonus', 'Training', 'Other']

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
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
  totalExtraPayments: number
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
    extra_payment: number
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
  totalPaidThisYear: number
  lastPaymentDate: string | null
  paymentCount: number
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

export function FinancesPage() {
  const currentYear = new Date().getFullYear()

  // Overview state
  const [overviewYear, setOverviewYear] = useState(currentYear)
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

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

  // Extra Payments state
  const [extraPayments, setExtraPayments] = useState<Transaction[]>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [editingExtra, setEditingExtra] = useState<Transaction | null>(null)
  const [extraForm, setExtraForm] = useState({
    teamMemberId: '',
    amount: '',
    category: 'Other',
    description: '',
    transactionDate: toInputDate(),
  })
  const [extraSaving, setExtraSaving] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState('overview')

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

  // Load balances on mount
  useEffect(() => {
    loadBalances()
  }, [])

  // Load overview data
  useEffect(() => {
    loadOverview()
  }, [overviewYear])

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

  // Load extra payments data
  useEffect(() => {
    if (activeTab === 'extra') {
      loadExtraPayments()
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
        startDate: `${overviewYear}-01-01`,
        endDate: `${overviewYear}-12-31`,
      })
      setOverviewData(data)
    } catch (error) {
      console.error('Failed to load finances overview:', error)
    } finally {
      setOverviewLoading(false)
    }
  }

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

  const loadExtraPayments = async () => {
    try {
      setExtraLoading(true)
      const data = await api.getFinancialTransactions({ type: 'extra_payment' })
      setExtraPayments(data)
    } catch (error) {
      console.error('Failed to load extra payments:', error)
    } finally {
      setExtraLoading(false)
    }
  }

  // Merge transactions and client payments for table
  const getMergedRows = (): MergedRow[] => {
    const rows: MergedRow[] = []

    // Add manual transactions (filter out salary and extra_payment types for this tab)
    for (const tx of transactions) {
      if (tx.type === 'salary' || tx.type === 'extra_payment') continue
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

  // Extra payment CRUD
  const openAddExtra = () => {
    setEditingExtra(null)
    setExtraForm({
      teamMemberId: '',
      amount: '',
      category: 'Other',
      description: '',
      transactionDate: toInputDate(),
    })
    setShowExtraModal(true)
  }

  const openEditExtra = (tx: Transaction) => {
    setEditingExtra(tx)
    setExtraForm({
      teamMemberId: tx.teamMemberId ? String(tx.teamMemberId) : '',
      amount: String(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount),
      category: tx.category || 'Other',
      description: tx.description || '',
      transactionDate: toInputDate(tx.transactionDate),
    })
    setShowExtraModal(true)
  }

  const handleSaveExtra = async () => {
    if (!extraForm.amount || parseFloat(extraForm.amount) <= 0) return
    try {
      setExtraSaving(true)
      const payload = {
        type: 'extra_payment',
        amount: parseFloat(extraForm.amount),
        transactionDate: extraForm.transactionDate,
        category: extraForm.category || undefined,
        description: extraForm.description || undefined,
        teamMemberId: extraForm.teamMemberId ? parseInt(extraForm.teamMemberId) : undefined,
      }
      if (editingExtra) {
        await api.updateFinancialTransaction(editingExtra.id, payload)
      } else {
        await api.createFinancialTransaction(payload)
      }
      setShowExtraModal(false)
      setEditingExtra(null)
      await loadExtraPayments()
      loadOverview()
    } catch (error) {
      console.error('Failed to save extra payment:', error)
    } finally {
      setExtraSaving(false)
    }
  }

  const handleDeleteExtra = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) return
    try {
      await api.deleteFinancialTransaction(id)
      await loadExtraPayments()
      loadOverview()
    } catch (error) {
      console.error('Failed to delete extra payment:', error)
    }
  }

  // Chart data — break expenses into Salaries vs Other Expenses (stacked)
  const chartData = overviewData?.monthlyBreakdown
    ? MONTHS.map((name, idx) => {
        const entry = overviewData.monthlyBreakdown.find((m) => m.month === idx + 1)
        const income = entry
          ? parseFloat(String(entry.client_payments || 0)) + parseFloat(String(entry.income || 0))
          : 0
        const salaries = entry
          ? parseFloat(String(entry.salary || 0))
          : 0
        const otherExpenses = entry
          ? parseFloat(String(entry.expense || 0)) + parseFloat(String(entry.extra_payment || 0))
          : 0
        return { name, Income: income, Salaries: salaries, 'Other Expenses': otherExpenses }
      })
    : MONTHS.map((name) => ({ name, Income: 0, Salaries: 0, 'Other Expenses': 0 }))

  // Year options
  const yearOptions = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y)
  }

  // Team members from salaries data for extra payments dropdown
  const teamMembersForExtra = salariesData?.members || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">Finances</h1>
            <p className="stripe-text-secondary text-lg">
              Track income, expenses, salaries, and extra payments
            </p>
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stripe Balance */}
        <div className="stripe-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-600" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium stripe-text-secondary">Stripe</p>
                <p className="text-xs stripe-text-muted">Account Balance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {balances?.stripe ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not connected
                </span>
              )}
              <button
                onClick={() => openConfigModal('stripe')}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors stripe-text-muted hover:stripe-text-primary"
                title="Configure Stripe"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            {balancesLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            ) : balances?.stripe ? (
              <>
                <span className="text-2xl font-bold stripe-text-primary">
                  {formatCurrency(balances.stripe.available)}
                </span>
                <span className="text-sm stripe-text-muted">{balances.stripe.currency}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold stripe-text-primary">--</span>
                <span className="text-sm stripe-text-muted">USD</span>
              </>
            )}
          </div>
          {balances?.stripe ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-xs stripe-text-muted">
                Pending: {formatCurrency(balances.stripe.pending)}
              </p>
              {balances.fetchedAt && (
                <p className="text-xs stripe-text-muted">
                  Updated {formatDate(balances.fetchedAt)}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => openConfigModal('stripe')}
              className="text-xs mt-2 font-medium transition-colors"
              style={{ color: 'var(--stripe-primary)' }}
            >
              Connect Stripe account
            </button>
          )}
        </div>

        {/* Payoneer Balance */}
        <div className="stripe-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium stripe-text-secondary">Payoneer</p>
                <p className="text-xs stripe-text-muted">Account Balance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {balances?.payoneer ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not connected
                </span>
              )}
              <button
                onClick={() => openConfigModal('payoneer')}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors stripe-text-muted hover:stripe-text-primary"
                title="Configure Payoneer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            {balancesLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
            ) : balances?.payoneer ? (
              <>
                <span className="text-2xl font-bold stripe-text-primary">
                  {formatCurrency(balances.payoneer.available)}
                </span>
                <span className="text-sm stripe-text-muted">{balances.payoneer.currency}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold stripe-text-primary">--</span>
                <span className="text-sm stripe-text-muted">USD</span>
              </>
            )}
          </div>
          {balances?.payoneer ? (
            balances.fetchedAt && (
              <p className="text-xs stripe-text-muted mt-2">
                Updated {formatDate(balances.fetchedAt)}
              </p>
            )
          ) : (
            <button
              onClick={() => openConfigModal('payoneer')}
              className="text-xs mt-2 font-medium transition-colors"
              style={{ color: 'var(--stripe-primary)' }}
            >
              Connect Payoneer account
            </button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="salaries">Salaries</TabsTrigger>
          <TabsTrigger value="extra">Extra Payments</TabsTrigger>
        </TabsList>

        {/* ========== TAB 1: OVERVIEW ========== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Year Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium stripe-text-secondary">Year:</label>
            <select
              value={overviewYear}
              onChange={(e) => setOverviewYear(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {overviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Income */}
                <div className="stripe-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium stripe-text-secondary">Total Income</span>
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      (overviewData?.clientPayments || 0) + (overviewData?.manualIncome || 0)
                    )}
                  </p>
                  <p className="text-xs stripe-text-muted mt-1">
                    Client payments + manual income
                  </p>
                </div>

                {/* Total Expenses */}
                <div className="stripe-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium stripe-text-secondary">Total Expenses</span>
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(
                      (overviewData?.manualExpenses || 0) +
                      (overviewData?.totalSalaries || 0) +
                      (overviewData?.totalExtraPayments || 0)
                    )}
                  </p>
                  <p className="text-xs stripe-text-muted mt-1">
                    Salaries + extras + other expenses
                  </p>
                </div>

                {/* Total Salaries */}
                <div className="stripe-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium stripe-text-secondary">Total Salaries</span>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(overviewData?.totalSalaries || 0)}
                  </p>
                  <p className="text-xs stripe-text-muted mt-1">Salary payments this year</p>
                </div>

                {/* Net P&L */}
                <div className="stripe-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium stripe-text-secondary">Net P&L</span>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        (overviewData?.netProfitLoss || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {(overviewData?.netProfitLoss || 0) >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      (overviewData?.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(overviewData?.netProfitLoss || 0)}
                  </p>
                  <p className="text-xs stripe-text-muted mt-1">Income minus all costs</p>
                </div>
              </div>

              {/* Monthly Bar Chart */}
              <div className="stripe-card p-6">
                <h3 className="text-lg font-semibold stripe-text-primary mb-4">
                  Monthly Income vs Expenses
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Salaries" stackId="expenses" fill="#3b82f6" />
                      <Bar dataKey="Other Expenses" stackId="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
                  const currentMonth = new Date().getMonth() + 1
                  const expectedPaid = member.monthlyRate * currentMonth
                  const paidPercent =
                    expectedPaid > 0
                      ? Math.min(100, Math.round((member.totalPaidThisYear / expectedPaid) * 100))
                      : 0

                  return (
                    <div key={member.id} className="stripe-card p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold stripe-text-primary text-base">
                            {member.name}
                          </h4>
                          <p className="text-sm stripe-text-muted">{member.role || 'Team Member'}</p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Monthly Rate</span>
                          <span className="font-medium stripe-text-primary">
                            {formatCurrency(member.monthlyRate)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Paid This Year</span>
                          <span className="font-medium stripe-text-primary">
                            {formatCurrency(member.totalPaidThisYear)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="stripe-text-secondary">Expected</span>
                          <span className="font-medium stripe-text-muted">
                            {formatCurrency(expectedPaid)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              paidPercent >= 100
                                ? 'bg-green-500'
                                : paidPercent >= 75
                                  ? 'bg-blue-500'
                                  : paidPercent >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                            }`}
                            style={{ width: `${paidPercent}%` }}
                          ></div>
                        </div>
                        <p className="text-xs stripe-text-muted mt-1 text-right">{paidPercent}%</p>
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

        {/* ========== TAB 4: EXTRA PAYMENTS ========== */}
        <TabsContent value="extra" className="space-y-6">
          {/* Add Button */}
          <div className="flex justify-end">
            <button
              onClick={openAddExtra}
              className="stripe-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Payment
            </button>
          </div>

          {/* Extra Payments Table */}
          <div className="stripe-card overflow-hidden">
            {extraLoading ? (
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
                        Team Member
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
                    {extraPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <CreditCard className="w-12 h-12 mx-auto stripe-text-muted opacity-50 mb-3" />
                          <p className="stripe-text-muted">No extra payments found</p>
                        </td>
                      </tr>
                    ) : (
                      extraPayments.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm stripe-text-primary whitespace-nowrap">
                            {formatDate(tx.transactionDate)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium stripe-text-primary">
                            {tx.teamMemberName || '-'}
                          </td>
                          <td className="px-6 py-4">
                            {tx.category ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {tx.category}
                              </span>
                            ) : (
                              <span className="text-sm stripe-text-muted">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm stripe-text-secondary max-w-[300px] truncate">
                            {tx.description || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap stripe-text-primary">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditExtra(tx)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors stripe-text-muted hover:stripe-text-primary"
                                title="Edit payment"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExtra(tx.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400 hover:text-red-600"
                                title="Delete payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
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
                <input
                  type="text"
                  value={txForm.category}
                  onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                  placeholder="e.g. Office Supplies, Software, etc."
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
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

      {/* ========== EXTRA PAYMENT ADD/EDIT MODAL ========== */}
      {showExtraModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExtraModal(false)}
        >
          <div
            className="stripe-card p-6 w-full max-w-md rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold stripe-text-primary mb-1">
              {editingExtra ? 'Edit Extra Payment' : 'Add Extra Payment'}
            </h3>
            <p className="text-sm stripe-text-muted mb-5">
              {editingExtra ? 'Update extra payment details' : 'Create a new extra payment'}
            </p>

            <div className="space-y-4">
              {/* Team Member */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Team Member
                </label>
                <select
                  value={extraForm.teamMemberId}
                  onChange={(e) => setExtraForm({ ...extraForm, teamMemberId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                >
                  <option value="">Select team member (optional)</option>
                  {teamMembersForExtra.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
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
                    value={extraForm.amount}
                    onChange={(e) => setExtraForm({ ...extraForm, amount: e.target.value })}
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
                  value={extraForm.category}
                  onChange={(e) => setExtraForm({ ...extraForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                >
                  {EXTRA_PAYMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium stripe-text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  value={extraForm.description}
                  onChange={(e) => setExtraForm({ ...extraForm, description: e.target.value })}
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
                  value={extraForm.transactionDate}
                  onChange={(e) =>
                    setExtraForm({ ...extraForm, transactionDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg stripe-border bg-white stripe-text-primary text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExtraModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg stripe-border stripe-text-primary text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExtra}
                  disabled={extraSaving || !extraForm.amount}
                  className="flex-1 stripe-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {extraSaving ? 'Saving...' : editingExtra ? 'Update' : 'Save'}
                </button>
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
