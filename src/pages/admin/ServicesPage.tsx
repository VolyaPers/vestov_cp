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
              title="Create a new service type"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service Type
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Cards - Stripe style */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">{analytics?.activeServicesCount || 0}</div>
              <div className="text-sm text-gray-500">Active Services</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.serviceDistribution.find(s => s.category === 'outstaffing')?.count || 0}
              </div>
              <div className="text-sm text-gray-500">Outstaffing</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.serviceDistribution.find(s => s.category === 'outsourcing')?.count || 0}
              </div>
              <div className="text-sm text-gray-500">Outsourcing</div>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900">
                ${analytics?.serviceDistribution.reduce((sum, s) => sum + (s.totalRevenue || 0), 0).toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-500">Total Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Types */}
      <div className="stripe-card">
        <div className="p-6 border-b stripe-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold stripe-text-primary">Service Types</h3>
              <p className="text-sm stripe-text-secondary mt-1">Manage your service offerings and billing models</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="group flex items-center justify-between p-4 stripe-surface rounded-lg stripe-border hover:bg-gray-50 transition-colors duration-150">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900">{service.name}</h4>
                      <Badge className={`${getCategoryColor(service.category)} text-xs`}>
                        {service.category}
                      </Badge>
                      <Badge className={`${getBillingModelColor(service.billingModel)} text-xs`}>
                        {service.billingModel}
                      </Badge>
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-500 mt-1 truncate">{service.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-4 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(service)}
                    title="Edit service type"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteService(service.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete service type"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="stripe-surface rounded-lg p-12 text-center stripe-border">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-1">No Service Types</h3>
                <p className="text-sm text-gray-500">Get started by creating your first service type</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Service Type' : 'Create Service Type'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Update the service type details below.'
                : 'Add a new service type to your offerings.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior React Developer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the service offering..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: 'outstaffing' | 'outsourcing') =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outstaffing">Outstaffing</SelectItem>
                    <SelectItem value="outsourcing">Outsourcing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingModel">Billing Model</Label>
                <Select
                  value={formData.billingModel}
                  onValueChange={(value: 'hourly' | 'monthly' | 'fixed') =>
                    setFormData({ ...formData, billingModel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingService ? handleUpdateService : handleCreateService}>
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}