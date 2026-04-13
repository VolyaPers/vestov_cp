import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, DollarSign, Calendar, FileText, Calculator, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { Invoice, CreateInvoiceData as InvoiceCreateInvoiceData, UpdateInvoiceData as InvoiceUpdateInvoiceData } from '@/types/invoice'
import type { CreateInvoiceData, UpdateInvoiceData } from '@/types/common'
import { EnhancedInvoiceForm } from './EnhancedInvoiceForm'

interface InvoiceListProps {
  clientId: number
  clientName: string
}

export function InvoiceList({ clientId, clientName }: InvoiceListProps) {
  const { showAlert, showConfirm } = useCustomAlert()
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  
  // Get default dates
  const today = new Date().toISOString().split('T')[0]
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0]
  
  const [newInvoiceData, setNewInvoiceData] = useState<InvoiceCreateInvoiceData>({
    clientId,
    amount: 0,
    invoiceDate: today,
    periodStart: lastMonthStart,
    periodEnd: lastMonthEnd,
    description: '',
    notes: ''
  })
  
  const [editInvoiceData, setEditInvoiceData] = useState<InvoiceUpdateInvoiceData>({})

  // Fetch invoices for this client
  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['invoices', 'client', clientId],
    queryFn: () => api.getClientInvoices(clientId),
    retry: false, // Don't retry on authentication errors
  })

  // Fetch detailed invoice data when editing
  const { data: detailedInvoice } = useQuery({
    queryKey: ['invoice', editingInvoice?.id],
    queryFn: () => editingInvoice ? api.getInvoice(editingInvoice.id) : null,
    enabled: !!editingInvoice?.id,
    retry: false,
  })

  // Fetch service options for the client when editing
  const { data: serviceOptions } = useQuery({
    queryKey: ['client-service-options', clientId],
    queryFn: () => api.getClientServiceOptions(clientId),
    enabled: isEditDialogOpen,
    retry: false,
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (data: InvoiceCreateInvoiceData) => {
      // Convert from invoice types to common types
      const commonData: CreateInvoiceData = {
        clientId: data.clientId,
        invoiceNumber: `INV-${Date.now()}`, // Generate invoice number
        amount: data.amount?.toString() || '0',
        invoiceDate: data.invoiceDate || today,
        periodStart: data.periodStart || lastMonthStart,
        periodEnd: data.periodEnd || lastMonthEnd,
        description: data.description,
        notes: data.notes,
        dueDate: data.dueDate,
        serviceIds: data.serviceIds,
      }
      return api.createInvoice(commonData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
      setIsAddDialogOpen(false)
      resetNewInvoiceForm()
    },
    onError: (error: any) => {
      showAlert({ message: error.message || 'Failed to create invoice', type: 'error' })
    }
  })

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InvoiceUpdateInvoiceData }) => {
      // Convert from invoice types to common types
      const commonData: UpdateInvoiceData = {
        amount: typeof data.amount === 'number' ? data.amount.toString() : data.amount,
        invoiceDate: data.invoiceDate,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        description: data.description,
        dueDate: data.dueDate,
        notes: data.notes,
        serviceIds: data.serviceIds,
      }
      return api.updateInvoice(id, commonData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
      setIsEditDialogOpen(false)
      setEditingInvoice(null)
      setEditInvoiceData({})
    },
    onError: (error: any) => {
      showAlert({ message: error.message || 'Failed to update invoice', type: 'error' })
    }
  })

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: api.deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
    },
    onError: (error: any) => {
      showAlert({ message: error.message || 'Failed to delete invoice', type: 'error' })
    }
  })

  const handleAddInvoice = () => {
    createInvoiceMutation.mutate(newInvoiceData)
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setEditInvoiceData({
      amount: parseFloat(invoice.amount),
      invoiceDate: invoice.invoiceDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      description: invoice.description || '',
      dueDate: invoice.dueDate || '',
      notes: invoice.notes || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateInvoice = () => {
    if (editingInvoice) {
      // Clean up the data to avoid sending empty strings for dates
      const cleanedData = { ...editInvoiceData }
      
      // Convert empty strings to undefined for date fields
      if (cleanedData.invoiceDate === '') cleanedData.invoiceDate = undefined
      if (cleanedData.periodStart === '') cleanedData.periodStart = undefined
      if (cleanedData.periodEnd === '') cleanedData.periodEnd = undefined
      if (cleanedData.dueDate === '') cleanedData.dueDate = undefined
      if (cleanedData.paidAt === '') {
        cleanedData.paidAt = undefined
      } else if (cleanedData.paidAt) {
        // Convert YYYY-MM-DD to ISO timestamp for backend
        cleanedData.paidAt = `${cleanedData.paidAt}T12:00:00.000Z`
      }
      
      // Auto-set status to 'paid' if paid date is provided
      if (cleanedData.paidAt && cleanedData.status !== 'paid') {
        cleanedData.status = 'paid'
      }
      
      updateInvoiceMutation.mutate({
        id: editingInvoice.id,
        data: cleanedData
      })
    }
  }

  const handleDeleteInvoice = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice?',
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (confirmed) {
      deleteInvoiceMutation.mutate(id)
    }
  }

  const resetNewInvoiceForm = () => {
    setNewInvoiceData({
      clientId,
      amount: 0,
      invoiceDate: today,
      periodStart: lastMonthStart,
      periodEnd: lastMonthEnd,
      description: '',
      notes: ''
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Invoice history for {clientName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            <p>Failed to load invoices. Please try again later.</p>
            <p className="text-sm text-gray-500 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Invoice history for {clientName}</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Calculator className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice: Invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                        <p className="text-sm text-gray-600">{invoice.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditInvoice(invoice)}
                        title="Edit invoice"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete invoice"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">${parseFloat(invoice.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Invoice: {new Date(invoice.invoiceDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="text-gray-600">
                      Period: {new Date(invoice.periodStart).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} - {new Date(invoice.periodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    {invoice.paidAt ? (
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                        <Calendar className="h-4 w-4" />
                        <span>Paid: {new Date(invoice.paidAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    ) : invoice.dueDate ? (
                      <div className="flex items-center gap-2 text-orange-600">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {new Date(invoice.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    ) : null}
                  </div>
                  
                  {invoice.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      {invoice.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Invoices</h3>
              <p>This client doesn't have any invoices yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Invoice Form */}
      <EnhancedInvoiceForm
        clientId={clientId}
        clientName={clientName}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => {
          // Refresh invoice list
          queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
        }}
      />

      {/* Enhanced Edit Invoice Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice - {editingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Update invoice details and view service breakdown for {clientName}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Invoice Details</TabsTrigger>
              <TabsTrigger value="services">Services & Pricing</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Basic Invoice Details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="editAmount">Amount *</Label>
                  <Input
                    id="editAmount"
                    type="number"
                    step="0.01"
                    value={editInvoiceData.amount || 0}
                    onChange={(e) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      amount: parseFloat(e.target.value) || 0 
                    })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="editInvoiceDate">Invoice Date</Label>
                  <Input
                    id="editInvoiceDate"
                    type="date"
                    value={editInvoiceData.invoiceDate || ''}
                    onChange={(e) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      invoiceDate: e.target.value 
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="editStatus">Status</Label>
                  <Select
                    value={editInvoiceData.status || ''}
                    onValueChange={(value) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      status: value as any 
                    })}
                  >
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editPeriodStart">Period Start</Label>
                  <Input
                    id="editPeriodStart"
                    type="date"
                    value={editInvoiceData.periodStart || ''}
                    onChange={(e) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      periodStart: e.target.value 
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="editPeriodEnd">Period End</Label>
                  <Input
                    id="editPeriodEnd"
                    type="date"
                    value={editInvoiceData.periodEnd || ''}
                    onChange={(e) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      periodEnd: e.target.value 
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editDueDate">Due Date</Label>
                  <Input
                    id="editDueDate"
                    type="date"
                    value={editInvoiceData.dueDate || ''}
                    onChange={(e) => setEditInvoiceData({ 
                      ...editInvoiceData, 
                      dueDate: e.target.value 
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="editPaidDate">Paid Date</Label>
                  <Input
                    id="editPaidDate"
                    type="date"
                    value={editInvoiceData.paidAt || ''}
                    onChange={(e) => {
                      setEditInvoiceData({ 
                        ...editInvoiceData, 
                        paidAt: e.target.value,
                        // Auto-update status based on paid date
                        status: e.target.value ? 'paid' : (editInvoiceData.status === 'paid' ? 'sent' : editInvoiceData.status)
                      })
                    }}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Input
                  id="editDescription"
                  value={editInvoiceData.description || ''}
                  onChange={(e) => setEditInvoiceData({ 
                    ...editInvoiceData, 
                    description: e.target.value 
                  })}
                  placeholder="Services provided..."
                />
              </div>
              
              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  value={editInvoiceData.notes || ''}
                  onChange={(e) => setEditInvoiceData({ 
                    ...editInvoiceData, 
                    notes: e.target.value 
                  })}
                  placeholder="Additional notes..."
                />
              </div>
            </TabsContent>

            <TabsContent value="services" className="space-y-4 mt-4">
              {/* Service Details and Pricing */}
              {serviceOptions?.clientServices && serviceOptions.clientServices.length > 0 ? (
                <>
                  <div className="text-sm text-gray-600 mb-4">
                    Services and pricing breakdown for this invoice period
                  </div>
                  
                  <div className="space-y-4">
                    {serviceOptions.clientServices.map((service: any) => (
                      <div key={service.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Settings className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{service.serviceName}</h4>
                              <p className="text-sm text-gray-600">
                                {service.serviceCategory} • {service.billingModel} billing
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              ${service.serviceLevelPrice ? service.serviceLevelPrice.toLocaleString() : 'Not set'}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {service.developers.length} developers
                            </Badge>
                          </div>
                        </div>
                        
                        {service.developers && service.developers.length > 0 && (
                          <div className="bg-gray-50 rounded p-3">
                            <h5 className="text-sm font-medium mb-2">Assigned Developers:</h5>
                            <div className="space-y-1">
                              {service.developers.map((dev: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span>{dev.developerName}</span>
                                  <span className="text-gray-600">
                                    {dev.hourlyRate ? `$${dev.hourlyRate}/hr` : 
                                     dev.fixedPrice ? `$${dev.fixedPrice} fixed` : 
                                     'Rate not set'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Total Summary */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Invoice Total:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${(editInvoiceData.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Service Details Available</h3>
                  <p>This invoice may have been created with manual pricing or service data is not available.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingInvoice(null)
                setEditInvoiceData({})
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateInvoice}
              disabled={updateInvoiceMutation.isPending}
            >
              {updateInvoiceMutation.isPending ? 'Updating...' : 'Update Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
