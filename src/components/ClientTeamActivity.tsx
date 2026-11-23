import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, RefreshCw, Palmtree } from 'lucide-react'
import { Link } from 'wouter'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Member = {
  id: number; name: string; position: string; projects: string[]
  leave: { label: string; halfDay: boolean } | null
  taskState: string
  tasks: { id: string; name: string; url: string; project: string }[]
}
type Activity = { updatedAt: string; members: Member[] }
const sourceMessage: Record<string, string> = {
  disconnected: 'ClickUp is not connected yet.',
  unmapped: 'ClickUp account is not linked yet.',
  unavailable: 'Some project tasks are unavailable. Please refresh.',
}

export function ClientTeamActivity({ clientId }: { clientId: number }) {
  const query = useQuery({ queryKey: ['clientTeamActivity', clientId], queryFn: () => api.getClientTeamActivity(clientId) as Promise<Activity>, staleTime: 30_000, refetchInterval: 60_000 })
  const members = query.data?.members || []
  return <section aria-labelledby="team-now-title" className="overflow-hidden rounded-2xl border bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
      <div><h2 id="team-now-title" className="text-2xl font-bold tracking-tight">Your team, right now</h2>
        <p className="mt-1 text-sm text-muted-foreground">What each person is working on · In Progress tasks from ClickUp</p>
        {query.data && <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(query.data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Refreshes every minute</p>}
      </div>
      <div className="flex items-center gap-2"><Link href="/client/team-status"><Button variant="ghost">Team calendar <ArrowUpRight className="ml-2 h-4 w-4" /></Button></Link>
        <Button variant="outline" size="icon" aria-label="Refresh team activity" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button></div>
    </div>
    {query.isLoading ? <p role="status" className="p-7 text-muted-foreground">Loading your team and current tasks…</p>
      : query.isError ? <div role="alert" className="p-7"><p>Team activity could not be refreshed.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
      : !members.length ? <p className="p-7 text-muted-foreground">No team members are assigned today.</p>
      : <ul className="divide-y">{members.map(member => {
        const away = Boolean(member.leave)
        const working = !away && member.tasks.length > 0
        return <li key={member.id} className="grid gap-4 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(220px,1fr)_2fr]">
          <div className="flex items-start gap-3">
            <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600">{member.name.split(/\s+/).map(word => word[0]).slice(0, 2).join('')}</div>
            <div className="min-w-0"><h3 className="text-lg font-semibold">{member.name}</h3><p className="text-sm text-muted-foreground">{member.position}</p><p className="mt-1 text-xs text-muted-foreground">{member.projects.join(' · ')}</p></div>
          </div>
          <div className="min-w-0">
            <p className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${away ? 'bg-amber-50 text-amber-900' : working ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              {away ? <Palmtree className="h-4 w-4" /> : <span aria-hidden="true" className={`h-2 w-2 rounded-full ${working ? 'bg-emerald-600' : 'bg-slate-400'}`} />}
              {member.leave ? `${member.leave.label}${member.leave.halfDay ? ' · half day today' : ''}` : working ? 'Working now' : member.taskState === 'ready' ? 'No task in progress' : 'Task status unavailable'}
            </p>
            {away && <p className="mb-3 text-sm text-muted-foreground">{member.leave?.halfDay ? 'Partially away today.' : 'Away today.'} {member.tasks.length ? 'Assigned tasks remain in progress:' : ''}</p>}
            {member.tasks.length > 0 && <ul className="space-y-2">{member.tasks.map(task => <li key={task.id}><a href={task.url} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3 rounded-lg p-2 -ml-2 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="min-w-0"><span className="block break-words font-medium group-hover:text-primary">{task.name}</span><span className="text-xs text-muted-foreground">{task.project}</span></span><ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></a></li>)}</ul>}
            {member.taskState !== 'ready' && <p className="mt-2 text-sm text-muted-foreground">{sourceMessage[member.taskState] || 'Task status unavailable.'}</p>}
            {!away && !member.tasks.length && member.taskState === 'ready' && <p className="text-sm text-muted-foreground">No assigned tasks are marked In Progress in your projects.</p>}
          </div>
        </li>
      })}</ul>}
  </section>
}
