import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export function StripeInvoiceButton({ id }: { id: number }) {
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const open = async () => {
    setLoading(true); setError('')
    try {
      const {url} = await api.request(`/invoices/${id}/stripe`)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe is unavailable. Please retry.')
    } finally { setLoading(false) }
  }
  return <div><Button disabled={loading} size="sm" onClick={open}>{loading ? 'Opening…' : 'Open Stripe invoice'}</Button>
    {error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}</div>
}
