import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DollarSign, TrendingUp, FileText, AlertCircle, Eye, Edit, Save, X, Calculator, Plus, Users, Settings } from 'lucide-react'
import { api } from '@/lib/api'

interface InvoiceStatsChartProps {
  clientId: number
}

interface InvoiceStats {
  totalInvoiced: number
  totalPaid: number
  totalOutstanding: number
  invoiceCount: number
  paidInvoiceCount: number
  overdue: number
}

interface Invoice {
  id: number
  invoiceNumber: string
  amount: string
  invoiceDate: string
  periodStart?: string
  periodEnd?: string
  description?: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dueDate?: string
  paidAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  serviceIds?: number[]
  services?: InvoiceService[]
}

interface InvoiceService {
  id: number
  serviceId: number
  serviceName: string
  serviceCategory: string
  billingModel: string
  serviceLevelPrice?: number
  calculatedAmount: number
  developers: InvoiceDeveloper[]
}

interface InvoiceDeveloper {
  id: number
  developerId: number
  developerName: string
  hourlyRate?: number
  fixedPrice?: number
  hoursWorked?: number
  calculatedAmount: number
}

interface ClientServiceOption {
  id: number
  serviceId: number
  serviceName: string
  serviceCategory: string
  billingModel: string
  serviceLevelPrice?: number
  isActive: boolean
  developers: Array<{
    id: number
    developerId: number
    developerName: string
    hourlyRate?: string
    fixedPrice?: string
    employmentType: string
    isActive: boolean
  }>
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'default' // green
    case 'sent':
      return 'secondary' // blue
    case 'overdue':
      return 'destructive' // red
    case 'draft':
      return 'outline' // gray
    case 'cancelled':
      return 'outline' // gray
    default:
      return 'outline'
  }
}

export function InvoiceStatsChart({ clientId }: InvoiceStatsChartProps) {
  const queryClient = useQueryClient()
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    overdue: 0
  })

  // State for invoice dialogs
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    amount: '',
    invoiceDate: '',
    dueDate: '',
    periodStart: '',
    periodEnd: '',
    description: '',
    notes: '',
    status: '' as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | ''
  })
  
  // Service-based editing state
  const [editMode, setEditMode] = useState<'manual' | 'service-based'>('manual')
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [developerRates, setDeveloperRates] = useState<{ [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }>({})
  const [serviceLevelPrices, setServiceLevelPrices] = useState<{ [key: number]: number }>({})
  const [calculatedTotal, setCalculatedTotal] = useState(0)

  // Fetch client invoice totals
  const { data: invoiceTotals } = useQuery({
    queryKey: ['client-invoice-totals', clientId],
    queryFn: () => api.getClientInvoiceTotals(clientId),
  })

  // Fetch individual invoices to calculate more detailed stats
  const { data: invoices } = useQuery({
    queryKey: ['client-invoices', clientId],
    queryFn: () => api.getClientInvoices(clientId),
  })

  // Fetch client service options for editing
  const { data: clientServiceOptions } = useQuery({
    queryKey: ['client-service-options', clientId],
    queryFn: () => api.getClientServiceOptions(clientId),
    enabled: !!editInvoice
  })

  useEffect(() => {
    if (invoiceTotals && invoices) {
      const totalInvoiced = invoiceTotals.totalInvoiced || 0
      const totalPaid = invoiceTotals.totalPaid || 0
      const totalOutstanding = totalInvoiced - totalPaid
      const invoiceCount = invoices.length
      const paidInvoiceCount = invoices.filter((inv: any) => inv.status === 'paid').length
      
      // Calculate overdue invoices
      const today = new Date()
      const overdue = invoices
        .filter((inv: any) => inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < today)
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)

      setStats({
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        invoiceCount,
        paidInvoiceCount,
        overdue
      })
    }
  }, [invoiceTotals, invoices])

  const pieData = [
    { name: 'Paid', value: stats.totalPaid, color: '#10b981' },
    { name: 'Outstanding', value: stats.totalOutstanding, color: '#f59e0b' },
    { name: 'Overdue', value: stats.overdue, color: '#ef4444' },
  ].filter(item => item.value > 0)

  const barData = [
    { 
      name: 'Total Invoiced', 
      totalInvoiced: stats.totalInvoiced,
      paid: 0,
      outstanding: 0,
      overdue: 0
    },
    { 
      name: 'Paid', 
      totalInvoiced: 0,
      paid: stats.totalPaid,
      outstanding: 0,
      overdue: 0
    },
    { 
      name: 'Outstanding', 
      totalInvoiced: 0,
      paid: 0,
      outstanding: stats.totalOutstanding,
      overdue: 0
    },
    { 
      name: 'Overdue', 
      totalInvoiced: 0,
      paid: 0,
      outstanding: 0,
      overdue: stats.overdue
    },
  ]

  // Handle opening edit dialog
  const handleEditInvoice = (invoice: Invoice) => {
    setEditInvoice(invoice)
    setEditForm({
      amount: invoice.amount,
      invoiceDate: invoice.invoiceDate.split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      periodStart: invoice.periodStart ? invoice.periodStart.split('T')[0] : '',
      periodEnd: invoice.periodEnd ? invoice.periodEnd.split('T')[0] : '',
      description: invoice.description || '',
      notes: invoice.notes || '',
      status: invoice.status
    })

    // Set service-based editing mode if invoice has services
    if (invoice.serviceIds && invoice.serviceIds.length > 0) {
      setEditMode('service-based')
      setSelectedServices(invoice.serviceIds)
    } else {
      setEditMode('manual')
      setSelectedServices([])
    }

    // Initialize developer rates if available
    if (invoice.services) {
      const rates: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } } = {}
      invoice.services.forEach(service => {
        service.developers.forEach(dev => {
          rates[dev.developerId] = {
            hourlyRate: dev.hourlyRate,
            fixedPrice: dev.fixedPrice,
            hoursWorked: dev.hoursWorked
          }
        })
      })
      setDeveloperRates(rates)
    }

    setCalculatedTotal(parseFloat(invoice.amount))
  }

  // Handle service selection change
  const handleServiceToggle = (serviceId: number, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, serviceId])
    } else {
      setSelectedServices(prev => prev.filter(id => id !== serviceId))
    }
  }

  // Calculate pricing when in service-based mode
  const calculateServicePricing = async () => {
    if (!editInvoice || selectedServices.length === 0) return

    try {
      const pricingData = await api.calculateServicePricing(clientId, {
        serviceIds: selectedServices,
        periodStart: editForm.periodStart,
        periodEnd: editForm.periodEnd,
        developerRates: developerRates
      })
      
      const total = pricingData.reduce((sum: number, service: any) => sum + service.finalAmount, 0)
      setCalculatedTotal(total)
      setEditForm(prev => ({ ...prev, amount: total.toString() }))
    } catch (error) {
      console.error('Failed to calculate pricing:', error)
    }
  }

  // Handle form submission
  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInvoice) return

    setIsUpdating(true)
    try {
      const updateData: any = {
        amount: editMode === 'service-based' ? calculatedTotal : parseFloat(editForm.amount),
        invoiceDate: editForm.invoiceDate,
        dueDate: editForm.dueDate || null,
        periodStart: editForm.periodStart || null,
        periodEnd: editForm.periodEnd || null,
        description: editForm.description || null,
        notes: editForm.notes || null,
        status: editForm.status
      }

      if (editMode === 'service-based') {
        updateData.serviceIds = selectedServices
        updateData.developerRates = developerRates
        updateData.useServicePricing = true
      }

      await api.updateInvoice(editInvoice.id, updateData)

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['client-invoice-totals', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client-invoices', clientId] })
      
      // Close dialog
      setEditInvoice(null)
      setIsUpdating(false)
    } catch (error) {
      console.error('Failed to update invoice:', error)
      setIsUpdating(false)
    }
  }

  // Format date for input fields
  const formatDateForInput = (dateString: string) => {
    return dateString ? new Date(dateString).toISOString().split('T')[0] : ''
  }

  return (
    <div>
      <Tabs defaultValue="statistics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Invoices ({stats.invoiceCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statistics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Invoice Statistics
              </CardTitle>
              <CardDescription>Financial overview and payment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-600">Total Invoices</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.invoiceCount}</div>
                  </div>
                </div>

                <div className="flex items-center p-3 bg-green-50 rounded-lg">
                  <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-600">Total Paid</div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
                  </div>
                </div>

                <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-yellow-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-600">Outstanding</div>
                    <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalOutstanding)}</div>
                  </div>
                </div>

                <div className="flex items-center p-3 bg-red-50 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-600">Overdue</div>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-medium mb-3">Payment Breakdown</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="totalInvoiced" fill="#6b7280" name="Total Invoiced" />
                      <Bar dataKey="paid" fill="#10b981" name="Paid" />
                      <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" />
                      <Bar dataKey="overdue" fill="#ef4444" name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 className="text-lg font-medium mb-3">Payment Status Distribution</h4>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-gray-500">
                      No invoice data available
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Client Invoices
              </CardTitle>
              <CardDescription>All invoices for this client</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoices.map((invoice: Invoice) => (
                    <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-lg">
                            {invoice.invoiceNumber}
                          </div>
                          <Badge variant={getStatusBadgeVariant(invoice.status)}>
                            {invoice.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(parseFloat(invoice.amount))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Invoice Date:</span>
                          <div>{formatDate(invoice.invoiceDate)}</div>
                        </div>
                        {invoice.dueDate && (
                          <div>
                            <span className="font-medium">Due Date:</span>
                            <div>{formatDate(invoice.dueDate)}</div>
                          </div>
                        )}
                        {invoice.periodStart && invoice.periodEnd && (
                          <div>
                            <span className="font-medium">Service Period:</span>
                            <div>{formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}</div>
                          </div>
                        )}
                        {invoice.paidAt && (
                          <div>
                            <span className="font-medium">Paid Date:</span>
                            <div>{formatDate(invoice.paidAt)}</div>
                          </div>
                        )}
                      </div>

                      {invoice.description && (
                        <div className="text-sm text-gray-700 mb-3">
                          <span className="font-medium">Description:</span> {invoice.description}
                        </div>
                      )}

                      {invoice.notes && (
                        <div className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Notes:</span> {invoice.notes}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div>Created: {formatDate(invoice.createdAt)}</div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setViewInvoice(invoice)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => handleEditInvoice(invoice)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Invoices Found</h3>
                  <p>This client doesn't have any invoices yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Invoice Details - {viewInvoice?.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              Complete invoice information
            </DialogDescription>
          </DialogHeader>
          
          {viewInvoice && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-2xl font-bold">{viewInvoice.invoiceNumber}</div>
                  <Badge variant={getStatusBadgeVariant(viewInvoice.status)} className="mt-1">
                    {viewInvoice.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(parseFloat(viewInvoice.amount))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Invoice Date</label>
                    <div className="text-sm text-gray-900">{formatDate(viewInvoice.invoiceDate)}</div>
                  </div>
                  {viewInvoice.dueDate && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Due Date</label>
                      <div className="text-sm text-gray-900">{formatDate(viewInvoice.dueDate)}</div>
                    </div>
                  )}
                  {viewInvoice.paidAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Paid Date</label>
                      <div className="text-sm text-gray-900">{formatDate(viewInvoice.paidAt)}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {viewInvoice.periodStart && viewInvoice.periodEnd && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Service Period</label>
                      <div className="text-sm text-gray-900">
                        {formatDate(viewInvoice.periodStart)} - {formatDate(viewInvoice.periodEnd)}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Created</label>
                    <div className="text-sm text-gray-900">{formatDate(viewInvoice.createdAt)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Last Updated</label>
                    <div className="text-sm text-gray-900">{formatDate(viewInvoice.updatedAt)}</div>
                  </div>
                </div>
              </div>

              {viewInvoice.description && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm text-gray-900">
                    {viewInvoice.description}
                  </div>
                </div>
              )}

              {viewInvoice.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm text-gray-600">
                    {viewInvoice.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editInvoice} onOpenChange={() => setEditInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Invoice - {editInvoice?.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              Update invoice information and details
            </DialogDescription>
          </DialogHeader>
          
          {editInvoice && (
            <form onSubmit={handleUpdateInvoice} className="space-y-6">
              {/* Mode Toggle */}
              <Tabs value={editMode} onValueChange={(value: any) => setEditMode(value)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Manual Amount
                  </TabsTrigger>
                  <TabsTrigger value="service-based" className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Service-Based
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                      />
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <Select value={editForm.status} onValueChange={(value: any) => setEditForm(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="service-based" className="space-y-6">
                  {/* Service Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Select Services</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={calculateServicePricing}
                        disabled={selectedServices.length === 0}
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate Total
                      </Button>
                    </div>

                    {clientServiceOptions && clientServiceOptions.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {clientServiceOptions.map((service: ClientServiceOption) => (
                          <div key={service.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={selectedServices.includes(service.serviceId)}
                                  onCheckedChange={(checked) => handleServiceToggle(service.serviceId, checked as boolean)}
                                />
                                <div>
                                  <div className="font-medium">{service.serviceName}</div>
                                  <div className="text-sm text-gray-500">{service.serviceCategory}</div>
                                </div>
                              </div>
                              <Badge variant="outline">{service.billingModel}</Badge>
                            </div>

                            {selectedServices.includes(service.serviceId) && service.developers.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <Label className="text-sm font-medium mb-3 block">Assigned Developers</Label>
                                <div className="grid grid-cols-1 gap-3">
                                  {service.developers.filter(dev => dev.isActive).map((developer) => (
                                    <div key={developer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                      <div>
                                        <div className="font-medium text-sm">{developer.developerName}</div>
                                        <div className="text-xs text-gray-500">{developer.employmentType}</div>
                                      </div>
                                      <div className="flex gap-2">
                                        {developer.hourlyRate && (
                                          <Input
                                            type="number"
                                            placeholder="Hours"
                                            className="w-20 text-xs"
                                            value={developerRates[developer.developerId]?.hoursWorked || ''}
                                            onChange={(e) => {
                                              const hours = parseFloat(e.target.value) || 0
                                              setDeveloperRates(prev => ({
                                                ...prev,
                                                [developer.developerId]: {
                                                  ...prev[developer.developerId],
                                                  hoursWorked: hours,
                                                  hourlyRate: parseFloat(developer.hourlyRate || '0')
                                                }
                                              }))
                                            }}
                                          />
                                        )}
                                        <div className="text-sm text-right">
                                          {developer.hourlyRate && <div>${developer.hourlyRate}/hr</div>}
                                          {developer.fixedPrice && <div>${developer.fixedPrice} fixed</div>}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Services Available</h3>
                        <p className="text-sm">This client doesn't have any active services configured.</p>
                      </div>
                    )}

                    {calculatedTotal > 0 && (
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-green-800">Calculated Total:</span>
                          <span className="text-2xl font-bold text-green-600">{formatCurrency(calculatedTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Common fields for both modes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice Date */}
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date *</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={editForm.invoiceDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    required
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>

                {/* Period Start */}
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Service Period Start</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={editForm.periodStart}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, periodStart: e.target.value }))
                      if (editMode === 'service-based') {
                        setTimeout(calculateServicePricing, 100)
                      }
                    }}
                  />
                </div>

                {/* Period End */}
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Service Period End</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={editForm.periodEnd}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, periodEnd: e.target.value }))
                      if (editMode === 'service-based') {
                        setTimeout(calculateServicePricing, 100)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Status for service-based mode */}
              {editMode === 'service-based' && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={editForm.status} onValueChange={(value: any) => setEditForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Invoice description..."
                  rows={3}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditInvoice(null)}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isUpdating || (editMode === 'manual' && !editForm.amount) || !editForm.status}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdating ? 'Updating...' : 'Update Invoice'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}