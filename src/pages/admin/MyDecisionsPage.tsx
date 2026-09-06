import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { ArrowRightIcon, ReloadIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useWorkflowAccess, useWorkflowUserId, workflowDate } from '@/lib/workflow'

type DecisionKind = 'leave' | 'purchase' | 'feedback'
interface Decision {
  id: string; kind: DecisionKind; entityId: number; title: string; description: string
  status: string; createdAt: string; dueAt: string | null; overdue: boolean
  ownerName: string; href: string; canAct: boolean
}
interface DecisionsResponse { items: Decision[]; owners: { owner: string[]; deputy: string[] }; delivery?: { enabled: boolean; pending: number; failed: number } }
const labels: Record<DecisionKind, string> = { leave: 'Leave', purchase: 'Purchases', feedback: 'Feedback' }

export function MyDecisionsPage() {
  const userId = useWorkflowUserId()
  const access = useWorkflowAccess()
  const [kind, setKind] = useState<'all' | DecisionKind>('all')
  const [scope, setScope] = useState<'all' | 'mine' | 'overdue'>('all')
  const queue = useQuery<DecisionsResponse>({
    queryKey: ['workflowDecisions', userId], queryFn: () => api.request('/workflow/decisions'),
    enabled: !!access.data?.canViewQueue, refetchInterval: 60_000,
  })
  const loading = access.isLoading || (!!access.data?.canViewQueue && queue.isLoading)
  const error = access.error || queue.error
  const items = queue.data?.items ?? []
  const visible = items.filter(item => (kind === 'all' || item.kind === kind)
    && (scope === 'all' || (scope === 'mine' ? item.canAct : item.overdue)))

  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">My decisions</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Leave, purchase requests and client feedback awaiting a decision or follow-up.</p>
      </div>
      <Button variant="outline" size="sm" disabled={loading || queue.isFetching || !access.data?.canViewQueue} onClick={() => void queue.refetch()}><ReloadIcon className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {loading ? <div role="status" aria-label="Loading decisions" className="space-y-4">{[1, 2, 3].map(row => <div key={row} className="h-24 animate-pulse rounded-md bg-muted" />)}</div>
      : error ? <div role="alert" className="space-y-3 rounded-md border p-4"><p className="text-sm">{error instanceof Error ? error.message : 'Decisions could not be loaded.'}</p><Button variant="outline" onClick={() => void (access.error ? access.refetch() : queue.refetch())}>Try again</Button></div>
      : !access.data?.canViewQueue ? <p className="rounded-md border p-5 text-sm text-muted-foreground">This queue is available to the workflow owner and administrative deputy.</p>
      : <>
        {!queue.data?.owners.owner.length && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No workflow owner is configured. Purchase approvals need an assigned owner.</p>}
        {queue.data?.delivery && (!queue.data.delivery.enabled || queue.data.delivery.failed > 0) && <p role="status" className="rounded-md border p-4 text-sm text-muted-foreground">{!queue.data.delivery.enabled ? 'Slack delivery is not configured. Updates are available in HUB.' : `${queue.data.delivery.failed} Slack notifications need attention. HUB notifications remain available.`}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-4 text-sm">
          <span><strong>{items.filter(item => item.canAct).length}</strong> need your action</span>
          <span className={items.some(item => item.overdue) ? 'text-amber-800' : 'text-muted-foreground'}><strong>{items.filter(item => item.overdue).length}</strong> overdue</span>
          <span className="text-muted-foreground">Decisions and first feedback response: one working day · Kyiv time</span>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex flex-wrap gap-1" aria-label="Request type">{(['all', 'leave', 'purchase', 'feedback'] as const).map(value => <Button key={value} variant={kind === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'all' ? 'All types' : labels[value]}</Button>)}</div>
          <div className="flex flex-wrap gap-1" aria-label="Decision scope">{([['all', 'All open'], ['mine', 'My actions'], ['overdue', 'Overdue']] as const).map(([value, label]) => <Button key={value} size="sm" variant={scope === value ? 'secondary' : 'ghost'} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</Button>)}</div>
        </div>
        {!visible.length ? <div className="border-y py-12"><h2 className="font-medium">{items.length ? 'No matching requests' : 'No open decisions'}</h2><p className="mt-2 text-sm text-muted-foreground">{items.length ? 'Choose another filter to see the remaining requests.' : 'New requests and client feedback will appear here.'}</p></div>
          : <ul className="divide-y border-y">{visible.map(item => <li key={item.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_190px_100px] md:items-center">
            <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">{labels[item.kind]}</Badge><span className="text-xs text-muted-foreground">{item.status.replace(/_/g, ' ')}</span>{item.overdue && <Badge className="border-amber-200 bg-amber-50 text-amber-800">Overdue</Badge>}</div><h2 className="break-words font-medium">{item.title}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{item.description}</p></div>
            <div className="text-sm"><p className="font-medium">{item.ownerName || 'Owner not assigned'}</p><p className="mt-1 text-muted-foreground">{item.kind === 'feedback' && !item.dueAt ? 'First response sent' : item.status === 'awaiting_receipt' ? 'Waiting for the employee’s receipt' : item.status === 'awaiting_payment' ? 'Ready for payment' : `${item.kind === 'feedback' ? 'First response' : 'Decision'}: ${workflowDate(item.dueAt)}`}</p>{!item.canAct && <p className="mt-1 text-xs text-muted-foreground">Handled by the assigned owner</p>}</div>
            <Link href={item.href} className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${item.title}`}>Open request<ArrowRightIcon className="h-4 w-4 shrink-0" /></Link>
          </li>)}</ul>}
        <div className="space-y-1 text-xs text-muted-foreground"><p>Owner: {queue.data?.owners.owner.join(', ') || 'Not configured'}</p><p>Administrative deputy: {queue.data?.owners.deputy.join(', ') || 'Not configured'}</p></div>
      </>}
  </div>
}
