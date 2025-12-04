import { useState, useEffect } from 'react'
import { Building, Users, DollarSign, TrendingUp, Plus, Search, Eye, Trash2, Calendar, Settings } from 'lucide-react'
import { useLocation } from 'wouter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

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


export function ClientsPage() {
  const [, setLocation] = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active')
  const [clients, setClients] = useState<Client[]>([])
  const [analytics, setAnalytics] = useState<ClientAnalytics | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [serviceDevelopers, setServiceDevelopers] = useState<{ [serviceId: number]: any[] }>({})
  const [isLoading, setIsLoading] = useState(true)
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

  const loadClients = async () => {
    try {
      const response = await api.request('/services/clients', {
        method: 'GET',
      })
      
      // Load invoice totals and service totals for each client
      const clientsWithInvoiceData = await Promise.all(
        response.map(async (client: Client) => {
          try {
            // Get client invoice totals
            console.log('Fetching invoice totals for client:', client.id)
            const invoiceTotals = await api.getClientInvoiceTotals(client.id)
            console.log('Invoice totals for client', client.id, ':', invoiceTotals)

            return {
              ...client,
              invoiceTotals
            }
          } catch (error) {
            console.error(`Failed to load invoice data for client ${client.id}:`, error)
            return client
          }
        })
      )
      
      setClients(clientsWithInvoiceData)
      // Load developers for all services after clients are loaded
      await loadServiceDevelopers(clientsWithInvoiceData)
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadServiceDevelopers = async (clientsData: Client[]) => {
    try {
      const developersData: { [serviceId: number]: any[] } = {}
      
      // Get all services from all clients
      const allServices = clientsData.flatMap(client => 
        client.services.map(service => ({ ...service, clientId: client.id }))
      )
      
      // Fetch developers for each service
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
    
    if (!confirm(message)) return

    try {
      const url = permanent 
        ? `/services/clients/${clientId}/services/${serviceId}?permanent=true`
        : `/services/clients/${clientId}/services/${serviceId}`
        
      await api.request(url, {
        method: 'DELETE',
      })
      loadClients()
      loadAnalytics()
      
      const successMessage = permanent 
        ? 'Service assignment permanently deleted'
        : 'Service assignment deactivated successfully'
      alert(successMessage)
    } catch (error: any) {
      console.error('Failed to remove service:', error)
      alert(error.message || 'Failed to remove service assignment')
    }
  }

  const handleAddService = async () => {
    if (!selectedClient || !newServiceData.serviceTypeId || !newServiceData.startDate) {
      alert('Please fill in all required fields')
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
      alert(error.message || 'Failed to add service to client')
    }
  }

  const handleCreateClient = async () => {
    if (!newClientData.name) {
      alert('Please fill in the required field: Client Name')
      return
    }

    try {
      await api.createClient({
        ...newClientData,
        teamSize: newClientData.teamSize ? parseInt(newClientData.teamSize) : 0,
      })
      loadClients()
      loadAnalytics()
      setIsClientDialogOpen(false)
      resetClientForm()
      alert('Client created successfully!')
    } catch (error: any) {
      console.error('Failed to create client:', error)
      alert(error.message || 'Failed to create client')
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
      isActive: service.isActive
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
        isActive: editingServiceData.isActive
      })

      loadClients()
      setIsEditServiceDialogOpen(false)
      setEditingServiceData(null)

      alert('Service updated successfully!')
    } catch (error: any) {
      console.error('Failed to update service:', error)
      alert(error.message || 'Failed to update service')
    }
  }

  const resetEditServiceForm = () => {
    setEditingServiceData(null)
  }

  const filteredClients = clients.filter(client => {
    // Filter by tab (active/all)
    const matchesTab = activeTab === 'all' || client.status === 'active'

    // Filter by search term
    const matchesSearch = !searchTerm ||
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesTab && matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'prospect': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    return category === 'outstaffing' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
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
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Clients
            </h1>
            <p className="stripe-text-secondary text-lg">
              Manage client relationships and service assignments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="stripe-badge-neutral">
              <Building className="h-4 w-4 mr-2" />
              {analytics?.activeClients || 0} Active Clients
            </div>
            <button
              onClick={() => setIsClientDialogOpen(true)}
              className="stripe-btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Cards - Stripe style */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Building className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{analytics?.totalClients || 0}</div>
              <div className="text-sm stripe-text-secondary">Total Clients</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">All registered clients</div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Users className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{analytics?.activeClients || 0}</div>
              <div className="text-sm stripe-text-secondary">Active Clients</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">With active services</div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <DollarSign className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">
                ${analytics?.totalRevenue?.toLocaleString() || 0}
              </div>
              <div className="text-sm stripe-text-secondary">Total Revenue</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">Monthly recurring revenue</div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <TrendingUp className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">
                ${analytics?.activeClients
                  ? Math.round((analytics.totalRevenue || 0) / analytics.activeClients).toLocaleString()
                  : 0}
              </div>
              <div className="text-sm stripe-text-secondary">Avg Revenue</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">Per active client</div>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 stripe-text-muted h-4 w-4" />
          <input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="stripe-input pl-10 w-full"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'all')} className="w-auto">
          <TabsList className="bg-gradient-to-r from-gray-50 to-gray-100">
            <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
              Active
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Clients Portfolio */}
      <div className="stripe-card">
        <div className="stripe-table-header">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold stripe-text-primary">Client Portfolio</h3>
              <p className="stripe-text-secondary mt-1">Overview of all clients and their service assignments</p>
            </div>
            <div className="flex items-center gap-2 text-sm stripe-text-muted">
              <Users className="h-4 w-4" />
              {filteredClients.length} clients
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {filteredClients.map((client) => (
              <div key={client.id} className="group relative stripe-card rounded-lg p-6 hover:shadow-md transition-all duration-150">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white text-gray-700 shadow-sm overflow-hidden border border-gray-200">
                        {client.logoUrl ? (
                          <img
                            src={client.logoUrl}
                            alt={client.name}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <Building className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <h3
                          className="text-xl font-bold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors duration-200"
                          onClick={() => setLocation(`/admin/clients/${client.id}`)}
                        >
                          {client.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getStatusColor(client.status)} rounded-full px-3 py-1`}>
                            {client.status}
                          </Badge>
                          {client.contractType && (
                            <Badge variant="outline" className="capitalize rounded-full px-3 py-1 border-gray-300">
                              {client.contractType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {client.industry && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Industry: <span className="font-medium">{client.industry}</span></span>
                        </div>
                      )}
                      {client.contactEmail && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Email: <span className="font-medium">{client.contactEmail}</span></span>
                        </div>
                      )}
                      {(() => {
                        // Calculate total developers from all active services accounting for workload percentage
                        const totalDevelopers = client.services
                          .filter(s => s.isActive)
                          .reduce((sum, service) => {
                            const serviceDev = serviceDevelopers[service.id] || []
                            // Sum up workload percentages (e.g., 2 full-time = 2.0, 1 part-time 50% = 0.5)
                            const serviceWorkload = serviceDev.reduce((devSum: number, dev: any) => {
                              const workload = dev.workloadPercentage ? parseFloat(dev.workloadPercentage) / 100 : 1.0
                              return devSum + workload
                            }, 0)
                            return sum + serviceWorkload
                          }, 0)

                        return totalDevelopers > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span>Team: <span className="font-medium">{totalDevelopers % 1 === 0 ? totalDevelopers : totalDevelopers.toFixed(1)} {totalDevelopers === 1 ? 'developer' : 'developers'}</span></span>
                          </div>
                        )
                      })()}
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>Since: <span className="font-medium">{new Date(client.createdAt).toLocaleDateString()}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        <span>Invoiced: <span className="font-bold text-blue-900">${(client.invoiceTotals?.totalInvoiced || 0).toLocaleString()}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span>Paid: <span className="font-bold text-green-900">${(client.invoiceTotals?.totalPaid || 0).toLocaleString()}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <Calendar className="h-4 w-4 text-amber-600" />
                        <span>Outstanding: <span className="font-bold text-amber-900">${((client.invoiceTotals?.totalInvoiced || 0) - (client.invoiceTotals?.totalPaid || 0)).toLocaleString()}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('Navigating to client:', client.id, 'URL:', `/admin/clients/${client.id}`)
                        setLocation(`/admin/clients/${client.id}`)
                      }}
                      className="rounded-xl border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete ${client.name}?\n\nThis action cannot be undone and will also delete:\n- All service assignments\n- All invoices\n- All documents\n- All related data\n\nType the client name to confirm.`)) {
                          const confirmation = window.prompt(`Type "${client.name}" to confirm deletion:`)
                          if (confirmation === client.name) {
                            try {
                              await api.request(`/admin/clients/${client.id}`, { method: 'DELETE' })
                              // Refresh the clients list
                              loadClients()
                            } catch (error: any) {
                              alert(error.message || 'Failed to delete client')
                            }
                          } else if (confirmation !== null) {
                            alert('Client name did not match. Deletion cancelled.')
                          }
                        }
                      }}
                      className="rounded-xl border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Service Assignments */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <h4 className="font-medium">Service Assignments ({client.activeServicesCount} active)</h4>
                      <span className="text-sm text-gray-600">
                        Monthly Revenue: <span className="font-medium">${client.totalMonthlyRevenue.toLocaleString()}</span>
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client)
                        setIsServiceDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Service
                    </Button>
                  </div>
                  
                  {client.services.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {client.services.map((service) => (
                        <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{service.serviceTypeName}</span>
                              <Badge className={getCategoryColor(service.serviceCategory)} size="sm">
                                {service.serviceCategory}
                              </Badge>
                              {!service.isActive && (
                                <Badge variant="outline" className="text-red-600">
                                  Ended
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">
                              {service.serviceLevelPrice ? (
                                `Service: $${service.serviceLevelPrice.toLocaleString()}/${service.billingModel === 'hourly' ? 'hr' : service.billingModel === 'monthly' ? 'month' : 'project'}`
                              ) : service.rate ? (
                                `Rate: $${service.rate.toLocaleString()}/${service.billingModel === 'hourly' ? 'hr' : service.billingModel === 'monthly' ? 'month' : 'project'}`
                              ) : (
                                'Pricing: Individual developers'
                              )}
                              <span className="ml-2">Since: {new Date(service.startDate).toLocaleDateString()}</span>
                            </div>
                            {service.totalAmount !== undefined && (
                              <div className="text-xs font-medium text-green-600 mt-1">
                                Total Invoiced: ${service.totalAmount.toLocaleString()}
                              </div>
                            )}
                            
                            {/* Developer Avatars */}
                            {serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <div className="flex -space-x-1">
                                  {serviceDevelopers[service.id]
                                    .filter(dev => dev.isActive)
                                    .slice(0, 3)
                                    .map((dev, index) => (
                                      <Avatar key={dev.id} className="h-6 w-6 border-2 border-white">
                                        <AvatarImage src={dev.avatarUrl} alt={dev.name} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                          {dev.name.split(' ').map((n: string) => n[0]).join('')}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))
                                  }
                                  {serviceDevelopers[service.id].filter(dev => dev.isActive).length > 3 && (
                                    <div className="h-6 w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                                      +{serviceDevelopers[service.id].filter(dev => dev.isActive).length - 3}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 ml-2">
                                  {serviceDevelopers[service.id].filter(dev => dev.isActive).length} developer{serviceDevelopers[service.id].filter(dev => dev.isActive).length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditService(client.id, service)}
                              className="text-gray-600 hover:text-gray-700"
                              title="Edit service"
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                            {service.isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveService(client.id, service.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Deactivate service"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveService(client.id, service.id, true)}
                                className="text-red-700 hover:text-red-800 border-red-200"
                                title="Permanently delete service assignment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded">
                      <Building className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p>No services assigned</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {filteredClients.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Clients Found</h3>
                <p>No clients match your search criteria.</p>
              </div>
            )}
          </div>
        </div>
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
                    <SelectItem key={service.id} value={service.id.toString()}>
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
                      rate: e.target.value ? parseFloat(e.target.value) : undefined 
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
                      serviceLevelPrice: e.target.value ? parseFloat(e.target.value) : undefined 
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
                      startDate: e.target.value 
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
                      endDate: e.target.value || undefined 
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
                    isActive: e.target.checked 
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