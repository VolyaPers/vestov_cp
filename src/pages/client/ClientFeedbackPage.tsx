import { useEffect, useRef, useState } from 'react'
import { useSearch } from 'wouter'
import { MessageSquare, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { useClientWorkspace, ClientLoadError } from '@/lib/clientWorkspace'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, PageHero } from '@/components/page-primitives'
import { FeedbackThread, type FeedbackEntry } from '@/components/FeedbackThread'

interface Service { id: number; serviceTitle: string }
interface TeamMember { id: number; fullName: string; role: string }

export function ClientFeedbackPage() {
  const { clientId } = useClientWorkspace()
  const { showAlert } = useCustomAlert()
  const [canWrite, setCanWrite] = useState(false)
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamRetry, setTeamRetry] = useState(0)
  const [serviceId, setServiceId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | 'new' | null>(null)
  const [refresh, setRefresh] = useState(0)
  const workspace = useRef(clientId)
  workspace.current = clientId
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const query = useSearch()
  const selectedId = Number(new URLSearchParams(query).get('feedback'))

  useEffect(() => {
    setServiceId(''); setMemberId(''); setRating(0); setComments(''); setDrafts({}); setFeedbacks([]); setServices([])
  }, [clientId])
  useEffect(() => {
    if (!clientId) return
    let active = true
    setLoading(true); setError('')
    Promise.all([api.getClientFeedbacks(clientId), api.getFeedbackClientServices(clientId)]).then(async ([threads, available]) => {
      if (selectedId && !threads.feedbacks.some((item: FeedbackEntry) => item.id === selectedId)) {
        const selected = await api.request(`/feedback/${selectedId}/thread`)
        if (selected.client?.id === clientId) threads.feedbacks.unshift(selected)
      }
      if (active) { setFeedbacks(threads.feedbacks); setServices(available.services); setNextCursor(threads.nextCursor); setCanWrite(threads.canReply === true) }
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load feedback') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId, refresh, selectedId])
  useEffect(() => {
    let active = true
    setMemberId(''); setMembers([]); setTeamError(''); setTeamLoading(false)
    if (serviceId) {
      setTeamLoading(true)
      api.getFeedbackServiceDevelopers(Number(serviceId)).then(data => { if (active) setMembers(data.developers) })
        .catch(() => { if (active) setTeamError('Unable to load the project team.') })
        .finally(() => { if (active) setTeamLoading(false) })
    }
    return () => { active = false }
  }, [serviceId, teamRetry])
  useEffect(() => {
    if (!loading && selectedId) document.getElementById(`feedback-${selectedId}`)?.scrollIntoView({ block: 'start' })
  }, [loading, selectedId])

  const loadMore = async () => {
    if (!clientId || !nextCursor || loadingMore) return
    const requestedWorkspace = clientId
    setLoadingMore(true)
    try {
      const data = await api.request(`/feedback/client?clientId=${clientId}&before=${nextCursor}`)
      if (workspace.current === requestedWorkspace) {
        setFeedbacks(current => [...new Map([...current, ...data.feedbacks].map(item => [item.id, item])).values()])
        setNextCursor(data.nextCursor)
      }
    } catch (error) { showAlert({ message: error instanceof Error ? error.message : 'Unable to load older conversations', type: 'error' }) }
    finally { setLoadingMore(false) }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy !== null || !clientId || !rating || !comments.trim()) return
    const submittedWorkspace = clientId
    setBusy('new')
    try {
      await api.submitFeedback({ clientId, clientServiceId: serviceId ? Number(serviceId) : undefined, teamMemberId: memberId ? Number(memberId) : undefined, rating, comments: comments.trim(), feedbackType: memberId ? 'team_member' : serviceId ? 'team' : 'general' })
      if (workspace.current === submittedWorkspace) { setComments(''); setRating(0); setServiceId(''); setMemberId(''); setRefresh(value => value + 1) }
      showAlert({ message: 'Feedback sent. Your first reply is due within one working day.', type: 'success' })
    } catch (error) { showAlert({ message: error instanceof Error ? error.message : 'Unable to send feedback', type: 'error' }) }
    finally { setBusy(null) }
  }
  const act = async (item: FeedbackEntry, action: 'reply' | 'confirm' | 'reopen') => {
    if (busy !== null || action !== 'confirm' && !drafts[item.id]?.trim()) return
    const submittedWorkspace = clientId
    setBusy(item.id)
    try {
      await api.request(`/feedback/${item.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'confirm' ? {} : { body: drafts[item.id].trim() }) })
      if (workspace.current === submittedWorkspace) { setDrafts(previous => ({ ...previous, [item.id]: '' })); setRefresh(value => value + 1) }
      showAlert({ message: action === 'confirm' ? 'Resolution confirmed. You can reopen this thread if needed.' : action === 'reopen' ? 'Thread reopened. Your message was sent to Volodymyr.' : 'Reply sent.', type: 'success' })
    } catch (error) { showAlert({ message: error instanceof Error ? error.message : 'Unable to update feedback', type: 'error' }) }
    finally { setBusy(null) }
  }

  if (loading) return <p role="status" className="p-6">Loading your feedback…</p>
  if (error) return <ClientLoadError message={error} onRetry={() => setRefresh(value => value + 1)} />
  return <div className="space-y-6">
    <PageHero eyebrow="Feedback" title="Your feedback" description="Share feedback, follow the conversation and confirm when the issue is resolved." meta={<span>{feedbacks.filter(item => item.status !== 'resolved').length} open in loaded conversations · {feedbacks.filter(item => item.status === 'awaiting_client').length} awaiting your confirmation</span>} />
    <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-6">Your feedback and replies are private to you and the Vestov management team. Other users at your company cannot read this conversation. We respond within one working day; working days are Monday–Friday in Europe/Kyiv.</p>
    {!canWrite && <p className="rounded-lg border p-4 text-sm">This is a read-only preview. Exit user preview to reply as yourself. Only the client author can confirm resolution.</p>}
    {canWrite && <Card><CardContent className="p-4 sm:p-6">
      <h2 className="mb-4 font-semibold">New feedback</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="feedback-project">Project</Label><select id="feedback-project" value={serviceId} onChange={event => setServiceId(event.target.value)} disabled={busy !== null} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">General feedback</option>{services.map(service => <option key={service.id} value={service.id}>{service.serviceTitle}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="feedback-member">Team member</Label><select id="feedback-member" value={memberId} onChange={event => setMemberId(event.target.value)} disabled={!serviceId || teamLoading || !!teamError || busy !== null} className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:text-muted-foreground"><option value="">{teamLoading ? 'Loading team…' : serviceId ? 'Whole project team' : 'Select a project first'}</option>{members.map(member => <option key={member.id} value={member.id}>{member.fullName}{member.role ? ` · ${member.role}` : ''}</option>)}</select></div>
        </div>
        {teamError && <ClientLoadError message={teamError} onRetry={() => setTeamRetry(value => value + 1)} />}
        <fieldset><legend className="mb-2 text-sm font-medium">Rating</legend><div className="flex items-center gap-2">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" aria-label={`Rate ${star} out of 5`} aria-pressed={rating === star} onClick={() => setRating(star)} disabled={busy !== null} className="rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Star className={`h-6 w-6 ${star <= rating ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'}`} /></button>)}<span className="text-sm text-muted-foreground">{rating ? `${rating}/5` : 'Choose a rating'}</span></div></fieldset>
        <div className="space-y-2"><Label htmlFor="feedback-comments">Your feedback</Label><Textarea id="feedback-comments" value={comments} onChange={event => setComments(event.target.value)} maxLength={10000} rows={4} disabled={busy !== null} placeholder="What is working well, or what needs to change?" /></div>
        <Button type="submit" disabled={busy !== null || !rating || !comments.trim() || teamLoading || !!teamError}>{busy === 'new' ? 'Sending…' : 'Submit feedback'}</Button>
      </form>
    </CardContent></Card>}
    <div className="space-y-4"><h2 className="font-semibold">Your conversations</h2>
      {!feedbacks.length && <EmptyState title="No feedback yet" description="Use the form above to start a private conversation." icon={<MessageSquare className="h-5 w-5" />} />}
      {feedbacks.map(item => <FeedbackThread key={item.id} feedback={item} selected={selectedId === item.id}>
        {canWrite && item.status === 'awaiting_client' && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/30 p-3"><p className="text-sm">Has the proposed solution resolved the issue?</p><Button onClick={() => void act(item, 'confirm')} disabled={busy !== null}>Confirm resolution</Button></div>}
        {canWrite && <form onSubmit={event => { event.preventDefault(); void act(item, item.status === 'resolved' ? 'reopen' : 'reply') }} className="space-y-3">
          <Label htmlFor={`reply-${item.id}`}>{item.status === 'resolved' ? 'Describe why you are reopening this thread' : item.status === 'awaiting_client' ? 'Or reply if more work is needed' : 'Your reply'}</Label>
          <Textarea id={`reply-${item.id}`} rows={3} maxLength={10000} value={drafts[item.id] || ''} onChange={event => setDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} disabled={busy !== null} />
          <Button type="submit" variant="outline" disabled={busy !== null || !drafts[item.id]?.trim()}>{busy === item.id ? 'Saving…' : item.status === 'resolved' ? 'Reopen thread' : 'Send reply'}</Button>
        </form>}
      </FeedbackThread>)}
      {nextCursor && <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load older conversations'}</Button>}
    </div>
  </div>
}
