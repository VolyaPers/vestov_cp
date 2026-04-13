import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Building2, Users, DollarSign, TrendingUp, Layers3, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

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
  const { showAlert, showConfirm } = useCustomAlert()
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
    const confirmed = await showConfirm({
      title: 'Delete Service Type',
      message: 'Are you sure you want to delete this service type?',
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

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
      await showAlert({ message, type: 'error' })
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
      <PageHero
        eyebrow="Admin / Services"
        title="Service catalog"
        description="Manage the offerings that drive client staffing, outsourcing, and billing structure across the business."
        theme="ocean"
        meta={
          <>
            <span>{services.length} service types</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{analytics?.activeServicesCount || 0} active in delivery</span>
          </>
        }
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2" title="Create a new service type">
            <Plus className="h-4 w-4" />
            Add service
          </Button>
        }
        aside={
          <Card className="border border-border/80 shadow-none">
            <CardContent className="space-y-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catalog mix</p>
                <Layers3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid gap-2">
                {analytics?.serviceDistribution?.slice(0, 3).map((entry) => (
                  <div key={entry.category} className="flex items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-3 py-2.5">
                    <span className="text-sm font-medium capitalize text-foreground">{entry.category}</span>
                    <span className="text-sm text-muted-foreground">{entry.count}</span>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No distribution data available yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Active services"
          value={analytics?.activeServicesCount || 0}
          hint="Service types currently represented in delivery."
          icon={<Building2 className="h-4 w-4" />}
          tone="primary"
        />
        <MetricTile
          label="Outstaffing"
          value={analytics?.serviceDistribution.find((s) => s.category === 'outstaffing')?.count || 0}
          hint="Catalog entries used for dedicated staffing work."
          icon={<Users className="h-4 w-4" />}
          tone="emerald"
        />
        <MetricTile
          label="Outsourcing"
          value={analytics?.serviceDistribution.find((s) => s.category === 'outsourcing')?.count || 0}
          hint="Packaged delivery and project-based offers."
          icon={<TrendingUp className="h-4 w-4" />}
          tone="violet"
        />
        <MetricTile
          label="Revenue coverage"
          value={`$${(analytics?.serviceDistribution.reduce((sum, s) => sum + (s.totalRevenue || 0), 0) || 0).toLocaleString()}`}
          hint="Estimated revenue attached to catalog distribution."
          icon={<DollarSign className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
        <Card className="border border-border/80 shadow-none">
          <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading
              title="Service types"
              description="Keep the service catalog tight, clearly categorized, and ready for quoting."
              icon={<Building2 className="h-4 w-4" />}
            />
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="group flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-white px-4 py-4 transition-colors hover:bg-slate-50/80">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-slate-50 text-slate-700">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground sm:text-base">{service.name}</h4>
                        <Badge variant="outline" className={getCategoryColor(service.category)}>
                          {service.category}
                        </Badge>
                        <Badge variant="outline" className={getBillingModelColor(service.billingModel)}>
                          {service.billingModel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {service.description || 'No description added yet.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)} title="Edit service type">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteService(service.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete service type"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No service types yet"
                  description="Create the first service type to define how the team sells, staffs, and bills work."
                  action={
                    <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add service
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/80 shadow-none">
            <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                title="Top services"
                description="See which offers carry the most active delivery weight."
                icon={<ArrowUpRight className="h-4 w-4" />}
              />
              <div className="space-y-3">
                {analytics?.topServices?.length ? (
                  analytics.topServices.map((service) => (
                    <div key={service.serviceTypeName} className="rounded-2xl border border-border/70 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{service.serviceTypeName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{service.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{service.activeAssignments} active</p>
                          <p className="text-xs text-muted-foreground">
                            ${(service.totalRevenue || 0).toLocaleString()} revenue
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Top services will appear as soon as assignments generate enough data.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-none">
            <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                title="Billing models"
                description="Keep pricing logic legible across the catalog."
                icon={<DollarSign className="h-4 w-4" />}
              />
              <div className="space-y-2.5">
                {['hourly', 'monthly', 'fixed'].map((model) => {
                  const count = services.filter((service) => service.billingModel === model).length
                  return (
                    <div key={model} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
                      <span className="text-sm font-medium capitalize text-foreground">{model === 'fixed' ? 'Fixed price' : model}</span>
                      <span className="text-sm text-muted-foreground">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
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
