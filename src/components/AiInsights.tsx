import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronUp,
  Heart,
  HeartCrack,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionHeading, EmptyState } from '@/components/page-primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface InsightItem {
  title: string
  body: string
  priority: 'high' | 'medium' | 'low'
  category: 'finance' | 'team' | 'client' | 'operations' | 'risk'
}

interface CashFlowProjection {
  month: string
  projected: string
  confidence: string
}

interface ClientHealthItem {
  clientName: string
  score: 'healthy' | 'watch' | 'at_risk'
  reason: string
}

interface AnomalyItem {
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

interface AiInsightsData {
  generatedAt: string
  morningBrief: string
  insights: InsightItem[]
  cashFlowForecast: {
    summary: string
    projections: CashFlowProjection[]
  }
  clientHealth: ClientHealthItem[]
  anomalies: AnomalyItem[]
}

const priorityColor = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-sky-100 text-sky-700',
}

const categoryIcon = {
  finance: TrendingUp,
  team: Heart,
  client: Sparkles,
  operations: Brain,
  risk: ShieldAlert,
}

const healthColor = {
  healthy: 'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-700',
  at_risk: 'bg-rose-100 text-rose-700',
}

const healthLabel = {
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At Risk',
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5">
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function MorningBrief({ brief, generatedAt }: { brief: string; generatedAt: string }) {
  const time = new Date(generatedAt)
  const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
          <Sparkles className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-indigo-900">Morning Brief</h3>
            <span className="text-xs text-indigo-500">as of {timeStr}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-indigo-800">{brief}</p>
        </div>
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: InsightItem }) {
  const Icon = categoryIcon[insight.category] ?? Brain

  return (
    <div className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white/94">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{insight.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.body}</p>
          </div>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', priorityColor[insight.priority])}>
          {insight.priority}
        </span>
      </div>
    </div>
  )
}

function CashFlowCard({ forecast }: { forecast: AiInsightsData['cashFlowForecast'] }) {
  return (
    <Card className="content-auto">
      <CardContent className="pt-5 sm:pt-5">
        <SectionHeading title="Cash flow forecast" description="AI-projected net position for the next 3 months." />
        <p className="mb-4 text-sm leading-6 text-muted-foreground">{forecast.summary}</p>
        {forecast.projections.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {forecast.projections.map((p) => (
              <div key={p.month} className="rounded-[1.15rem] border border-border/70 bg-white/72 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{p.month}</p>
                <p className="mt-2 font-display text-xl font-semibold text-foreground">{p.projected}</p>
                <p className={cn(
                  'mt-1 text-xs font-medium',
                  p.confidence === 'high' ? 'text-emerald-600' : p.confidence === 'medium' ? 'text-amber-600' : 'text-rose-600',
                )}>{p.confidence} confidence</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ClientHealthCard({ clients }: { clients: ClientHealthItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? clients : clients.slice(0, 5)
  const atRisk = clients.filter(c => c.score === 'at_risk')
  const watching = clients.filter(c => c.score === 'watch')

  return (
    <Card className="content-auto">
      <CardContent className="pt-5 sm:pt-5">
        <SectionHeading
          title="Client health scores"
          description={`${atRisk.length} at risk · ${watching.length} watching · ${clients.length - atRisk.length - watching.length} healthy`}
        />
        <div className="space-y-3">
          {visible.map((client) => (
            <div key={client.clientName} className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-border/70 bg-white/72 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{client.clientName}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{client.reason}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', healthColor[client.score])}>
                {healthLabel[client.score]}
              </span>
            </div>
          ))}
        </div>
        {clients.length > 5 && (
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setExpanded(!expanded)}>
            {expanded ? <><ChevronUp className="mr-1.5 h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Show all {clients.length} clients</>}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function AnomaliesCard({ anomalies }: { anomalies: AnomalyItem[] }) {
  if (anomalies.length === 0) return null

  return (
    <Card className="content-auto">
      <CardContent className="pt-5 sm:pt-5">
        <SectionHeading title="Anomalies detected" description="Unusual patterns flagged by AI analysis." />
        <div className="space-y-3">
          {anomalies.map((anomaly, i) => (
            <div key={i} className={cn(
              'rounded-[1.15rem] border p-4',
              anomaly.severity === 'high' ? 'border-rose-200 bg-rose-50/55' : anomaly.severity === 'medium' ? 'border-amber-200 bg-amber-50/55' : 'border-border/70 bg-white/72',
            )}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  anomaly.severity === 'high' ? 'text-rose-600' : anomaly.severity === 'medium' ? 'text-amber-600' : 'text-slate-500',
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{anomaly.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{anomaly.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ScenarioPlanner() {
  const [question, setQuestion] = useState('')
  const [analysis, setAnalysis] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (q: string) => api.askAiScenario(q) as Promise<{ analysis: string }>,
    onSuccess: (data) => setAnalysis(data.analysis),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim().length >= 10) {
      mutation.mutate(question.trim())
    }
  }

  const presets = [
    'What happens to runway if our top client churns?',
    'What is the cost impact of converting all freelancers to full-time?',
    'How would a 15% rate increase affect profitability?',
  ]

  return (
    <Card className="content-auto">
      <CardContent className="pt-5 sm:pt-5">
        <SectionHeading title="Scenario planner" description="Ask what-if questions about your business." />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What if we lose Client X?"
            className="flex-1 rounded-xl border border-border/70 bg-white/72 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            maxLength={500}
          />
          <Button type="submit" disabled={mutation.isPending || question.trim().length < 10}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        {!analysis && !mutation.isPending && (
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => { setQuestion(preset); mutation.mutate(preset) }}
                className="rounded-full border border-border/70 bg-white/72 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-slate-300 hover:bg-white/94 hover:text-foreground"
              >
                {preset}
              </button>
            ))}
          </div>
        )}
        {mutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing scenario...
          </div>
        )}
        {mutation.isError && (
          <p className="mt-4 text-sm text-rose-600">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to analyze scenario'}
          </p>
        )}
        {analysis && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="prose prose-sm max-w-none text-sm leading-6 text-slate-800 [&>p]:mb-3 [&>p:last-child]:mb-0">
              {analysis.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AiInsightsPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<AiInsightsData>({
    queryKey: ['aiInsights'],
    queryFn: () => api.getAiInsights() as Promise<AiInsightsData>,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshAiInsights() as Promise<AiInsightsData>,
    onSuccess: (freshData) => {
      queryClient.setQueryData(['aiInsights'], freshData)
    },
  })

  if (error) {
    const message = error instanceof Error ? error.message : 'AI insights unavailable'
    const isNotConfigured = message.includes('not configured') || message.includes('503')

    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title={isNotConfigured ? 'AI insights not configured' : 'AI insights unavailable'}
            description={isNotConfigured
              ? 'Set the ANTHROPIC_API_KEY environment variable on the server to enable AI-powered business intelligence.'
              : message
            }
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading) return <InsightsSkeleton />

  if (!data) return null

  const sortedInsights = [...data.insights].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading title="AI business intelligence" description="Real-time analysis powered by Claude." />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', refreshMutation.isPending && 'animate-spin')} />
          {refreshMutation.isPending ? 'Analyzing...' : 'Refresh analysis'}
        </Button>
      </div>

      <MorningBrief brief={data.morningBrief} generatedAt={data.generatedAt} />

      <div className="space-y-3">
        {sortedInsights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CashFlowCard forecast={data.cashFlowForecast} />
        <ClientHealthCard clients={data.clientHealth} />
      </div>

      <AnomaliesCard anomalies={data.anomalies} />

      <ScenarioPlanner />
    </div>
  )
}
