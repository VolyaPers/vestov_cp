import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Files,
  MessageSquareQuote,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, MetricTile, MetricTileSkeleton, PageHero, PageHeroSkeleton } from '@/components/page-primitives'
import { useClientWorkspace, ClientLoadError } from '@/lib/clientWorkspace'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

function normalizeServices(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry)).filter(Boolean)
      }
    } catch {
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }

  return []
}

function formatContractType(value?: string) {
  if (!value) return 'Not specified'
  return value.replace(/_/g, ' ')
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: string | number
  hint: string
  icon: React.ReactNode
}) {
  return <MetricTile label={title} value={value} hint={hint} />
}

export function ClientDashboard() {
  const { clientId: selectedClientId } = useClientWorkspace()
  const { data: dashboardData, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', 'dashboard', selectedClientId],
    queryFn: () => api.getClientDashboard(selectedClientId),
    enabled: !!selectedClientId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeroSkeleton />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricTileSkeleton key={index} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <CardSkeleton titleWidth="w-40" lines={4} tall />
          <CardSkeleton titleWidth="w-44" lines={3} tall />
        </div>
      </div>
    )
  }

  if (isError) return <ClientLoadError message="Unable to load your workspace overview." onRetry={() => refetch()} />

  const { client, stats, recentFeedback, viewer } = dashboardData || {}
  const services = normalizeServices(client?.activeServices)
  const clientId = client?.id

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Overview"
        title={viewer?.fullName ? `Welcome back, ${viewer.fullName}.` : 'Welcome to your workspace.'}
        description="Review your active projects, team, feedback, shared documents and invoices."
        theme="teal"
        meta={(
          <>
            <span>{client?.name || 'Client account'}</span>
            {client?.industry && (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                <span>{client.industry}</span>
              </>
            )}
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <span>{stats?.pendingFeedback || 0} feedback item{stats?.pendingFeedback === 1 ? '' : 's'} awaiting review</span>
          </>
        )}
        actions={clientId ? (
          <>
            <Link href={`/client/portal/${clientId}`}>
              <Button>
                Open portal
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/client/documents/${clientId}`}>
              <Button variant="outline">Documents</Button>
            </Link>
            <Link href={`/client/invoices/${clientId}`}>
              <Button variant="outline">Invoices</Button>
            </Link>
          </>
        ) : undefined}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Team Size"
          value={stats?.totalTeamMembers || 0}
          hint="Assigned delivery specialists"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Active Services"
          value={stats?.activeServices || services.length || 0}
          hint="Projects currently active"
          icon={<Settings className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Feedback"
          value={stats?.pendingFeedback || 0}
          hint="Your feedback awaiting review"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          title="Contract Status"
          value={client?.status === 'active' ? 'Active' : 'Inactive'}
          hint={client?.contractEnd ? `Renews through ${formatDate(client.contractEnd)}` : 'No expiry date set'}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/80 bg-white/82">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Active services</CardTitle>
                <CardDescription>Projects currently assigned to your account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {services.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {services.map((service, index) => (
                  <div key={`${service}-${index}`} className="rounded-[1.2rem] border border-border/70 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{service}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Active project {index + 1}.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        Active
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-white/50 p-6 text-sm text-muted-foreground">
                No active services are attached to this account yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <MessageSquareQuote className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Recent feedback</CardTitle>
                <CardDescription>Your feedback for this company and its review status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentFeedback?.length ? (
              <div className="space-y-3">
                {recentFeedback.slice(0, 4).map((request: any) => (
                  <div key={request.id} className="rounded-[1.2rem] border border-border/70 bg-white/72 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{request.comments}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(request.createdAt)} • {request.status}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          request.status === 'reviewed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-white/50 p-6 text-sm text-muted-foreground">
                You have not submitted feedback for this company yet.
              </div>
            )}
            <Link href="/client/feedback"><Button variant="outline" className="mt-4">Open feedback</Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-white/80 bg-white/82">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <Files className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Account snapshot</CardTitle>
                <CardDescription>Core contract details at a glance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Contract type</p>
              <p className="mt-2 text-sm font-semibold text-foreground capitalize">{formatContractType(client?.contractType)}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Billing cycle</p>
              <p className="mt-2 text-sm font-semibold text-foreground capitalize">{formatContractType(client?.billingCycle)}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Industry</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{client?.industry || 'Not specified'}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-white/70 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Team size</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{stats?.totalTeamMembers || 0} members</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <CardHeader>
            <CardTitle className="text-xl">Suggested next actions</CardTitle>
            <CardDescription>Shortcuts to your projects and billing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {clientId && (
              <>
                <Link href={`/client/portal/${clientId}`}>
                  <button className="w-full rounded-[1.25rem] border border-border/70 bg-white/75 p-4 text-left transition hover:border-primary/25 hover:bg-primary/5">
                    <p className="text-sm font-semibold text-foreground">Open delivery portal</p>
                    <p className="mt-1 text-sm text-muted-foreground">Review overview, status and assigned workstreams.</p>
                  </button>
                </Link>
                <Link href={`/client/documents/${clientId}`}>
                  <button className="w-full rounded-[1.25rem] border border-border/70 bg-white/75 p-4 text-left transition hover:border-primary/25 hover:bg-primary/5">
                    <p className="text-sm font-semibold text-foreground">Review documents</p>
                    <p className="mt-1 text-sm text-muted-foreground">Open shared files, folders and supporting material.</p>
                  </button>
                </Link>
                <Link href={`/client/invoices/${clientId}`}>
                  <button className="w-full rounded-[1.25rem] border border-border/70 bg-white/75 p-4 text-left transition hover:border-primary/25 hover:bg-primary/5">
                    <p className="text-sm font-semibold text-foreground">Check invoices</p>
                    <p className="mt-1 text-sm text-muted-foreground">Open billing history and payment context.</p>
                  </button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
