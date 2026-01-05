import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Building2, Users, DollarSign, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

interface ServiceType {
  id: number
  name: string
  description?: string
  category: 'outstaffing' | 'outsourcing'
  billingModel: 'hourly' | 'monthly' | 'fixed'
  createdAt: string
  updatedAt?: string
}

interface ServiceAnalytics {
  serviceDistribution: Array<{
    category: string
    count: number
    totalRevenue?: number
  }>
  activeServicesCount: number
  topServices: Array<{
    serviceTypeName: string
    category: string
    activeAssignments: number
    totalRevenue?: number
  }>
}

export function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([])
  const [analytics, setAnalytics] = useState<ServiceAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'outstaffing' as 'outstaffing' | 'outsourcing',
    billingModel: 'hourly' as 'hourly' | 'monthly' | 'fixed',
  })

  useEffect(() => {
    loadServices()
    loadAnalytics()
  }, [])

  const loadServices = async () => {
    try {
      const response = await api.request('/services/service-types', {
        method: 'GET',
      })
      setServices(response)
    } catch (error) {
      console.error('Failed to load services:', error)
    }
  }

  const loadAnalytics = async () => {
    try {
      const response = await api.request('/services/analytics', {
        method: 'GET',
      })
      setAnalytics(response)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateService = async () => {
    try {
      await api.request('/services/service-types', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      loadServices()
      loadAnalytics()
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create service:', error)
    }
  }

  const handleUpdateService = async () => {
    if (!editingService) return
    
    try {
      await api.request(`/services/service-types/${editingService.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      })
      loadServices()
      loadAnalytics()
      setIsDialogOpen(false)
      setEditingService(null)
      resetForm()
    } catch (error) {
      console.error('Failed to update service:', error)
    }
  }

  const handleDeleteService = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service type?')) return
    
    try {
      await api.request(`/services/service-types/${id}`, {
        method: 'DELETE',
      })
      loadServices()
      loadAnalytics()
    } catch (error: any) {
      console.error('Failed to delete service:', error)
      // Show a user-friendly error message
      const message = error.message === 'Cannot delete service type that is in use' 
        ? 'Cannot delete this service type because it is currently assigned to clients. Remove all client assignments first.'
        : error.message || 'Failed to delete service type. Please try again.'
      alert(message)
    }
  }

  const openEditDialog = (service: ServiceType) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      billingModel: service.billingModel,
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'outstaffing',
      billingModel: 'hourly',
    })
    setEditingService(null)
  }

  const getCategoryColor = (category: string) => {
    return category === 'outstaffing' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
  }

  const getBillingModelColor = (model: string) => {
    switch (model) {
      case 'hourly': return 'bg-yellow-100 text-yellow-800'
      case 'monthly': return 'bg-purple-100 text-purple-800'
      case 'fixed': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
              Services
            </h1>
            <p className="stripe-text-secondary text-lg">
              Manage service types, billing models, and service analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="stripe-badge-neutral">
              <Building2 className="h-4 w-4 mr-2" />
              {services.length} Service Types
            </div>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="stripe-btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service Type
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Cards - Stripe style */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Building2 className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{analytics?.activeServicesCount || 0}</div>
              <div className="text-sm stripe-text-secondary">Active Services</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">Currently assigned services</div>
        </div>

        <div className="group relative stripe-card rounded-lg p-6 border border-green-100 hover:border-green-200 transition-all duration-200 hover:shadow-lg hover:shadow-green-100/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.serviceDistribution.find(s => s.category === 'outstaffing')?.count || 0}
              </div>
              <div className="text-sm font-medium text-green-700">Outstaffing</div>
            </div>
          </div>
          <div className="text-sm text-green-600 font-medium">Developer assignments</div>
        </div>

        <div className="group relative stripe-card rounded-lg p-6 border border-purple-100 hover:border-purple-200 transition-all duration-200 hover:shadow-lg hover:shadow-purple-100/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.serviceDistribution.find(s => s.category === 'outsourcing')?.count || 0}
              </div>
              <div className="text-sm font-medium text-purple-700">Outsourcing</div>
            </div>
          </div>
          <div className="text-sm text-purple-600 font-medium">Project-based services</div>
        </div>

        <div className="group relative stripe-card rounded-lg p-6 border border-orange-100 hover:border-orange-200 transition-all duration-200 hover:shadow-lg hover:shadow-orange-100/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                ${analytics?.serviceDistribution.reduce((sum, s) => sum + (s.totalRevenue || 0), 0).toLocaleString() || 0}
              </div>
              <div className="text-sm font-medium text-orange-700">Total Revenue</div>
            </div>
          </div>
          <div className="text-sm text-orange-600 font-medium">From active services</div>
        </div>
      </div>

      {/* Service Types */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Service Types</h3>
              <p className="text-gray-600 mt-1">Manage your service offerings and billing models</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="h-4 w-4" />
              {services.length} service types
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {services.map((service) => (
              <div key={service.id} className="group relative bg-gradient-to-r from-gray-50 to-white rounded-lg p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 via-purple-400 to-purple-500 text-white shadow-lg">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{service.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getCategoryColor(service.category)} rounded-full px-3 py-1`}>
                            {service.category}
                          </Badge>
                          <Badge className={`${getBillingModelColor(service.billingModel)} rounded-full px-3 py-1`}>
                            {service.billingModel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {service.description && (
                      <p className="text-gray-600 mb-3 pl-15">{service.description}</p>
                    )}
                    <div className="flex items-center gap-2 pl-15 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg w-fit">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Created: <span className="font-medium">{new Date(service.createdAt).toLocaleDateString()}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(service)}
                      className="rounded-xl border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteService(service.id)}
                      className="rounded-xl border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-12 text-center border border-gray-200">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300">
                  <Building2 className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Service Types</h3>
                <p className="text-gray-500">Get started by creating your first service type</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-lg border border-gray-200 shadow-2xl">
          <DialogHeader className="space-y-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 via-purple-400 to-purple-500 text-white shadow-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  {editingService ? 'Edit Service Type' : 'Create New Service Type'}
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  {editingService 
                    ? 'Update the service type details below.'
                    : 'Add a new service type to your offerings.'
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Service Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior React Developer"
                className="rounded-xl border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the service offering..."
                className="rounded-xl border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 min-h-[80px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium text-gray-700">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: 'outstaffing' | 'outsourcing') => 
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outstaffing" className="rounded-lg">Outstaffing</SelectItem>
                    <SelectItem value="outsourcing" className="rounded-lg">Outsourcing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="billingModel" className="text-sm font-medium text-gray-700">Billing Model</Label>
                <Select
                  value={formData.billingModel}
                  onValueChange={(value: 'hourly' | 'monthly' | 'fixed') => 
                    setFormData({ ...formData, billingModel: value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly" className="rounded-lg">Hourly</SelectItem>
                    <SelectItem value="monthly" className="rounded-lg">Monthly</SelectItem>
                    <SelectItem value="fixed" className="rounded-lg">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
              className="rounded-xl border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={editingService ? handleUpdateService : handleCreateService}
              className="stripe-btn-primary rounded-lg"
            >
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}