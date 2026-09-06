import { createContext, useContext, useEffect, useState } from 'react'
import type { Client } from '@/types/common'
import { api } from '@/lib/api'

export const ClientWorkspaceContext = createContext<{ client: Client | null }>({ client: null })
export function useClientWorkspace() {
  const { client } = useContext(ClientWorkspaceContext)
  return { client, clientId: client?.id }
}

export function isCurrentAssignment(record: { isActive?: boolean; startDate?: string | null; endDate?: string | null }, date = new Date().toISOString().slice(0, 10)) {
  return record.isActive !== false && (!record.startDate || record.startDate <= date) && (!record.endDate || record.endDate >= date)
}

export function ClientLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
    <p>{message}</p><button type="button" className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-medium" onClick={onRetry}>Retry</button>
  </div>
}

export function useClientDocumentPreview(documentId: number | undefined, open: boolean) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    setUrl(''); setError('')
    if (!open || !documentId) return
    let active = true
    let objectUrl = ''
    api.requestBinary(`/documents/preview/${documentId}`).then(blob => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => { if (active) setError('Unable to preview this document.') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [documentId, open, retry])
  return { url, error, retry: () => setRetry(value => value + 1) }
}
