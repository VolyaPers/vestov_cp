import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export interface FeedbackEntry {
  id: number
  rating: number
  comments: string
  feedbackType: string
  status: 'pending' | 'in_progress' | 'awaiting_client' | 'resolved'
  createdAt: string
  firstResponseDueAt: string
  firstRespondedAt: string | null
  firstResponseOverdue: boolean
  resolvedAt: string | null
  client: { id: number; name: string } | null
  service: { id: number; serviceTitle: string } | null
  teamMember: { id: number; fullName: string } | null
  submittedBy: { id: number; fullName: string }
  nextMessageCursor: number | null
  messages: Array<{
    id: number | string
    body: string
    kind: string
    createdAt: string
    isClient: boolean
    historical?: boolean
    author: { id: number; fullName: string }
  }>
}

export const feedbackStatusLabels: Record<FeedbackEntry['status'], string> = {
  pending: 'Awaiting first response', in_progress: 'In progress', awaiting_client: 'Awaiting client confirmation', resolved: 'Resolved by client',
}

export const feedbackDate = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

export function FeedbackThread({ feedback, children, showClient = false, selected = false }: { feedback: FeedbackEntry; children?: ReactNode; showClient?: boolean; selected?: boolean }) {
  const [messages, setMessages] = useState(feedback.messages || [])
  const [cursor, setCursor] = useState(feedback.nextMessageCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setMessages(feedback.messages || []); setCursor(feedback.nextMessageCursor); setError('') }, [feedback])
  const loadEarlier = async () => {
    if (!cursor || loading) return
    setLoading(true); setError('')
    try {
      const data: FeedbackEntry = await api.request(`/feedback/${feedback.id}/thread?beforeMessage=${cursor}`)
      setMessages(current => [...new Map([...data.messages, ...current].map(message => [message.id, message])).values()])
      setCursor(data.nextMessageCursor)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load earlier replies') }
    finally { setLoading(false) }
  }
  return <article id={`feedback-${feedback.id}`} className={`scroll-mt-24 rounded-lg border bg-white p-4 sm:p-5 ${selected ? 'ring-2 ring-primary/25' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{showClient && feedback.client ? `${feedback.client.name} · ` : ''}{feedback.service?.serviceTitle || 'General feedback'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{feedback.teamMember ? `${feedback.teamMember.fullName} · ` : ''}{feedback.rating}/5 · {feedbackDate(feedback.createdAt)}</p>
        {showClient && <p className="mt-1 text-sm text-muted-foreground">From {feedback.submittedBy.fullName}</p>}
      </div>
      <Badge variant={feedback.status === 'resolved' ? 'default' : 'secondary'}>{feedbackStatusLabels[feedback.status] || feedback.status}</Badge>
    </div>
    {!feedback.firstRespondedAt && <p className={`mt-3 text-sm ${feedback.firstResponseOverdue ? 'font-medium text-red-700' : 'text-muted-foreground'}`}>
      {feedback.firstResponseOverdue ? 'First response overdue' : 'First response due'} · {feedbackDate(feedback.firstResponseDueAt)}
    </p>}
    <div className="mt-4 space-y-4">
      <div className="rounded-md bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">{showClient ? feedback.submittedBy.fullName : 'You'} · Original feedback</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{feedback.comments}</p>
      </div>
      {cursor && <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadEarlier()}>{loading ? 'Loading…' : 'Load earlier replies'}</Button>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {messages.map(message => <div key={message.id} className={`border-l-2 pl-3 ${message.isClient ? 'border-border' : 'border-primary/50'}`}>
        <p className="text-xs text-muted-foreground">{message.isClient ? showClient ? message.author.fullName : 'You' : message.author.fullName || 'Vestov team'} · {feedbackDate(message.createdAt)}{message.historical ? ' · Previous response' : ''}</p>
        {message.kind === 'resolution_requested' && <p className="mt-1 text-xs font-medium">Resolution proposed · awaiting client confirmation</p>}
        {message.kind === 'reopened' && <p className="mt-1 text-xs font-medium">Reopened by client</p>}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
      </div>)}
    </div>
    {feedback.resolvedAt && <p className="mt-4 text-sm text-muted-foreground">Resolution confirmed {feedbackDate(feedback.resolvedAt)}</p>}
    {children && <div className="mt-5 border-t pt-4">{children}</div>}
  </article>
}
