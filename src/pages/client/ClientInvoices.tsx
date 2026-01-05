import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { DollarSign, Calendar, FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

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
  const [totals, setTotals] = useState<{
    totalAmount: number
    paidAmount: number
    pendingAmount: number
    overdueAmount: number
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg">
          <DollarSign className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Your billing history and payment information</p>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Billed</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.paidAmount)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.pendingAmount)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.overdueAmount)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices List */}
      {invoices.length > 0 ? (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow" data-testid="invoice-item">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-2 bg-gray-100 rounded">
                      <FileText className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
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
                        <p className="text-sm text-gray-600 mt-2">{invoice.description}</p>
                      )}
                      {invoice.paidAt && (
                        <p className="text-sm text-green-600 mt-2">
                          Paid on {new Date(invoice.paidAt).toLocaleDateString()}
                        </p>
                      )}
                      {invoice.notes && (
                        <p className="text-sm text-gray-500 mt-2 italic">"{invoice.notes}"</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                      title="View invoice details"
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
            <DollarSign className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
            <p className="text-gray-600">Your billing information will appear here when invoices are generated.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}