import { useEffect, useState } from 'react'
import { useSearch } from 'wouter'
import { MessageSquare } from 'lucide-react'
import { api } from '@/lib/api'
import { ClientLoadError } from '@/lib/clientWorkspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, PageHero } from '@/components/page-primitives'
import { FeedbackThread, feedbackStatusLabels, type FeedbackEntry } from '@/components/FeedbackThread'

export function AdminFeedbackPage() {
  const { showAlert } = useCustomAlert()
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('open')
  const [clientFilter, setClientFilter] = useState('all')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [confirmation, setConfirmation] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const query = useSearch()
  const selectedId = Number(new URLSearchParams(query).get('feedback'))

  const load = async () => {
    try {
      setError('')
      const data = await api.getAdminFeedbacks()
      if (selectedId && !data.feedbacks.some((item: FeedbackEntry) => item.id === selectedId)) {
        const selected = await api.request(`/feedback/${selectedId}/thread`)
        data.feedbacks.unshift(selected)
      }
      setFeedbacks(data.feedbacks)
      setNextCursor(data.nextCursor)
      setCanManage(data.canManageFeedback === true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load feedback') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [selectedId])
  useEffect(() => {
    if (selectedId && feedbacks.some(item => item.id === selectedId)) {
      setStatus('all')
      requestAnimationFrame(() => document.getElementById(`feedback-${selectedId}`)?.scrollIntoView({ block: 'start' }))
    }
  }, [feedbacks, selectedId])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await api.request(`/feedback/admin?before=${nextCursor}`)
      setFeedbacks(current => [...new Map([...current, ...data.feedbacks].map(item => [item.id, item])).values()])
      setNextCursor(data.nextCursor)
    } catch (error) { showAlert({ message: error instanceof Error ? error.message : 'Unable to load older threads', type: 'error' }) }
    finally { setLoadingMore(false) }
  }

  const respond = async (item: FeedbackEntry) => {
    if (saving !== null || !drafts[item.id]?.trim()) return
    setSaving(item.id)
    try {
      await api.request(`/feedback/${item.id}/respond`, { method: 'POST', body: JSON.stringify({ adminResponse: drafts[item.id].trim(), requestConfirmation: confirmation[item.id] === true }) })
      setDrafts(previous => ({ ...previous, [item.id]: '' }))
      setConfirmation(previous => ({ ...previous, [item.id]: false }))
      await load()
      showAlert({ message: 'Reply sent to the client author.', type: 'success' })
    } catch (error) { showAlert({ message: error instanceof Error ? error.message : 'Unable to send reply', type: 'error' }) }
    finally { setSaving(null) }
  }

  if (loading) return <p role="status" className="p-6">Loading feedback…</p>
  if (error) return <ClientLoadError message={error} onRetry={load} />
  const clients = [...new Map(feedbacks.filter(item => item.client).map(item => [item.client!.id, item.client!])).values()]
  const visible = feedbacks.filter(item => (status === 'all' || status === 'open' && item.status !== 'resolved' || item.status === status)
    && (clientFilter === 'all' || String(item.client?.id) === clientFilter)
    && [item.comments, item.client?.name, item.service?.serviceTitle, item.teamMember?.fullName, item.submittedBy.fullName, ...item.messages.map(message => message.body)].some(value => value?.toLowerCase().includes(search.toLowerCase())))
  const overdue = feedbacks.filter(item => item.firstResponseOverdue).length

  return <div className="space-y-6">
    <PageHero eyebrow="Feedback" title="Client feedback" description="Reply within one working day. The client confirms when the issue is resolved." meta={<span>{feedbacks.filter(item => item.status !== 'resolved').length} open in loaded conversations · {overdue} first responses overdue</span>} />
    {!canManage && <p className="rounded-lg border bg-muted/30 p-4 text-sm">You can review the queue. Client replies and decisions are handled by Volodymyr.</p>}
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
      <Input aria-label="Search feedback" placeholder="Search feedback, client or teammate…" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Feedback status" value={status} onChange={event => setStatus(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        <option value="open">Open threads</option><option value="all">All threads</option>
        {Object.entries(feedbackStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Client" value={clientFilter} onChange={event => setClientFilter(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        <option value="all">All clients</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
    </div>
    {!visible.length && <EmptyState title="No feedback found" description="No threads match the current filters." icon={<MessageSquare className="h-5 w-5" />} />}
    <div className="space-y-4">{visible.map(item => <FeedbackThread key={item.id} feedback={item} showClient selected={selectedId === item.id}>
      {canManage && item.status !== 'resolved' ? <form onSubmit={event => { event.preventDefault(); void respond(item) }} className="space-y-3">
        <Label htmlFor={`response-${item.id}`}>Reply to {item.submittedBy.fullName}</Label>
        <Textarea id={`response-${item.id}`} maxLength={10000} rows={3} value={drafts[item.id] || ''} onChange={event => setDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder="Acknowledge the issue, explain the next step or propose a resolution." disabled={saving !== null} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmation[item.id] || false} disabled={saving !== null} onChange={event => setConfirmation(previous => ({ ...previous, [item.id]: event.target.checked }))} />Ask the client to confirm resolution</label>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Only the client author can read and confirm this reply in their workspace.</p><Button type="submit" disabled={saving !== null || !drafts[item.id]?.trim()}>{saving === item.id ? 'Sending…' : confirmation[item.id] ? 'Propose resolution' : 'Send reply'}</Button></div>
      </form> : <p className="text-sm text-muted-foreground">{item.status === 'resolved' ? 'The client has confirmed resolution. They can reopen the thread if the issue returns.' : 'Client decisions are assigned to Volodymyr.'}</p>}
    </FeedbackThread>)}</div>
    {nextCursor && <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load older conversations'}</Button>}
  </div>
}
