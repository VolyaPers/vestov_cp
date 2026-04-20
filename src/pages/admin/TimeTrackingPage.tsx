import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Filter,
  Link2,
  PlugZap,
  RefreshCw,
  Unplug,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
  subDays,
} from 'date-fns'
import type {
  ClickUpComplianceRangePreset,
  ClickUpComplianceRow,
  ClickUpComplianceStatus,
  ClickUpMember,
  ClickUpTimeEntry,
  TeamMember,
} from '@/types/common'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MappingSelection = Record<string, string>

function formatHours(value: number) {
  return `${value.toFixed(2)}h`
}

function getInitials(value?: string | null) {
  if (!value) {
    return '—'
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatSignedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'N/A'
  }
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not yet'
  }

  return format(parseISO(value), 'd MMM yyyy, h:mm a')
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'N/A'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTaskLink(taskId?: string | null) {
  if (!taskId) {
    return null
  }

  return `https://app.clickup.com/t/${taskId}`
}

function formatComplianceStatusLabel(status: ClickUpComplianceStatus) {
  switch (status) {
    case 'missing':
      return 'Below target'
    case 'unmapped':
      return 'Needs mapping'
    case 'no_expected_hours':
      return 'No workdays'
    case 'on_track':
      return 'On track'
    default:
      return status
  }
}

function formatComplianceStatusClass(status: ClickUpComplianceStatus) {
  switch (status) {
    case 'missing':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'unmapped':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'no_expected_hours':
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case 'on_track':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    default:
      return 'border-border bg-background text-foreground'
  }
}

function formatDateOnly(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function resolveReportRange(
  preset: ClickUpComplianceRangePreset,
  customStartDate: string,
  customEndDate: string,
) {
  const now = new Date()

  if (preset === 'custom') {
    const start = customStartDate || formatDateOnly(startOfMonth(subMonths(now, 1)))
    const end = customEndDate || formatDateOnly(new Date())
    return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
  }

  if (preset === 'today') {
    const today = formatDateOnly(new Date())
    return { startDate: today, endDate: today }
  }

  if (preset === 'yesterday') {
    const yesterday = formatDateOnly(subDays(new Date(), 1))
    return { startDate: yesterday, endDate: yesterday }
  }

  if (preset === 'this_week') {
    return {
      startDate: formatDateOnly(startOfWeek(now, { weekStartsOn: 1 })),
      endDate: formatDateOnly(endOfWeek(now, { weekStartsOn: 1 })),
    }
  }

  if (preset === 'this_month') {
    return {
      startDate: formatDateOnly(startOfMonth(now)),
      endDate: formatDateOnly(endOfMonth(now)),
    }
  }

  if (preset === 'last_week') {
    const date = subWeeks(now, 1)
    return {
      startDate: formatDateOnly(startOfWeek(date, { weekStartsOn: 1 })),
      endDate: formatDateOnly(endOfWeek(date, { weekStartsOn: 1 })),
    }
  }

  if (preset === 'last_month') {
    const date = subMonths(now, 1)
    return {
      startDate: formatDateOnly(startOfMonth(date)),
      endDate: formatDateOnly(endOfMonth(date)),
    }
  }

  if (preset === 'last_quarter') {
    const date = subQuarters(now, 1)
    return {
      startDate: formatDateOnly(startOfQuarter(date)),
      endDate: formatDateOnly(endOfQuarter(date)),
    }
  }

  const date = subYears(now, 1)
  return {
    startDate: formatDateOnly(startOfYear(date)),
    endDate: formatDateOnly(endOfYear(date)),
  }
}

type MetricTone = 'default' | 'success' | 'warning' | 'danger'

function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: MetricTone
  icon?: React.ReactNode
}) {
  const toneAccent: Record<MetricTone, string> = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  }

  return (
    <Card className="flex h-full border-slate-200 bg-white shadow-sm">
      <CardContent className="flex h-full w-full items-center justify-between gap-4 p-6 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneAccent[tone])}>
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ProgressBar({
  value,
  max,
  status,
}: {
  value: number
  max: number
  status: ClickUpComplianceStatus
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const fill =
    status === 'on_track'
      ? 'bg-emerald-500'
      : status === 'missing'
        ? 'bg-red-500'
        : status === 'unmapped'
          ? 'bg-amber-500'
          : 'bg-slate-400'

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full transition-[width]', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

const PERIOD_PRESETS: Array<{ value: ClickUpComplianceRangePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_quarter', label: 'Last quarter' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom' },
]

export function TimeTrackingPage() {
  const queryClient = useQueryClient()
  const [clickupToken, setClickupToken] = useState('')
  const [validatedWorkspaces, setValidatedWorkspaces] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [mappingSelection, setMappingSelection] = useState<MappingSelection>({})
  const [complianceRangePreset, setComplianceRangePreset] = useState<ClickUpComplianceRangePreset>('this_month')
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0])
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0])
  const [filters, setFilters] = useState({
    teamMemberId: '',
    clientId: '',
    clientServiceId: '',
    attributionStatus: '',
  })
  const reportRange = useMemo(
    () => resolveReportRange(complianceRangePreset, customStartDate, customEndDate),
    [complianceRangePreset, customStartDate, customEndDate],
  )

  const statusQuery = useQuery({
    queryKey: ['clickup-status'],
    queryFn: () => api.getClickUpStatus(),
    refetchInterval: (query) => query.state.data?.runningSync ? 5000 : 30000,
  })

  const teamMembersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.getTeamMembers(),
  })

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  })

  const clickupMembersQuery = useQuery({
    queryKey: ['clickup-members'],
    queryFn: () => api.getClickUpMembers(),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const complianceQuery = useQuery({
    queryKey: ['clickup-compliance', complianceRangePreset, reportRange.startDate, reportRange.endDate],
    queryFn: () => api.getClickUpCompliance(
      complianceRangePreset === 'custom'
        ? { rangePreset: complianceRangePreset, startDate: reportRange.startDate, endDate: reportRange.endDate }
        : { rangePreset: complianceRangePreset },
    ),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const mappingsQuery = useQuery({
    queryKey: ['clickup-member-mappings'],
    queryFn: () => api.getClickUpMemberMappings(),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const clientServicesQuery = useQuery({
    queryKey: ['client-service-options', filters.clientId],
    queryFn: () => api.getClientServiceOptions(Number(filters.clientId)),
    enabled: Boolean(filters.clientId),
  })

  const reportQuery = useQuery({
    queryKey: ['clickup-time-report', reportRange.startDate, reportRange.endDate, filters.teamMemberId, filters.clientId, filters.clientServiceId, filters.attributionStatus],
    queryFn: () => api.getClickUpTimeReport({
      startDate: reportRange.startDate,
      endDate: reportRange.endDate,
      teamMemberId: filters.teamMemberId ? Number(filters.teamMemberId) : undefined,
      clientId: filters.clientId ? Number(filters.clientId) : undefined,
      clientServiceId: filters.clientServiceId ? Number(filters.clientServiceId) : undefined,
      attributionStatus: filters.attributionStatus === 'assigned' || filters.attributionStatus === 'unassigned'
        ? filters.attributionStatus
        : undefined,
    }),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const entriesQuery = useQuery({
    queryKey: ['clickup-time-entries', reportRange.startDate, reportRange.endDate, filters.teamMemberId, filters.clientId, filters.clientServiceId, filters.attributionStatus],
    queryFn: () => api.getClickUpTimeEntries({
      startDate: reportRange.startDate,
      endDate: reportRange.endDate,
      teamMemberId: filters.teamMemberId ? Number(filters.teamMemberId) : undefined,
      clientId: filters.clientId ? Number(filters.clientId) : undefined,
      clientServiceId: filters.clientServiceId ? Number(filters.clientServiceId) : undefined,
      attributionStatus: filters.attributionStatus === 'assigned' || filters.attributionStatus === 'unassigned'
        ? filters.attributionStatus
        : undefined,
      page: 1,
      pageSize: 100,
    }),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const entriesByMember = useMemo(() => {
    const grouped = new Map<string, {
      key: string
      clickupUserId: string
      teamMemberId: number | null
      teamMemberName: string
      clickupUserName: string
      totalHours: number
      totalEntries: number
      clientName: string | null
      clientServiceName: string | null
      entries: ClickUpTimeEntry[]
    }>()
    const entries = entriesQuery.data?.entries ?? []

    for (const entry of entries) {
      const key = String(entry.teamMemberId ?? entry.clickupUserId)
      const current = grouped.get(key)

      if (current) {
        current.entries.push(entry)
        current.totalHours += entry.durationHours
        current.totalEntries += 1
        grouped.set(key, current)
        continue
      }

      grouped.set(key, {
        key,
        clickupUserId: entry.clickupUserId,
        teamMemberId: entry.teamMemberId ?? null,
        teamMemberName: entry.teamMemberName || entry.clickupUserName,
        clickupUserName: entry.clickupUserName,
        totalHours: entry.durationHours,
        totalEntries: 1,
        clientName: entry.clientName ?? null,
        clientServiceName: entry.clientServiceName ?? null,
        entries: [entry],
      })
    }

    return grouped
  }, [entriesQuery.data?.entries])

  useEffect(() => {
    if (!mappingsQuery.data || !teamMembersQuery.data) {
      return
    }

    const nextSelection: MappingSelection = {}
    for (const member of teamMembersQuery.data) {
      const mapping = mappingsQuery.data.find((row) => row.teamMemberId === member.id)
      if (mapping) {
        nextSelection[String(member.id)] = mapping.clickupUserId
      }
    }
    setMappingSelection(nextSelection)
  }, [mappingsQuery.data, teamMembersQuery.data])

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspaceId) {
        throw new Error('Choose a ClickUp workspace before connecting.')
      }

      const selectedWorkspace = validatedWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId)
      if (!selectedWorkspace) {
        throw new Error('The selected ClickUp workspace is no longer available.')
      }

      return api.saveIntegration('clickup', {
        apiToken: clickupToken,
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.name,
        workspaceColor: selectedWorkspace.color ?? '',
      })
    },
    onSuccess: async () => {
      setClickupToken('')
      setValidatedWorkspaces([])
      setSelectedWorkspaceId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clickup-status'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-members'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-member-mappings'] }),
      ])
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => api.deleteIntegration('clickup'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clickup-status'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-members'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-member-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-report'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-entries'] }),
      ])
    },
  })

  const syncMutation = useMutation({
    mutationFn: async () => api.syncClickUp(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clickup-status'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-members'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-member-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-report'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-entries'] }),
      ])
    },
  })

  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      const selectedMembers = clickupMembersQuery.data ?? []
      const membersById = new Map(selectedMembers.map((member) => [member.clickupUserId, member]))

      const mappings = Object.entries(mappingSelection).flatMap(([teamMemberId, clickupUserId]) => {
        const clickupMember = membersById.get(clickupUserId)
        if (!clickupUserId || !clickupMember) {
          return []
        }

        return [{
          teamMemberId: Number(teamMemberId),
          clickupUserId,
          clickupUserName: clickupMember.clickupUserName,
          clickupUserEmail: clickupMember.clickupUserEmail ?? null,
        }]
      })

      return api.saveClickUpMemberMappings(mappings)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clickup-member-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-report'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-time-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['clickup-status'] }),
      ])
    },
  })

  const teamMembers = teamMembersQuery.data ?? []
  const clients = clientsQuery.data ?? []
  const clickupMembers = clickupMembersQuery.data ?? []
  const teamMembersById = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member])),
    [teamMembers],
  )
  const clickupMembersById = useMemo(
    () => new Map(clickupMembers.map((member) => [member.clickupUserId, member])),
    [clickupMembers],
  )
  const compliance = complianceQuery.data?.report
  const complianceRows = compliance?.rows ?? []
  const selectedTeamMemberId = filters.teamMemberId ? Number(filters.teamMemberId) : null
  const memberPerformanceRows = useMemo(() => {
    const rows = complianceRows
      .filter((row) => !selectedTeamMemberId || row.teamMemberId === selectedTeamMemberId)
      .map((row) => {
        const entries = entriesByMember.get(String(row.teamMemberId))
        const teamMember = row.teamMemberId ? teamMembersById.get(row.teamMemberId) : null
        return {
          key: String(row.teamMemberId),
          row,
          entries: entries?.entries ?? [],
          isOrphan: false,
          title: row.teamMemberName,
          avatarUrl: teamMember?.avatarUrl ?? null,
          initials: getInitials(teamMember?.name ?? row.teamMemberName),
        }
      })
      .sort((left, right) => {
        const statusOrder: Record<ClickUpComplianceStatus, number> = {
          missing: 0,
          unmapped: 1,
          on_track: 2,
          no_expected_hours: 3,
        }

        const rankDelta = statusOrder[left.row.status] - statusOrder[right.row.status]
        if (rankDelta !== 0) {
          return rankDelta
        }

        return left.row.teamMemberName.localeCompare(right.row.teamMemberName)
      })

    if (selectedTeamMemberId) {
      return rows
    }

    const mappedTeamMemberIds = new Set(complianceRows.map((row) => String(row.teamMemberId)))
    const orphanRows = Array.from(entriesByMember.values())
      .filter((group) => !group.teamMemberId || !mappedTeamMemberIds.has(String(group.teamMemberId)))
      .map((group) => ({
        key: `orphan-${group.key}`,
        row: null as ClickUpComplianceRow | null,
        entries: group.entries,
        isOrphan: true,
        title: group.teamMemberName || group.clickupUserName || 'Unmapped ClickUp user',
        avatarUrl: clickupMembersById.get(group.clickupUserId)?.avatarUrl ?? null,
        initials: getInitials(group.teamMemberName || group.clickupUserName),
      }))

    return [
      ...rows,
      ...orphanRows,
    ]
  }, [clickupMembersById, complianceRows, entriesByMember, selectedTeamMemberId, teamMembersById])
  const mappedTeamMemberIds = new Set(Object.keys(mappingSelection).filter((key) => mappingSelection[key]))
  const unmappedTeamMembers = teamMembers.filter((member) => member.status !== 'unavailable' && !mappedTeamMemberIds.has(String(member.id)))
  const pendingMappings = useMemo(() => {
    const current = mappingsQuery.data ?? []
    const currentMap = new Map(current.map((mapping) => [String(mapping.teamMemberId), mapping.clickupUserId]))
    return Object.entries(mappingSelection).some(([teamMemberId, clickupUserId]) => currentMap.get(teamMemberId) !== clickupUserId)
      || current.some((mapping) => !mappingSelection[String(mapping.teamMemberId)])
  }, [mappingSelection, mappingsQuery.data])

  const isBusy = connectMutation.isPending || disconnectMutation.isPending || syncMutation.isPending || saveMappingsMutation.isPending

  const hasActiveFilters = Boolean(
    filters.teamMemberId || filters.clientId || filters.clientServiceId || filters.attributionStatus,
  )

  const clearFilters = () => setFilters({ teamMemberId: '', clientId: '', clientServiceId: '', attributionStatus: '' })

  const validateWorkspaceMutation = useMutation({
    mutationFn: async () => api.validateClickUpToken(clickupToken),
    onSuccess: (data) => {
      setValidatedWorkspaces(data.workspaces)
      const preferred = data.workspaces.find((workspace) =>
        workspace.name.toLowerCase().includes('vestov')
      ) ?? data.workspaces[0]
      setSelectedWorkspaceId(preferred?.id ?? '')
    },
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">Admin Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Time Tracking</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Connect ClickUp once, map your people, then review tracked time against each member&apos;s minimum without touching invoice data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={!statusQuery.data?.isConnected || isBusy || Boolean(statusQuery.data?.runningSync)}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', (syncMutation.isPending || statusQuery.data?.runningSync) && 'animate-spin')} />
            {statusQuery.data?.runningSync ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button
            variant="outline"
            onClick={() => disconnectMutation.mutate()}
            disabled={!statusQuery.data?.isConnected || isBusy}
          >
            <Unplug className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </header>

      {statusQuery.data?.isConnected ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  Connected to {statusQuery.data.workspaceName || 'ClickUp'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Last sync {formatDateTime(statusQuery.data.lastSyncAt)} · {statusQuery.data.mappedCount} mapped · {statusQuery.data.syncedEntryCount} entries
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
                ID · {statusQuery.data.workspaceId}
              </Badge>
              {statusQuery.data.authorizedUserName ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
                  Owner · {statusQuery.data.authorizedUserName}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <PlugZap className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Connect ClickUp</CardTitle>
              <CardDescription className="mt-0.5 leading-6">
                Paste a ClickUp personal token from a workspace owner or admin. Vestov Hub validates the workspace before saving.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            <div className="space-y-2">
              <Label htmlFor="clickupToken">ClickUp API token</Label>
              <Input
                id="clickupToken"
                type="password"
                value={clickupToken}
                onChange={(event) => setClickupToken(event.target.value)}
                placeholder="pk_…"
              />
            </div>
            <div className="space-y-2">
              <Label>Workspace</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => validateWorkspaceMutation.mutate()}
                  disabled={!clickupToken || validateWorkspaceMutation.isPending}
                  className="sm:shrink-0"
                >
                  {validateWorkspaceMutation.isPending ? 'Validating…' : 'Find workspaces'}
                </Button>
                <select
                  value={selectedWorkspaceId}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                  disabled={validatedWorkspaces.length === 0}
                  className="h-10 w-full min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:opacity-60"
                >
                  <option value="">Select a workspace</option>
                  {validatedWorkspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                {validatedWorkspaces.length > 0
                  ? `ClickUp returned ${validatedWorkspaces.length} workspace${validatedWorkspaces.length === 1 ? '' : 's'} for this token.`
                  : 'Validate the token first so Vestov Hub can show the workspaces it can access.'}
              </p>
            </div>
            {connectMutation.error instanceof Error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {connectMutation.error.message}
              </div>
            ) : null}
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={!clickupToken || !selectedWorkspaceId || connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Connecting…' : 'Save & connect'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarRange className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Period</span>
            {compliance ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · {formatDate(compliance.startDate)} — {formatDate(compliance.endDate)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setComplianceRangePreset(preset.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  complianceRangePreset === preset.value
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </CardContent>
        {complianceRangePreset === 'custom' ? (
          <CardContent className="grid gap-3 border-t border-slate-200 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="compliance-start">Start date</Label>
              <Input
                id="compliance-start"
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance-end">End date</Label>
              <Input
                id="compliance-end"
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </div>
          </CardContent>
        ) : null}
      </Card>

      {statusQuery.data?.isConnected ? (
        complianceQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : compliance ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Minimum hours"
              value={formatHours(compliance.totalExpectedHours)}
              hint={`${compliance.label} target across ${compliance.totalTeamMembers} active members.`}
              icon={<CalendarRange className="h-4 w-4" />}
            />
            <MetricCard
              label="Tracked hours"
              value={formatHours(compliance.totalTrackedHours)}
              hint="Actual ClickUp time in the selected period."
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <MetricCard
              label="Missing hours"
              value={formatHours(compliance.totalMissingHours)}
              hint="Shortfall after approved leave is removed."
              tone={compliance.totalMissingHours > 0 ? 'danger' : 'default'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <MetricCard
              label="Needs attention"
              value={String(compliance.missingMembers)}
              hint="Members below target or still waiting for a mapping."
              tone={compliance.missingMembers > 0 ? 'warning' : 'default'}
              icon={<Users className="h-4 w-4" />}
            />
          </div>
        ) : null
      ) : null}

<Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Member performance</CardTitle>
              <CardDescription className="mt-0.5 leading-6">
                Tracked hours against each member&apos;s minimum. Expand a row to see the tasks behind the numbers.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
                {formatHours(reportQuery.data?.summary.totalHours ?? 0)} tracked
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
                {reportQuery.data?.summary.totalEntries ?? 0} entries
              </Badge>
              {unmappedTeamMembers.length > 0 ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800">
                  {unmappedTeamMembers.length} need mapping
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={filters.teamMemberId}
                onChange={(event) => setFilters((current) => ({ ...current, teamMemberId: event.target.value }))}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="">All members</option>
                {teamMembers.map((member: TeamMember) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <select
                value={filters.clientId}
                onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value, clientServiceId: '' }))}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <select
                value={filters.clientServiceId}
                onChange={(event) => setFilters((current) => ({ ...current, clientServiceId: event.target.value }))}
                disabled={!filters.clientId}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm disabled:opacity-60"
              >
                <option value="">All services</option>
                {(clientServicesQuery.data ?? []).map((service: { id: number; serviceTitle?: string; serviceTypeName?: string }) => (
                  <option key={service.id} value={service.id}>
                    {service.serviceTitle || service.serviceTypeName || `Service ${service.id}`}
                  </option>
                ))}
              </select>
              <select
                value={filters.attributionStatus}
                onChange={(event) => setFilters((current) => ({ ...current, attributionStatus: event.target.value }))}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="">All entries</option>
                <option value="assigned">Assigned only</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </div>
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="lg:shrink-0"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          {!statusQuery.data?.isConnected ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
              <Link2 className="h-6 w-6 text-slate-400" />
              <p className="text-sm font-semibold text-foreground">Connect ClickUp to see reports</p>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Minimum-hours targets and tracked time will appear here once the workspace is linked.
              </p>
            </div>
          ) : reportQuery.isLoading || entriesQuery.isLoading || complianceQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[92px] w-full animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
              ))}
            </div>
          ) : memberPerformanceRows.length > 0 ? (
            <div className="space-y-2">
              {memberPerformanceRows.map((group) => {
                const totalGroupHours = group.entries.reduce((sum, entry) => sum + entry.durationHours, 0)

                if (group.isOrphan) {
                  return (
                    <details key={group.key} className="group rounded-xl border border-amber-200 bg-amber-50/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9 ring-1 ring-amber-200">
                            <AvatarImage src={group.avatarUrl ?? undefined} alt={group.title} />
                            <AvatarFallback className="bg-amber-100 text-amber-900">{group.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-amber-950">{group.title}</p>
                            <p className="mt-0.5 text-xs text-amber-900/80">
                              {group.entries.length} task{group.entries.length === 1 ? '' : 's'} · {formatHours(totalGroupHours)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-amber-200 bg-white text-[11px] font-medium text-amber-800">
                            Needs mapping
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-amber-700 transition-transform group-open:rotate-180" />
                        </div>
                      </summary>
                      <div className="border-t border-amber-200 p-4">
                        <p className="rounded-md border border-amber-200 bg-white p-3 text-xs text-amber-900">
                          These entries are being tracked in ClickUp, but they are not yet linked to a Vestov team member.
                        </p>
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full min-w-[720px]">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client / service</th>
                                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hours</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {group.entries.map((entry) => {
                                const taskUrl = formatTaskLink(entry.taskId)
                                return (
                                  <tr key={entry.id} className="hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(entry.entryDate)}</td>
                                    <td className="px-3 py-2 text-xs">
                                      {taskUrl ? (
                                        <a href={taskUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                                          {entry.taskName || 'Untitled time entry'}
                                        </a>
                                      ) : (
                                        <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                                      )}
                                      <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                      {entry.clientName || 'Unassigned'}
                                      {entry.clientServiceName ? ` · ${entry.clientServiceName}` : ''}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground">{formatHours(entry.durationHours)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  )
                }

                const row = group.row
                if (!row) {
                  return null
                }

                return (
                  <details key={group.key} className="group rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
                    <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10 ring-1 ring-slate-200">
                            <AvatarImage src={group.avatarUrl ?? undefined} alt={row.teamMemberName} />
                            <AvatarFallback>{group.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-semibold text-foreground">{row.teamMemberName}</p>
                              <Badge variant="outline" className={cn('text-[10px] font-medium', formatComplianceStatusClass(row.status))}>
                                {formatComplianceStatusLabel(row.status)}
                              </Badge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {row.teamMemberPosition} · {row.clickupUserName || 'No ClickUp mapping yet'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 text-right">
                          <div className="hidden sm:block">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked / Min</p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                              {formatHours(row.trackedHours)} <span className="text-muted-foreground">/ {formatHours(row.minimumHours)}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Diff</p>
                            <p className={cn(
                              'mt-0.5 text-sm font-semibold tabular-nums',
                              row.differencePercent !== null && row.differencePercent < 0 ? 'text-red-600' : 'text-emerald-600',
                            )}>
                              {formatSignedPercent(row.differencePercent)}
                            </p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                      </div>
                      <ProgressBar value={row.trackedHours} max={row.minimumHours} status={row.status} />
                    </summary>
                    <div className="border-t border-slate-200 p-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Minimum</p>
                          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatHours(row.minimumHours)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked</p>
                          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatHours(row.trackedHours)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Missing</p>
                          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                            {row.missingHours > 0 ? formatHours(row.missingHours) : '0.00h'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">% diff</p>
                          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatSignedPercent(row.differencePercent)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{group.entries.length} task{group.entries.length === 1 ? '' : 's'} · {formatHours(totalGroupHours)}</span>
                        <span>·</span>
                        <span>{group.entries.filter((entry) => Boolean(entry.taskId)).length} have ClickUp links</span>
                        <span>·</span>
                        <span>{row.leaveDays.toFixed(1)} leave days excluded</span>
                      </div>

                      {group.entries.length > 0 ? (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full min-w-[720px]">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client / service</th>
                                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hours</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {group.entries
                                .slice()
                                .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
                                .map((entry) => {
                                  const taskUrl = formatTaskLink(entry.taskId)
                                  return (
                                    <tr key={entry.id} className="hover:bg-slate-50">
                                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(entry.entryDate)}</td>
                                      <td className="px-3 py-2 text-xs">
                                        {taskUrl ? (
                                          <a href={taskUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                                            {entry.taskName || 'Untitled time entry'}
                                          </a>
                                        ) : (
                                          <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                                        )}
                                        <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {entry.clientName || 'Unassigned'}
                                        {entry.clientServiceName ? ` · ${entry.clientServiceName}` : ''}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground">{formatHours(entry.durationHours)}</td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center text-xs text-muted-foreground">
                          No tracked tasks in this period yet.
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
              <Users className="h-6 w-6 text-slate-400" />
              <p className="text-sm font-semibold text-foreground">No tracked hours match these filters</p>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Try expanding the period, changing filters, or running a fresh sync.
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Member mapping</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Link Vestov team members to ClickUp users so reporting stays accurate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
              {statusQuery.data?.mappedCount ?? 0} mapped
            </Badge>
            {unmappedTeamMembers.length > 0 ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800">
                {unmappedTeamMembers.length} pending
              </Badge>
            ) : null}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t border-slate-200 p-5">
          {!statusQuery.data?.isConnected ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center text-xs text-muted-foreground">
              Connect ClickUp first, then Vestov Hub will show the available ClickUp users here.
            </div>
          ) : clickupMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center text-xs text-muted-foreground">
              No ClickUp members are visible yet. Run a sync once and then come back to map the people you want in reporting.
            </div>
          ) : (
            <>
              {unmappedTeamMembers.length > 0 ? (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Some team members still need a ClickUp link.</p>
                    <p className="mt-0.5 leading-5">
                      They stay out of the report until mapped, keeping the numbers trustworthy instead of guessed.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                {teamMembers
                  .filter((member) => member.status !== 'unavailable')
                  .map((member) => (
                    <div key={member.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9 ring-1 ring-slate-200">
                          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.position} · {member.email}</p>
                        </div>
                      </div>
                      <select
                        value={mappingSelection[String(member.id)] ?? ''}
                        onChange={(event) => {
                          setMappingSelection((current) => ({
                            ...current,
                            [String(member.id)]: event.target.value,
                          }))
                        }}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                      >
                        <option value="">No ClickUp user selected</option>
                        {clickupMembers.map((clickupMember: ClickUpMember) => (
                          <option key={clickupMember.clickupUserId} value={clickupMember.clickupUserId}>
                            {clickupMember.clickupUserName}
                            {clickupMember.clickupUserEmail ? ` · ${clickupMember.clickupUserEmail}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={() => saveMappingsMutation.mutate()} disabled={!pendingMappings || saveMappingsMutation.isPending}>
                  {saveMappingsMutation.isPending ? 'Saving…' : 'Save mappings'}
                </Button>
                {saveMappingsMutation.error instanceof Error ? (
                  <span className="text-xs text-red-700">{saveMappingsMutation.error.message}</span>
                ) : pendingMappings ? (
                  <span className="text-xs text-muted-foreground">You have unsaved mapping changes.</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Mappings are up to date.</span>
                )}
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  )
}
