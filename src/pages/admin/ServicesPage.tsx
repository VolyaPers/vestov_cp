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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage service types, billing models, and service analytics
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service Type
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeServicesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently assigned services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstaffing Services</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.serviceDistribution.find(s => s.category === 'outstaffing')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Developer assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outsourcing Projects</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.serviceDistribution.find(s => s.category === 'outsourcing')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Project-based services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics?.serviceDistribution.reduce((sum, s) => sum + (s.totalRevenue || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              From active services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Service Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Types</CardTitle>
          <CardDescription>
            Manage your service offerings and billing models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{service.name}</h3>
                    <Badge className={getCategoryColor(service.category)}>
                      {service.category}
                    </Badge>
                    <Badge className={getBillingModelColor(service.billingModel)}>
                      {service.billingModel}
                    </Badge>
                  </div>
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created: {new Date(service.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(service)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteService(service.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Service Types</h3>
                <p>Get started by creating your first service type.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Service Type' : 'Create New Service Type'}
            </DialogTitle>
            <DialogDescription>
              {editingService 
                ? 'Update the service type details below.'
                : 'Add a new service type to your offerings.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior React Developer"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the service offering..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
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
              
              <div>
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
            <Button
              onClick={editingService ? handleUpdateService : handleCreateService}
            >
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}