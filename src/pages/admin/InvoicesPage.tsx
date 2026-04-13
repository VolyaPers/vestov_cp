import { useState, useEffect } from 'react'
import { Building, DollarSign, TrendingUp, Calendar, Eye, Receipt } from 'lucide-react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { getDatePreset, getPresetLabel, type DatePreset } from '@/lib/datePresets'
import { EmptyState, MetricTile, PageHero } from '@/components/page-primitives'

interface Invoice {
  id: number
  clientId: number
  clientName: string
  clientLogoUrl?: string
  invoiceNumber: string
  amount: string
  invoiceDate: string
  periodStart: string
  periodEnd: string
  description?: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  dueDate?: string
  paidAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function InvoicesPage() {
  const [, setLocation] = useLocation()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
  })

  useEffect(() => {
    loadInvoices()
  }, [dateRange])

  const loadInvoices = async () => {
    try {
      setInvoicesLoading(true)
      const response = await api.getAllInvoices({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      setInvoices(response)
    } catch (error) {
      console.error('Failed to load invoices:', error)
    } finally {
      setInvoicesLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Invoice Management"
        title="Billing visibility with cleaner controls and stronger signal."
        description="The invoices workspace now follows the same advanced shell with sharper filters, cleaner totals and less visual noise around the table."
        theme="ocean"
        meta={
          <>
            <span>{invoices.length} invoices loaded</span>
            <span className="h-1 w-1 rounded-full bg-slate-400"></span>
            <span>{dateRange.startDate} to {dateRange.endDate}</span>
          </>
        }
        aside={
          <div className="rounded-[1.3rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-slate-300">Quick ranges</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'allTime'] as DatePreset[]).map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const range = getDatePreset(preset)
                    setDateRange(range)
                  }}
                  className="border-white/15 bg-white/10 text-white hover:bg-white hover:text-slate-950"
                >
                  {getPresetLabel(preset)}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile
            label="Total Invoiced"
            value={`$${invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toLocaleString()}`}
            hint="Gross amount across current filter"
            icon={<DollarSign className="h-5 w-5" />}
            tone="primary"
            className="bg-white/10 border-white/12 text-white [&_p]:text-current"
          />
          <MetricTile
            label="Total Paid"
            value={`$${invoices.filter(inv => inv.paidAt).reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toLocaleString()}`}
            hint="Settled invoice value"
            icon={<TrendingUp className="h-5 w-5" />}
            tone="emerald"
            className="bg-white/10 border-white/12 text-white [&_p]:text-current"
          />
          <MetricTile
            label="Outstanding"
            value={`$${(invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0) - invoices.filter(inv => inv.paidAt).reduce((sum, inv) => sum + parseFloat(inv.amount), 0)).toLocaleString()}`}
            hint="Unpaid balance in range"
            icon={<Receipt className="h-5 w-5" />}
            tone="amber"
            className="bg-white/10 border-white/12 text-white [&_p]:text-current"
          />
        </div>
      </PageHero>

      <Card className="border-white/80 bg-white/82">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="startDate" className="text-sm whitespace-nowrap text-muted-foreground">From</Label>
            <Input
              id="startDate"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-44"
            />
            <Label htmlFor="endDate" className="text-sm whitespace-nowrap text-muted-foreground">To</Label>
            <Input
              id="endDate"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-44"
            />
            <Badge variant="outline" className="ml-auto border-primary/20 bg-primary/10 text-primary">
              Range active
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/80 bg-white/82">
        <CardContent className="p-6">
          {invoicesLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 font-medium text-muted-foreground">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="h-6 w-6" />}
              title="No invoices found"
              description="Try expanding the date range or switching to a broader preset."
            />
          ) : (
            <div className="overflow-x-auto rounded-[1.3rem] border border-border/70 bg-white/70 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.55)]">
              <table className="w-full">
                <thead className="bg-muted/70 border-b border-border/70">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Invoice #</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Client</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Date</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Period</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Amount</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-white/70">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="transition-colors hover:bg-primary/5">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{invoice.invoiceNumber}</td>
                      <td 
                        className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:bg-primary/5"
                        onClick={() => setLocation(`/admin/clients/${invoice.clientId}`)}
                      >
                        <div className="flex items-center gap-2">
                          {invoice.clientLogoUrl ? (
                            <img 
                              src={invoice.clientLogoUrl} 
                              alt={invoice.clientName}
                              className="h-6 w-6 object-contain rounded"
                            />
                          ) : (
                            <Building className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="hover:text-blue-600 hover:underline font-medium">
                            {invoice.clientName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(invoice.invoiceDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(invoice.periodStart).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} - {new Date(invoice.periodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        ${parseFloat(invoice.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          className={
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : invoice.status === 'sent'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/admin/clients/${invoice.clientId}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
