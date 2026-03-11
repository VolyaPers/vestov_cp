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
  return (
    <Card className="border-white/80 bg-white/82">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
            <p className="mt-3 font-display text-[2rem] font-semibold text-foreground">{value}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-white/80 bg-primary/10 text-primary shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.9)]">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClientDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['client', 'dashboard'],
    queryFn: () => api.getClientDashboard(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  const { client, stats, recentRequests } = dashboardData || {}
  const services = normalizeServices(client?.activeServices)
  const clientId = client?.id

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-slate-900/10 bg-slate-950 text-white shadow-[0_32px_70px_-34px_rgba(2,6,23,0.85)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_26%),linear-gradient(135deg,rgba(15,23,42,1),rgba(15,118,110,0.88))]" />
        <CardContent className="relative p-7 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="bg-white/10 text-white hover:bg-white/15">Client Overview</Badge>
              <h1 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
                Welcome back, {client?.contactPerson || 'there'}.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
                Your workspace now highlights delivery status, billing context and the quickest paths to the documents and invoices you actually need.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span>{client?.name || 'Client account'}</span>
                {client?.industry && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                    <span>{client.industry}</span>
                  </>
                )}
                <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                <span>{stats?.pendingRequests || 0} pending request{stats?.pendingRequests === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-slate-300">Contract</p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">Active</p>
                <p className="mt-1 text-sm text-slate-300">
                  {client?.contractEnd ? `Until ${formatDate(client.contractEnd)}` : 'No end date specified'}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-slate-300">Services running</p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">{stats?.activeServices || services.length || 0}</p>
                <p className="mt-1 text-sm text-slate-300">Live delivery lanes across your account.</p>
              </div>
            </div>
          </div>

          {clientId && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/client/portal/${clientId}`}>
                <Button className="bg-white text-slate-950 hover:bg-slate-100">
                  Open portal
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/client/documents/${clientId}`}>
                <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                  Documents
                </Button>
              </Link>
              <Link href={`/client/invoices/${clientId}`}>
                <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                  Invoices
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

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
          hint="Current workstreams in motion"
          icon={<Settings className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Requests"
          value={stats?.pendingRequests || 0}
          hint="Items waiting on a response"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          title="Contract Status"
          value="Active"
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
                <CardDescription>Live delivery lanes and engagement tracks</CardDescription>
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
                          Service lane {String(index + 1).padStart(2, '0')} in active delivery.
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
                <CardTitle className="text-xl">Recent requests</CardTitle>
                <CardDescription>Latest client-side requests and their current status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentRequests?.length ? (
              <div className="space-y-3">
                {recentRequests.slice(0, 4).map((request: any) => (
                  <div key={request.id} className="rounded-[1.2rem] border border-border/70 bg-white/72 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{request.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(request.requestDate)} • {request.status}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          request.status === 'approved'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : request.status === 'denied'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
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
                No recent requests found for this account.
              </div>
            )}
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
              <p className="mt-2 text-sm font-semibold text-foreground">{client?.teamSize || stats?.totalTeamMembers || 0} members</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/82">
          <CardHeader>
            <CardTitle className="text-xl">Suggested next actions</CardTitle>
            <CardDescription>Fast paths into the updated client workspace</CardDescription>
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
