import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { DollarSign, Calendar, FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { EmptyState, MetricTile, PageHero } from '@/components/page-primitives'

interface Invoice {
  id: number
  invoiceNumber: string
  amount: number
  invoiceDate: string
  periodStart: string
  periodEnd: string
  description?: string
  status: string
  dueDate?: string
  paidAt?: string
  notes?: string
}

export function ClientInvoices() {
  const [, params] = useRoute('/client/invoices/:clientId')
  if (!hasRouteParam(params, 'clientId')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'clientId')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [totals, setTotals] = useState<{
    totalAmount?: number
    totalInvoiced?: number
    paidAmount?: number
    totalPaid?: number
    pendingAmount?: number
    overdueAmount?: number
  } | null>(null)

  useEffect(() => {
    const loadInvoices = async () => {
      if (!clientId) return

      try {
        // Load invoices
        const invoicesResponse = await api.request(`/invoices/client/${clientId}`)
        setInvoices(invoicesResponse)

        // Load totals
        const totalsResponse = await api.getClientInvoiceTotals(parseInt(clientId))
        setTotals(totalsResponse)
      } catch (error) {
        console.error('Failed to load invoices:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInvoices()
  }, [clientId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Billing"
        title="Invoices and payment status, redesigned for clarity."
        description="This client billing area now follows the same visual language as the rest of the portal, with cleaner summary tiles and better invoice readability."
        theme="ocean"
        meta={
          <>
            <span>{invoices.length} invoices available</span>
            <span className="h-1 w-1 rounded-full bg-slate-400"></span>
            <span>{formatCurrency(totals?.pendingAmount || 0)} pending</span>
          </>
        }
      />

      {totals && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricTile label="Total Billed" value={formatCurrency(totals.totalAmount || totals.totalInvoiced || 0)} hint="Total generated invoice value" icon={<DollarSign className="h-5 w-5" />} tone="primary" />
          <MetricTile label="Paid" value={formatCurrency(totals.paidAmount || totals.totalPaid || 0)} hint="Settled invoices" icon={<DollarSign className="h-5 w-5" />} tone="emerald" />
          <MetricTile label="Pending" value={formatCurrency(totals.pendingAmount || 0)} hint="Open balance awaiting payment" icon={<DollarSign className="h-5 w-5" />} tone="amber" />
          <MetricTile label="Overdue" value={formatCurrency(totals.overdueAmount || 0)} hint="Requires attention" icon={<DollarSign className="h-5 w-5" />} tone="rose" />
        </div>
      )}

      {invoices.length > 0 ? (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow" data-testid="invoice-item">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="rounded-[0.95rem] bg-muted/70 p-2">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-foreground">{invoice.invoiceNumber}</h3>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Issued: {new Date(invoice.invoiceDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Period: {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}</span>
                        </div>
                        {invoice.dueDate && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      {invoice.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{invoice.description}</p>
                      )}
                      {invoice.paidAt && (
                        <p className="mt-2 text-sm text-green-600">
                          Paid on {new Date(invoice.paidAt).toLocaleDateString()}
                        </p>
                      )}
                      {invoice.notes && (
                        <p className="mt-2 text-sm italic text-muted-foreground">"{invoice.notes}"</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-4">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                      title="View invoice details"
                      onClick={() => setViewInvoice(invoice)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <EmptyState
              icon={<DollarSign className="h-6 w-6" />}
              title="No invoices yet"
              description="Your billing information will appear here when invoices are generated."
            />
          </CardContent>
        </Card>
      )}

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
              <div className="flex items-center justify-between rounded-[1.2rem] bg-muted/55 p-4">
                <div>
                  <div className="text-2xl font-bold">{viewInvoice.invoiceNumber}</div>
                  <Badge className={`mt-1 ${getStatusColor(viewInvoice.status)}`}>
                    {viewInvoice.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(viewInvoice.amount)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Invoice Date</label>
                    <div className="text-sm text-gray-900">{new Date(viewInvoice.invoiceDate).toLocaleDateString()}</div>
                  </div>
                  {viewInvoice.dueDate && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Due Date</label>
                      <div className="text-sm text-gray-900">{new Date(viewInvoice.dueDate).toLocaleDateString()}</div>
                    </div>
                  )}
                  {viewInvoice.paidAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Paid Date</label>
                      <div className="text-sm text-gray-900">{new Date(viewInvoice.paidAt).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {viewInvoice.periodStart && viewInvoice.periodEnd && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Service Period</label>
                      <div className="text-sm text-gray-900">
                        {new Date(viewInvoice.periodStart).toLocaleDateString()} - {new Date(viewInvoice.periodEnd).toLocaleDateString()}
                      </div>
                    </div>
                  )}
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
    </div>
  )
}
