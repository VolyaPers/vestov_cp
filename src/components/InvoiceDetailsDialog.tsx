import { PublishStripeInvoice } from './PublishStripeInvoice'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export function InvoiceDetailsDialog({invoiceId,onClose,onUpdated}:{invoiceId:number|null;onClose:()=>void;onUpdated?:()=>void}) {
  const {data:invoice,isLoading,error,refetch}=useQuery({queryKey:['invoice',invoiceId],queryFn:()=>api.getInvoice(invoiceId!),enabled:invoiceId!==null})
  return <Dialog open={invoiceId!==null} onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{invoice?.invoiceNumber || 'Invoice details'}</DialogTitle><DialogDescription>Saved invoice and payment details</DialogDescription></DialogHeader>{isLoading?<p>Loading invoice…</p>:error?<p role="alert">Unable to load invoice details. <Button onClick={()=>refetch()}>Retry</Button></p>:invoice&&<div className="space-y-4">
    <div className="text-2xl font-semibold">${Number(invoice.amount).toFixed(2)} <Badge>{invoice.status}</Badge></div>
    <p>Period: {invoice.periodStart} – {invoice.periodEnd}</p><p>Due: {invoice.dueDate || 'Not set'} · Paid: {invoice.paidAt?.slice(0,10) || 'Not recorded'}</p>
    {invoice.description&&<p>{invoice.description}</p>}
    {(invoice.services||[]).map(service=><div key={service.id} className="rounded border p-3"><p className="font-medium">{service.serviceName}: ${Number(service.calculatedAmount).toFixed(2)}</p>{service.serviceLevelPrice!=null&&<p className="text-xs text-gray-500">Service subtotal overrides developer total.</p>}{(service.developers||[]).map(dev=><p className="text-sm" key={dev.id}>{dev.developerName}: ${Number(dev.calculatedAmount).toFixed(2)}{dev.hoursWorked!=null?` (${dev.hoursWorked} hours × $${dev.hourlyRate})`:' fixed'}</p>)}</div>)}
    {invoice.status !== 'cancelled' && <PublishStripeInvoice key={invoice.id} invoiceId={invoice.id} stripeId={invoice.stripeInvoiceId} onSaved={()=>{refetch();onUpdated?.()}}/>}
    {invoice.notes&&<p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>}
  </div>}</DialogContent></Dialog>
}
