import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export function PublishStripeInvoice({ invoiceId, stripeId, onSaved }: {invoiceId: number; stripeId?: string | null; onSaved: () => void}) {
  const [input,setInput] = useState('')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  return <form className="grid gap-2 rounded-lg border p-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      await api.request(`/invoices/${invoiceId}/stripe`, {method:'POST',body:JSON.stringify({stripeInvoiceId:stripeId || input.trim()})})
      onSaved(); setMessage('Invoice and payment balance updated.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update the invoice. Please retry.') }
    finally { setBusy(false) }
  }}>
    <label className="text-sm font-semibold" htmlFor="stripe-invoice-id">Stripe invoice</label>
    <p className="text-sm text-muted-foreground">Publish a finalized Stripe invoice to this client’s cabinet. Its currency, total and client must match.</p>
    <input id="stripe-invoice-id" className="rounded border p-2" value={stripeId || input} readOnly={!!stripeId} required pattern="in_[A-Za-z0-9]{1,128}" placeholder="in_…" onChange={event => setInput(event.target.value)}/>
    <Button type="submit" disabled={busy} className="justify-self-start">{busy ? 'Checking Stripe…' : stripeId ? 'Refresh from Stripe' : 'Publish to client'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>
}
