import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Building,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  Eye,
  Trash2,
  Calendar,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Phone,
  ExternalLink,
  Briefcase,
  Clock,
  Receipt,
  AlertCircle,
  Camera,
} from 'lucide-react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { parseLocalDate } from '@/lib/utils'

interface Client {
  id: number
  name: string
  industry?: string
  contactEmail?: string
  contactPhone?: string
  status: 'active' | 'inactive' | 'prospect'
  contractType?: 'outstaffing' | 'outsourcing' | 'hybrid'
  teamSize?: number
  budget?: number
  logoUrl?: string
  createdAt: string
  services: Array<{
    id: number
    serviceTypeName: string
    serviceCategory: string
    billingModel: string
    rate?: number
    serviceLevelPrice?: number
    startDate: string
    endDate?: string
    isActive: boolean
    totalAmount?: number
  }>
  activeServicesCount: number
  totalMonthlyRevenue: number
  invoiceTotals?: {
    totalInvoiced: number
    totalPaid: number
  }
}

interface ClientAnalytics {
  totalClients: number
  activeClients: number
  totalRevenue: number
  topClients: Array<{
    clientId: number
    clientName: string
    activeServices: number
    totalRevenue: number
  }>
}

interface ServiceType {
  id: number
  name: string
  category: string
  billingModel: string
  baseRate?: number
}

type SortField = 'name' | 'status' | 'revenue' | 'services' | 'invoiced' | 'outstanding'
type SortDirection = 'asc' | 'desc'

export function ClientsPage() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [location, setLocation] = useLocation()
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'prospect'>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [analytics, setAnalytics] = useState<ClientAnalytics | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [serviceDevelopers, setServiceDevelopers] = useState<{ [serviceId: number]: any[] }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Dialog states
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false)
  const [isEditServiceDialogOpen, setIsEditServiceDialogOpen] = useState(false)
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [editingServiceData, setEditingServiceData] = useState<{
    serviceId: number
    clientId: number
    serviceTypeName: string
    rate?: number
    serviceLevelPrice?: number
    startDate: string
    endDate?: string
    isActive: boolean
  } | null>(null)
  const [newServiceData, setNewServiceData] = useState({
    serviceTypeId: '',
    rate: '',
    startDate: new Date().toISOString().split('T')[0],
  })
  const [newClientData, setNewClientData] = useState({
    name: '',
    industry: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    contractType: '',
    contractStart: '',
    contractEnd: '',
    billingCycle: 'monthly' as 'monthly' | 'weekly' | 'hourly',
    teamSize: '',
  })

  useEffect(() => {
    loadClients()
    loadAnalytics()
    loadServiceTypes()
  }, [])

  useEffect(() => {
    const nextQuery = new URLSearchParams(window.location.search).get('q') ?? ''
    setSearchTerm(nextQuery)
  }, [location])

  const loadClients = async () => {
    try {
      const response = await api.request('/services/clients', {
        method: 'GET',
      })

      const clientsWithInvoiceData = await Promise.all(
        response.map(async (client: Client) => {
          try {
            const invoiceTotals = await api.getClientInvoiceTotals(client.id)
            return { ...client, invoiceTotals }
          } catch (error) {
            console.error(`Failed to load invoice data for client ${client.id}:`, error)
            return client
          }
        })
      )

      setClients(clientsWithInvoiceData)
      await loadServiceDevelopers(clientsWithInvoiceData)
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadServiceDevelopers = async (clientsData: Client[]) => {
    try {
      const developersData: { [serviceId: number]: any[] } = {}
      const allServices = clientsData.flatMap(client =>
        client.services.map(service => ({ ...service, clientId: client.id }))
      )

      for (const service of allServices) {
        try {
          const developers = await api.getServiceDevelopers(service.clientId, service.id)
          developersData[service.id] = developers
        } catch (error) {
          console.error(`Failed to load developers for service ${service.id}:`, error)
          developersData[service.id] = []
        }
      }

      setServiceDevelopers(developersData)
    } catch (error) {
      console.error('Failed to load service developers:', error)
    }
  }

  const loadAnalytics = async () => {
    try {
      const response = await api.request('/services/clients/analytics', {
        method: 'GET',
      })
      setAnalytics(response)
    } catch (error) {
      console.error('Failed to load client analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadServiceTypes = async () => {
    try {
      const response = await api.request('/services/service-types', {
        method: 'GET',
      })
      setServiceTypes(response)
    } catch (error) {
      console.error('Failed to load service types:', error)
    }
  }

  const handleRemoveService = async (clientId: number, serviceId: number, permanent: boolean = false) => {
    const message = permanent
      ? 'Are you sure you want to permanently delete this service assignment? This cannot be undone.'
      : 'Are you sure you want to remove this service assignment?'

    const confirmed = await showConfirm({
      title: permanent ? 'Delete Service' : 'Remove Service',
      message,
      type: permanent ? 'error' : 'warning',
      confirmText: permanent ? 'Delete' : 'Remove',
      cancelText: 'Cancel',
      destructive: permanent,
    })

    if (!confirmed) return

    try {
      const url = permanent
        ? `/services/clients/${clientId}/services/${serviceId}?permanent=true`
        : `/services/clients/${clientId}/services/${serviceId}`

      await api.request(url, { method: 'DELETE' })
      loadClients()
      loadAnalytics()

      const successMessage = permanent
        ? 'Service assignment permanently deleted'
        : 'Service assignment deactivated successfully'
      await showAlert({ message: successMessage, type: 'success' })
    } catch (error: any) {
      console.error('Failed to remove service:', error)
      await showAlert({ message: error.message || 'Failed to remove service assignment', type: 'error' })
    }
  }

  const handleAddService = async () => {
    if (!selectedClient || !newServiceData.serviceTypeId || !newServiceData.startDate) {
      await showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      await api.request(`/services/clients/${selectedClient.id}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceTypeId: parseInt(newServiceData.serviceTypeId),
          rate: newServiceData.rate ? parseFloat(newServiceData.rate) : null,
          startDate: newServiceData.startDate,
        }),
      })
      loadClients()
      loadAnalytics()
      setIsServiceDialogOpen(false)
      setSelectedClient(null)
      resetServiceForm()
    } catch (error: any) {
      console.error('Failed to add service:', error)
      await showAlert({ message: error.message || 'Failed to add service to client', type: 'error' })
    }
  }

  const handleCreateClient = async () => {
    if (!newClientData.name) {
      await showAlert({ message: 'Please fill in the required field: Client Name', type: 'warning' })
      return
    }

    try {
      const createData: any = {
        ...newClientData,
        teamSize: newClientData.teamSize ? parseInt(newClientData.teamSize) : 0,
      }
      await api.createClient(createData)
      loadClients()
      loadAnalytics()
      setIsClientDialogOpen(false)
      resetClientForm()
      await showAlert({ message: 'Client created successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to create client:', error)
      await showAlert({ message: error.message || 'Failed to create client', type: 'error' })
    }
  }

  const resetServiceForm = () => {
    setNewServiceData({
      serviceTypeId: '',
      rate: '',
      startDate: new Date().toISOString().split('T')[0],
    })
  }

  const resetClientForm = () => {
    setNewClientData({
      name: '',
      industry: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      contractType: '',
      contractStart: '',
      contractEnd: '',
      billingCycle: 'monthly',
      teamSize: '',
    })
  }

  const handleEditService = (clientId: number, service: any) => {
    setEditingServiceData({
      serviceId: service.id,
      clientId: clientId,
      serviceTypeName: service.serviceTypeName,
      rate: service.rate || undefined,
      serviceLevelPrice: service.serviceLevelPrice || undefined,
      startDate: service.startDate,
      endDate: service.endDate || undefined,
      isActive: service.isActive,
    })
    setIsEditServiceDialogOpen(true)
  }

  const handleUpdateService = async () => {
    if (!editingServiceData) return

    try {
      await api.updateClientService(editingServiceData.clientId, editingServiceData.serviceId, {
        rate: editingServiceData.rate,
        serviceLevelPrice: editingServiceData.serviceLevelPrice,
        startDate: editingServiceData.startDate,
        endDate: editingServiceData.endDate,
        isActive: editingServiceData.isActive,
      })

      loadClients()
      setIsEditServiceDialogOpen(false)
      setEditingServiceData(null)

      await showAlert({ message: 'Service updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update service:', error)
      await showAlert({ message: error.message || 'Failed to update service', type: 'error' })
    }
  }

  const resetEditServiceForm = () => {
    setEditingServiceData(null)
  }

  const handleLogoUpload = async (clientId: number, file: File) => {
    try {
      await api.uploadClientLogo(clientId, file)
      loadClients()
    } catch (error: any) {
      console.error('Failed to upload logo:', error)
      await showAlert({ message: error.message || 'Failed to upload logo', type: 'error' })
    }
  }

  const handleDeleteClient = async (client: Client) => {
    const confirmed = await showConfirm({
      title: 'Delete Client',
      message: `Are you sure you want to delete "${client.name}"?\n\nThis action cannot be undone and will also delete:\n• All service assignments\n• All invoices\n• All documents\n• All related data`,
      type: 'error',
      confirmText: 'Delete Client',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.request(`/admin/clients/${client.id}`, { method: 'DELETE' })
      loadClients()
      await showAlert({ message: 'Client deleted successfully!', type: 'success' })
    } catch (error: any) {
      await showAlert({ message: error.message || 'Failed to delete client', type: 'error' })
    }
  }

  const getClientDevCount = (client: Client): number => {
    return client.services
      .filter(s => s.isActive)
      .reduce((sum, service) => {
        const devs = serviceDevelopers[service.id] || []
        return sum + devs.reduce((devSum: number, dev: any) => {
          const workload = dev.workloadPercentage ? parseFloat(dev.workloadPercentage) / 100 : 1.0
          return devSum + workload
        }, 0)
      }, 0)
  }

  const getOutstanding = (client: Client): number => {
    return (client.invoiceTotals?.totalInvoiced || 0) - (client.invoiceTotals?.totalPaid || 0)
  }

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'name' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-[var(--stripe-primary)]" />
      : <ArrowDown className="h-3.5 w-3.5 text-[var(--stripe-primary)]" />
  }

  const filteredAndSortedClients = useMemo(() => {
    let result = clients.filter(client => {
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter
      const matchesSearch = !searchTerm ||
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })

    result.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'status':
          return dir * a.status.localeCompare(b.status)
        case 'revenue':
          return dir * (a.totalMonthlyRevenue - b.totalMonthlyRevenue)
        case 'services':
          return dir * (a.activeServicesCount - b.activeServicesCount)
        case 'invoiced':
          return dir * ((a.invoiceTotals?.totalInvoiced || 0) - (b.invoiceTotals?.totalInvoiced || 0))
        case 'outstanding':
          return dir * (getOutstanding(a) - getOutstanding(b))
        default:
          return 0
      }
    })

    return result
  }, [clients, statusFilter, searchTerm, sortField, sortDirection])

  // KPI computed values
  const totalOutstanding = useMemo(() =>
    clients.reduce((sum, c) => sum + getOutstanding(c), 0), [clients])

  const totalInvoiced = useMemo(() =>
    clients.reduce((sum, c) => sum + (c.invoiceTotals?.totalInvoiced || 0), 0), [clients])

  const totalPaid = useMemo(() =>
    clients.reduce((sum, c) => sum + (c.invoiceTotals?.totalPaid || 0), 0), [clients])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
      case 'inactive':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive</span>
      case 'prospect':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Prospect</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">{status}</span>
    }
  }

  const getCategoryBadge = (category: string) => {
    return category === 'outstaffing'
      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">Outstaffing</span>
      : <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700">Outsourcing</span>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold stripe-text-primary">Clients</h1>
          <p className="stripe-text-secondary text-sm mt-1">
            Manage client relationships, services, and financials
          </p>
        </div>
        <button
          onClick={() => setIsClientDialogOpen(true)}
          className="stripe-btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <span className="text-sm stripe-text-secondary">Total</span>
          </div>
          <div className="text-2xl font-bold stripe-text-primary">{analytics?.totalClients || 0}</div>
          <div className="text-xs stripe-text-muted mt-1">
            {analytics?.activeClients || 0} active
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <span className="text-sm stripe-text-secondary">MRR</span>
          </div>
          <div className="text-2xl font-bold stripe-text-primary">
            ${(analytics?.totalRevenue || 0).toLocaleString()}
          </div>
          <div className="text-xs stripe-text-muted mt-1">
            ${analytics?.activeClients ? Math.round((analytics.totalRevenue || 0) / analytics.activeClients).toLocaleString() : 0}/client avg
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Receipt className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <span className="text-sm stripe-text-secondary">Invoiced</span>
          </div>
          <div className="text-2xl font-bold stripe-text-primary">
            ${totalInvoiced.toLocaleString()}
          </div>
          <div className="text-xs stripe-text-muted mt-1">
            All time total
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="h-4.5 w-4.5 text-green-600" />
            </div>
            <span className="text-sm stripe-text-secondary">Collected</span>
          </div>
          <div className="text-2xl font-bold stripe-text-primary">
            ${totalPaid.toLocaleString()}
          </div>
          <div className="text-xs stripe-text-muted mt-1">
            {totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0}% collection rate
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertCircle className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <span className="text-sm stripe-text-secondary">Outstanding</span>
          </div>
          <div className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'stripe-text-primary'}`}>
            ${totalOutstanding.toLocaleString()}
          </div>
          <div className="text-xs stripe-text-muted mt-1">
            Unpaid balance
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="stripe-card">
        <div className="p-4 flex items-center gap-3 border-b border-[var(--stripe-border)]">
          <div className="flex items-center gap-2 stripe-input flex-1 max-w-sm">
            <Search className="h-4 w-4 stripe-text-muted flex-shrink-0" />
            <input
              placeholder="Search by name, industry, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none border-none text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
            {(['all', 'active', 'inactive', 'prospect'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className="ml-1.5 text-gray-400">
                    {clients.filter(c => c.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="text-xs stripe-text-muted ml-auto">
            {filteredAndSortedClients.length} of {clients.length} clients
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--stripe-border)]">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700">
                    Client <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('status')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-center px-4 py-3">
                  <button onClick={() => handleSort('services')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 mx-auto">
                    Services <SortIcon field="services" />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <button onClick={() => handleSort('revenue')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto">
                    MRR <SortIcon field="revenue" />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <button onClick={() => handleSort('invoiced')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto">
                    Invoiced <SortIcon field="invoiced" />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <button onClick={() => handleSort('outstanding')} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto">
                    Outstanding <SortIcon field="outstanding" />
                  </button>
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stripe-border)]">
              {filteredAndSortedClients.map((client) => {
                const isExpanded = expandedClientId === client.id
                const devCount = getClientDevCount(client)
                const outstanding = getOutstanding(client)

                return (
                  <ClientRow
                    key={client.id}
                    client={client}
                    isExpanded={isExpanded}
                    devCount={devCount}
                    outstanding={outstanding}
                    serviceDevelopers={serviceDevelopers}
                    onToggleExpand={() => setExpandedClientId(isExpanded ? null : client.id)}
                    onNavigate={() => setLocation(`/admin/clients/${client.id}`)}
                    onAddService={() => {
                      setSelectedClient(client)
                      setIsServiceDialogOpen(true)
                    }}
                    onEditService={(service) => handleEditService(client.id, service)}
                    onRemoveService={(serviceId, permanent) => handleRemoveService(client.id, serviceId, permanent)}
                    onDeleteClient={() => handleDeleteClient(client)}
                    onLogoUpload={(file) => handleLogoUpload(client.id, file)}
                    getStatusBadge={getStatusBadge}
                    getCategoryBadge={getCategoryBadge}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedClients.length === 0 && (
          <div className="text-center py-16">
            <Building className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No clients found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search or filters.' : 'Get started by adding your first client.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsClientDialogOpen(true)}
                className="stripe-btn-primary text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Client
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service to {selectedClient?.name}</DialogTitle>
            <DialogDescription>
              Assign a new service to this client with custom rates and start date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceType">Service Type</Label>
              <Select
                value={newServiceData.serviceTypeId}
                onValueChange={(value) => setNewServiceData({ ...newServiceData, serviceTypeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service type" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()} label={service.name}>
                      {service.name} ({service.category}) - {service.billingModel}
                      {service.baseRate && ` - $${service.baseRate}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rate">Custom Rate (Optional)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={newServiceData.rate}
                onChange={(e) => setNewServiceData({ ...newServiceData, rate: e.target.value })}
                placeholder="Leave empty to use base rate"
              />
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={newServiceData.startDate}
                onChange={(e) => setNewServiceData({ ...newServiceData, startDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <button
              className="stripe-btn-secondary"
              onClick={() => {
                setIsServiceDialogOpen(false)
                setSelectedClient(null)
                resetServiceForm()
              }}
            >
              Cancel
            </button>
            <button className="stripe-btn-primary" onClick={handleAddService}>
              Add Service
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client profile with contract details and contact information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 space-y-4">
            <div className="col-span-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={newClientData.name}
                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                placeholder="e.g., Tech Innovations LLC"
              />
            </div>

            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={newClientData.industry}
                onChange={(e) => setNewClientData({ ...newClientData, industry: e.target.value })}
                placeholder="e.g., Technology, Healthcare"
              />
            </div>

            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={newClientData.contactPerson}
                onChange={(e) => setNewClientData({ ...newClientData, contactPerson: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>

            <div>
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>

            <div>
              <Label htmlFor="clientPhone">Phone</Label>
              <Input
                id="clientPhone"
                value={newClientData.phone}
                onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newClientData.address}
                onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                placeholder="123 Business St, City, State 12345"
              />
            </div>

            <div>
              <Label htmlFor="contractType">Primary Contract Type (Optional)</Label>
              <Select
                value={newClientData.contractType}
                onValueChange={(value: string) =>
                  setNewClientData({ ...newClientData, contractType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None specified</SelectItem>
                  <SelectItem value="outstaffing">Outstaffing</SelectItem>
                  <SelectItem value="outsourcing">Outsourcing</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="billingCycle">Billing Cycle</Label>
              <Select
                value={newClientData.billingCycle}
                onValueChange={(value: 'monthly' | 'weekly' | 'hourly') =>
                  setNewClientData({ ...newClientData, billingCycle: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contractStart">Contract Start Date</Label>
              <Input
                id="contractStart"
                type="date"
                value={newClientData.contractStart}
                onChange={(e) => setNewClientData({ ...newClientData, contractStart: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="contractEnd">Contract End Date</Label>
              <Input
                id="contractEnd"
                type="date"
                value={newClientData.contractEnd}
                onChange={(e) => setNewClientData({ ...newClientData, contractEnd: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="teamSize">Expected Team Size</Label>
              <Input
                id="teamSize"
                type="number"
                value={newClientData.teamSize}
                onChange={(e) => setNewClientData({ ...newClientData, teamSize: e.target.value })}
                placeholder="5"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              className="stripe-btn-secondary"
              onClick={() => {
                setIsClientDialogOpen(false)
                resetClientForm()
              }}
            >
              Cancel
            </button>
            <button className="stripe-btn-primary" onClick={handleCreateClient}>
              Create Client
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceDialogOpen} onOpenChange={setIsEditServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service: {editingServiceData?.serviceTypeName}</DialogTitle>
            <DialogDescription>
              Update service pricing, dates, and status for this client assignment.
            </DialogDescription>
          </DialogHeader>

          {editingServiceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editRate">Legacy Rate (Optional)</Label>
                  <Input
                    id="editRate"
                    type="number"
                    step="0.01"
                    value={editingServiceData.rate || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      rate: e.target.value ? parseFloat(e.target.value) : undefined,
                    })}
                    placeholder="Legacy rate field"
                  />
                </div>

                <div>
                  <Label htmlFor="editServicePrice">Service-Level Price (Optional)</Label>
                  <Input
                    id="editServicePrice"
                    type="number"
                    step="0.01"
                    value={editingServiceData.serviceLevelPrice || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      serviceLevelPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    })}
                    placeholder="Service-level pricing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editStartDate">Start Date</Label>
                  <Input
                    id="editStartDate"
                    type="date"
                    value={editingServiceData.startDate}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      startDate: e.target.value,
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="editEndDate">End Date (Optional)</Label>
                  <Input
                    id="editEndDate"
                    type="date"
                    value={editingServiceData.endDate || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      endDate: e.target.value || undefined,
                    })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editingServiceData.isActive}
                  onChange={(e) => setEditingServiceData({
                    ...editingServiceData,
                    isActive: e.target.checked,
                  })}
                  className="rounded"
                />
                <Label htmlFor="editIsActive">Service is active</Label>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                <p><strong>Note:</strong> Set service-level price for fixed pricing, or leave empty if pricing comes from individual developers.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              className="stripe-btn-secondary"
              onClick={() => {
                setIsEditServiceDialogOpen(false)
                resetEditServiceForm()
              }}
            >
              Cancel
            </button>
            <button className="stripe-btn-primary" onClick={handleUpdateService}>
              Update Service
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Extracted row component for cleaner code
function ClientRow({
  client,
  isExpanded,
  devCount,
  outstanding,
  serviceDevelopers,
  onToggleExpand,
  onNavigate,
  onAddService,
  onEditService,
  onRemoveService,
  onDeleteClient,
  onLogoUpload,
  getStatusBadge,
  getCategoryBadge,
}: {
  client: Client
  isExpanded: boolean
  devCount: number
  outstanding: number
  serviceDevelopers: { [serviceId: number]: any[] }
  onToggleExpand: () => void
  onNavigate: () => void
  onAddService: () => void
  onEditService: (service: any) => void
  onRemoveService: (serviceId: number, permanent: boolean) => void
  onDeleteClient: () => void
  onLogoUpload: (file: File) => void
  getStatusBadge: (status: string) => JSX.Element
  getCategoryBadge: (category: string) => JSX.Element
}) {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const handleLogoClick = () => {
    logoInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setLogoError(false)
    try {
      await onLogoUpload(file)
    } finally {
      setIsUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const hasValidLogo = client.logoUrl && !logoError
  return (
    <>
      {/* Main Row */}
      <tr className="group hover:bg-gray-50/50 transition-colors">
        {/* Expand Toggle */}
        <td className="px-6 py-4">
          {client.services.length > 0 ? (
            <button
              onClick={onToggleExpand}
              className="p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="h-4 w-4 text-gray-500" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />
              }
            </button>
          ) : (
            <span className="w-5 h-5 block" />
          )}
        </td>

        {/* Client Info */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleLogoClick}
              className="relative w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 group/logo cursor-pointer hover:border-[var(--stripe-primary)] transition-colors"
              title={client.logoUrl ? 'Change logo' : 'Upload logo'}
            >
              {isUploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[var(--stripe-primary)]" />
              ) : hasValidLogo ? (
                <>
                  <img
                    src={client.logoUrl}
                    alt={client.name}
                    className="h-full w-full object-contain p-0.5"
                    onError={() => setLogoError(true)}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <Camera className="h-3.5 w-3.5 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <Building className="h-4 w-4 text-gray-400 group-hover/logo:hidden" />
                  <Camera className="h-4 w-4 text-[var(--stripe-primary)] hidden group-hover/logo:block" />
                </>
              )}
            </button>
            <div className="min-w-0">
              <button
                onClick={onNavigate}
                className="text-sm font-semibold text-gray-900 hover:text-[var(--stripe-primary)] transition-colors truncate block max-w-[200px]"
              >
                {client.name}
              </button>
              <div className="flex items-center gap-2 mt-0.5">
                {client.industry && (
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">{client.industry}</span>
                )}
                {client.contractType && (
                  <span className="text-xs text-gray-400 capitalize">{client.contractType}</span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-4">
          {getStatusBadge(client.status)}
        </td>

        {/* Services Count */}
        <td className="px-4 py-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-900">{client.activeServicesCount}</span>
            {devCount > 0 && (
              <span className="text-xs text-gray-500">{devCount % 1 === 0 ? devCount : devCount.toFixed(1)} devs</span>
            )}
          </div>
        </td>

        {/* MRR */}
        <td className="px-4 py-4 text-right">
          <span className={`text-sm font-semibold ${client.totalMonthlyRevenue > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            ${client.totalMonthlyRevenue.toLocaleString()}
          </span>
        </td>

        {/* Invoiced */}
        <td className="px-4 py-4 text-right">
          <span className="text-sm text-gray-700">
            ${(client.invoiceTotals?.totalInvoiced || 0).toLocaleString()}
          </span>
        </td>

        {/* Outstanding */}
        <td className="px-4 py-4 text-right">
          <span className={`text-sm font-medium ${outstanding > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {outstanding > 0 ? `$${outstanding.toLocaleString()}` : '-'}
          </span>
        </td>

        {/* Actions */}
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onAddService}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Add service"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={onNavigate}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-[var(--stripe-primary)] transition-colors"
              title="View details"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              onClick={onDeleteClient}
              className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete client"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Services Panel */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <div className="bg-gray-50/80 border-t border-b border-gray-100">
              <div className="px-16 py-4">
                {/* Client Quick Info Bar */}
                <div className="flex items-center gap-6 mb-4 text-xs text-gray-500">
                  {client.contactEmail && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{client.contactEmail}</span>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{client.contactPhone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Client since {new Date(client.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Paid: ${(client.invoiceTotals?.totalPaid || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Services Table */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Service Assignments ({client.activeServicesCount} active)
                  </h4>
                  <button
                    onClick={onAddService}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--stripe-primary)] hover:text-[#5449d1] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Service
                  </button>
                </div>

                {client.services.length > 0 ? (
                  <div className="space-y-2">
                    {client.services.map((service) => {
                      const devs = serviceDevelopers[service.id]?.filter((d: any) => d.isActive) || []
                      return (
                        <div
                          key={service.id}
                          className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
                            service.isActive
                              ? 'bg-white border-gray-200 hover:border-gray-300'
                              : 'bg-gray-50 border-gray-100 opacity-60'
                          }`}
                        >
                          {/* Service Name & Category */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{service.serviceTypeName}</span>
                              {getCategoryBadge(service.serviceCategory)}
                              {!service.isActive && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Ended</span>
                              )}
                            </div>
                          </div>

                          {/* Pricing */}
                          <div className="text-right min-w-[120px]">
                            <div className="text-sm font-medium text-gray-900">
                              {service.serviceLevelPrice ? (
                                `$${service.serviceLevelPrice.toLocaleString()}`
                              ) : service.rate ? (
                                `$${service.rate.toLocaleString()}`
                              ) : (
                                <span className="text-gray-400 font-normal">Per developer</span>
                              )}
                            </div>
                            {(service.serviceLevelPrice || service.rate) && (
                              <div className="text-xs text-gray-500">
                                /{service.billingModel === 'hourly' ? 'hr' : service.billingModel === 'monthly' ? 'mo' : 'project'}
                              </div>
                            )}
                          </div>

                          {/* Dates */}
                          <div className="text-xs text-gray-500 min-w-[100px]">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {parseLocalDate(service.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </div>
                          </div>

                          {/* Invoiced */}
                          {service.totalAmount !== undefined && service.totalAmount > 0 && (
                            <div className="text-xs text-emerald-600 font-medium min-w-[80px] text-right">
                              ${service.totalAmount.toLocaleString()}
                            </div>
                          )}

                          {/* Developer Avatars */}
                          <div className="min-w-[100px]">
                            {devs.length > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex -space-x-1.5">
                                  {devs.slice(0, 3).map((dev: any) => (
                                    <Avatar key={dev.id} className="h-6 w-6 border-2 border-white">
                                      <AvatarImage src={dev.avatarUrl} alt={dev.name} />
                                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                        {dev.name.split(' ').map((n: string) => n[0]).join('')}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                  {devs.length > 3 && (
                                    <div className="h-6 w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-600 font-medium">
                                      +{devs.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No team</span>
                            )}
                          </div>

                          {/* Service Actions */}
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => onEditService(service)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Edit service"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                            {service.isActive ? (
                              <button
                                onClick={() => onRemoveService(service.id, false)}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Deactivate service"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onRemoveService(service.id, true)}
                                className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                                title="Permanently delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No services assigned yet
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
