import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Link2,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

function formatPresetLabel(preset: ClickUpComplianceRangePreset) {
  switch (preset) {
    case 'today':
      return 'Today'
    case 'yesterday':
      return 'Yesterday'
    case 'this_week':
      return 'This week'
    case 'this_month':
      return 'This month'
    case 'last_week':
      return 'Last week'
    case 'last_month':
      return 'Last month'
    case 'last_quarter':
      return 'Last quarter'
    case 'last_year':
      return 'Last year'
    case 'custom':
      return 'Custom range'
    default:
      return preset
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not yet'
  }

  return format(parseISO(value), 'd MMMM yyyy, h:mm a')
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'N/A'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
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

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="border-white/80 bg-white/80">
      <CardContent className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

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
  const memberChartRows = useMemo(() => {
    return memberPerformanceRows
      .filter((group) => !group.isOrphan && group.row && group.entries.length > 0)
      .map((group) => ({
        name: group.row.teamMemberName,
        trackedHours: group.row.trackedHours,
        minimumHours: group.row.minimumHours,
        differencePercent: group.row.differencePercent,
      }))
      .sort((left, right) => right.trackedHours - left.trackedHours)
  }, [memberPerformanceRows])
  const mappedTeamMemberIds = new Set(Object.keys(mappingSelection).filter((key) => mappingSelection[key]))
  const unmappedTeamMembers = teamMembers.filter((member) => member.status !== 'unavailable' && !mappedTeamMemberIds.has(String(member.id)))
  const pendingMappings = useMemo(() => {
    const current = mappingsQuery.data ?? []
    const currentMap = new Map(current.map((mapping) => [String(mapping.teamMemberId), mapping.clickupUserId]))
    return Object.entries(mappingSelection).some(([teamMemberId, clickupUserId]) => currentMap.get(teamMemberId) !== clickupUserId)
      || current.some((mapping) => !mappingSelection[String(mapping.teamMemberId)])
  }, [mappingSelection, mappingsQuery.data])

  const isBusy = connectMutation.isPending || disconnectMutation.isPending || syncMutation.isPending || saveMappingsMutation.isPending

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 px-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/80">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Time Tracking</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Connect ClickUp once, map your people, then see exactly who tracked how much time without touching invoice data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={!statusQuery.data?.isConnected || isBusy || Boolean(statusQuery.data?.runningSync)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending || statusQuery.data?.runningSync ? 'animate-spin' : ''}`} />
            {statusQuery.data?.runningSync ? 'Syncing…' : 'Sync Now'}
          </Button>
          <Button
            variant="outline"
            onClick={() => disconnectMutation.mutate()}
            disabled={!statusQuery.data?.isConnected || isBusy}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {statusQuery.data?.isConnected ? (
        <Card className="border-blue-200/70 bg-blue-50/65">
          <CardContent className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-semibold text-blue-950">
                  Connected to {statusQuery.data.workspaceName || 'ClickUp'}
                </p>
                <p className="mt-1 text-sm leading-6 text-blue-900/80">
                  Last sync: {formatDateTime(statusQuery.data.lastSyncAt)}. Mapped members: {statusQuery.data.mappedCount}. Synced entries: {statusQuery.data.syncedEntryCount}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-200 bg-white/90 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-blue-800">
                Workspace ID: {statusQuery.data.workspaceId}
              </Badge>
              {statusQuery.data.authorizedUserName ? (
                <Badge variant="outline" className="border-blue-200 bg-white/90 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-blue-800">
                  Token owner: {statusQuery.data.authorizedUserName}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200/70 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-amber-700" />
              Connect ClickUp
            </CardTitle>
            <CardDescription>
              Use a ClickUp personal token from a workspace owner or admin. Vestov Hub will validate the workspace before saving it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clickupToken">ClickUp API token</Label>
              <Input
                id="clickupToken"
                type="password"
                value={clickupToken}
                onChange={(event) => setClickupToken(event.target.value)}
                placeholder="pk_..."
              />
            </div>
            <div className="space-y-2">
              <Label>Workspace</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => validateWorkspaceMutation.mutate()}
                  disabled={!clickupToken || validateWorkspaceMutation.isPending}
                >
                  {validateWorkspaceMutation.isPending ? 'Validating…' : 'Find workspaces'}
                </Button>
                <select
                  value={selectedWorkspaceId}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                  disabled={validatedWorkspaces.length === 0}
                className="h-11 min-w-0 w-full flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select a workspace</option>
                  {validatedWorkspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
              {validatedWorkspaces.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  ClickUp returned {validatedWorkspaces.length} workspace{validatedWorkspaces.length === 1 ? '' : 's'} for this token.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Validate the token first so Vestov Hub can show the workspaces it can actually access.
                </p>
              )}
            </div>
            {connectMutation.error instanceof Error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {connectMutation.error.message}
              </div>
            ) : null}
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={!clickupToken || !selectedWorkspaceId || connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Connecting…' : 'Save & Connect'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/80 bg-white/88">
        <CardHeader className="flex flex-col gap-5 border-b border-border/60 px-6 pb-5 pt-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Performance overview
            </CardTitle>
            <CardDescription className="mt-1 leading-6">
              Review the selected period once, then expand any member to see the tasks behind their tracked hours.
            </CardDescription>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compliance and time reporting now live in one place. The period picker drives both views, while the filters below narrow the task list.
            </p>
          </div>
          <div className="grid gap-4 sm:min-w-[360px]">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2.5">
                <Label htmlFor="compliance-range">Period</Label>
                <select
                  id="compliance-range"
                  value={complianceRangePreset}
                  onChange={(event) => setComplianceRangePreset(event.target.value as ClickUpComplianceRangePreset)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This week</option>
                  <option value="this_month">This month</option>
                  <option value="last_week">Last week</option>
                  <option value="last_month">Last month</option>
                  <option value="last_quarter">Last quarter</option>
                  <option value="last_year">Last year</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>
              <div className="text-xs font-medium text-muted-foreground sm:pb-2">
                {formatPresetLabel(complianceRangePreset)}
              </div>
            </div>
            {complianceRangePreset === 'custom' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="compliance-start">Start date</Label>
                  <Input
                    id="compliance-start"
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="compliance-end">End date</Label>
                  <Input
                    id="compliance-end"
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-7 px-6 pb-6 pt-6">
          {!statusQuery.data?.isConnected ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Connect ClickUp to see minimum hours and member-level time reporting.
            </div>
          ) : complianceQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading performance overview…</div>
          ) : compliance ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Minimum Hours"
                  value={formatHours(compliance.totalExpectedHours)}
                  hint={`${compliance.label} target across ${compliance.totalTeamMembers} active members.`}
                />
                <MetricCard
                  label="Tracked Hours"
                  value={formatHours(compliance.totalTrackedHours)}
                  hint="Actual ClickUp time captured in the selected period."
                />
                <MetricCard
                  label="Missing Hours"
                  value={formatHours(compliance.totalMissingHours)}
                  hint="The shortfall after approved leave is removed."
                />
                <MetricCard
                  label="Needs Attention"
                  value={String(compliance.missingMembers)}
                  hint="Members below target or still waiting for a mapping."
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-muted-foreground">
                <span>{compliance.label}</span>
                <span>•</span>
                <span>{formatDate(compliance.startDate)} to {formatDate(compliance.endDate)}</span>
                <span>•</span>
                <span>Approved leave is excluded from the target.</span>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                    {formatHours(reportQuery.data?.summary.totalHours ?? 0)} tracked
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                    {reportQuery.data?.summary.totalEntries ?? 0} entries
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                    {statusQuery.data?.mappedCount ?? 0} mapped members
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                    {unmappedTeamMembers.length} need mapping
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Filters below narrow the task list. The compliance totals stay anchored to the selected period so the minimum-hours target stays honest.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tracked hours by member</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      A quick read on who is carrying the tracked time in the selected period.
                    </p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                    {memberChartRows.length} members
                  </Badge>
                </div>
                {memberChartRows.length > 0 ? (
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberChartRows} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
                        <XAxis type="number" tickFormatter={(value) => `${Number(value).toFixed(0)}h`} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={150}
                          tick={{ fill: '#475569', fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatHours(value),
                            name === 'trackedHours' ? 'Tracked' : 'Minimum',
                          ]}
                        />
                        <Bar dataKey="minimumHours" fill="rgba(148,163,184,0.34)" radius={[0, 10, 10, 0]} />
                        <Bar dataKey="trackedHours" fill="rgba(37,99,235,0.82)" radius={[0, 10, 10, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No tracked hours to chart yet.
                  </div>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2.5">
                  <Label>Team member</Label>
                  <select
                    value={filters.teamMemberId}
                    onChange={(event) => setFilters((current) => ({ ...current, teamMemberId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All mapped members</option>
                    {teamMembers.map((member: TeamMember) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2.5">
                  <Label>Client</Label>
                  <select
                    value={filters.clientId}
                    onChange={(event) => setFilters((current) => ({
                      ...current,
                      clientId: event.target.value,
                      clientServiceId: '',
                    }))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All clients</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2.5">
                  <Label>Service</Label>
                  <select
                    value={filters.clientServiceId}
                    onChange={(event) => setFilters((current) => ({ ...current, clientServiceId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    disabled={!filters.clientId}
                  >
                    <option value="">All services</option>
                    {(clientServicesQuery.data ?? []).map((service: { id: number; serviceTitle?: string; serviceTypeName?: string }) => (
                      <option key={service.id} value={service.id}>
                        {service.serviceTitle || service.serviceTypeName || `Service ${service.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2.5">
                  <Label>Attribution</Label>
                  <select
                    value={filters.attributionStatus}
                    onChange={(event) => setFilters((current) => ({ ...current, attributionStatus: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All entries</option>
                    <option value="assigned">Assigned only</option>
                    <option value="unassigned">Unassigned only</option>
                  </select>
                </div>
              </div>

              {reportQuery.isLoading || entriesQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading member breakdown…</div>
              ) : memberPerformanceRows.length > 0 ? (
                <div className="space-y-3">
                  {memberPerformanceRows.map((group) => {
                    if (group.isOrphan) {
                      return (
                        <details key={group.key} className="group rounded-2xl border border-dashed border-amber-200 bg-amber-50/55">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-10 w-10 ring-1 ring-amber-200">
                                <AvatarImage src={group.avatarUrl ?? undefined} alt={group.title} />
                                <AvatarFallback className="bg-amber-100 text-amber-900">{group.initials}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-amber-950">{group.title}</p>
                                <p className="mt-1 text-sm leading-6 text-amber-900/80">
                                  {group.entries.length} task{group.entries.length === 1 ? '' : 's'} · {formatHours(group.entries.reduce((sum, entry) => sum + entry.durationHours, 0))}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-amber-200 bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-amber-800">
                                Needs mapping
                              </Badge>
                              <ChevronDown className="h-4 w-4 text-amber-700" />
                            </div>
                          </summary>
                          <div className="border-t border-amber-200/80 px-4 py-4">
                            <div className="rounded-2xl border border-amber-200 bg-white/85 p-4 text-sm text-amber-900">
                              These entries are being tracked in ClickUp, but they are not yet linked to a Vestov team member.
                            </div>
                            <div className="mt-4 overflow-x-auto rounded-2xl border border-border/70">
                              <table className="w-full min-w-[900px]">
                                <thead className="bg-muted/60">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Task</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Client / service</th>
                                    <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Hours</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 bg-white/85">
                                  {group.entries.map((entry) => {
                                    const taskUrl = formatTaskLink(entry.taskId)
                                    return (
                                      <tr key={entry.id}>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(entry.entryDate)}</td>
                                        <td className="px-4 py-3 text-sm">
                                          {taskUrl ? (
                                            <a
                                              href={taskUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="font-medium text-primary hover:underline"
                                            >
                                              {entry.taskName || 'Untitled time entry'}
                                            </a>
                                          ) : (
                                            <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                                          )}
                                          <div className="mt-1 text-xs text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                          {entry.clientName || 'Unassigned'}
                                          {entry.clientServiceName ? ` · ${entry.clientServiceName}` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatHours(entry.durationHours)}</td>
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

                    const trackedCount = group.entries.length
                    const taskUrlCount = group.entries.filter((entry) => Boolean(entry.taskId)).length

                    return (
                      <details key={group.key} className="group rounded-2xl border border-border/70 bg-white/85">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-10 w-10 ring-1 ring-border/70">
                              <AvatarImage src={group.avatarUrl ?? undefined} alt={row.teamMemberName} />
                              <AvatarFallback>{group.initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-foreground">{row.teamMemberName}</p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.teamMemberPosition} · {row.clickupUserName || 'No ClickUp mapping yet'}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                              {formatHours(row.minimumHours)} minimum
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                              {formatHours(row.trackedHours)} tracked
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.05em] text-slate-700">
                              {formatSignedPercent(row.differencePercent)} diff
                            </Badge>
                            <Badge variant="outline" className={`px-3 py-1 text-[11px] font-semibold tracking-[0.05em] ${formatComplianceStatusClass(row.status)}`}>
                              {formatComplianceStatusLabel(row.status)}
                            </Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </summary>
                        <div className="border-t border-border/60 px-4 py-4">
                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Minimum</p>
                              <p className="mt-2 text-xl font-semibold text-foreground">{formatHours(row.minimumHours)}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tracked</p>
                              <p className="mt-2 text-xl font-semibold text-foreground">{formatHours(row.trackedHours)}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Missing</p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {row.missingHours > 0 ? formatHours(row.missingHours) : '0.00h'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">% diff</p>
                              <p className="mt-2 text-xl font-semibold text-foreground">{formatSignedPercent(row.differencePercent)}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm leading-6 text-muted-foreground">
                            <span>{trackedCount} tracked task{trackedCount === 1 ? '' : 's'} · {formatHours(group.entries.reduce((sum, entry) => sum + entry.durationHours, 0))}</span>
                            <span>•</span>
                            <span>{taskUrlCount} task{taskUrlCount === 1 ? '' : 's'} have direct ClickUp links</span>
                            <span>•</span>
                            <span>{row.leaveDays.toFixed(1)} leave days excluded</span>
                          </div>

                          {group.entries.length > 0 ? (
                            <div className="mt-4 overflow-x-auto rounded-2xl border border-border/70">
                              <table className="w-full min-w-[900px]">
                                <thead className="bg-muted/60">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Task</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Client / service</th>
                                    <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Hours</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 bg-white/85">
                                  {group.entries
                                    .slice()
                                    .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
                                    .map((entry) => {
                                      const taskUrl = formatTaskLink(entry.taskId)
                                      return (
                                        <tr key={entry.id}>
                                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(entry.entryDate)}</td>
                                          <td className="px-4 py-3 text-sm">
                                            {taskUrl ? (
                                              <a
                                                href={taskUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-medium text-primary hover:underline"
                                              >
                                                {entry.taskName || 'Untitled time entry'}
                                              </a>
                                            ) : (
                                              <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                                            )}
                                            <div className="mt-1 text-xs text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {entry.clientName || 'Unassigned'}
                                            {entry.clientServiceName ? ` · ${entry.clientServiceName}` : ''}
                                          </td>
                                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatHours(entry.durationHours)}</td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                              No tracked tasks in this period yet.
                            </div>
                          )}
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No tracked hours match the current filters yet.
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No performance data is available yet.
            </div>
          )}
        </CardContent>
      </Card>

      <details className="group rounded-2xl border border-border/70 bg-white/80">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <p className="text-base font-semibold text-foreground">Member mapping</p>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Hidden by default so the main report stays focused. Open it when you need to link people or resolve missing names.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{statusQuery.data?.mappedCount ?? 0} mapped</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </summary>
        <div className="border-t border-border/60 p-5">
          {!statusQuery.data?.isConnected ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Connect ClickUp first, then Vestov Hub will show the available ClickUp users here.
            </div>
          ) : clickupMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No ClickUp members are visible yet. Run a sync once and then come back to map the people you want in reporting.
            </div>
          ) : (
            <>
              {unmappedTeamMembers.length > 0 ? (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Some Vestov team members still need a ClickUp link.</p>
                    <p className="mt-1">
                      They stay out of the report until they are mapped, which keeps the numbers trustworthy instead of guessed.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3">
                {teamMembers
                  .filter((member) => member.status !== 'unavailable')
                  .map((member) => (
                    <div key={member.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white/80 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-1 ring-border/70">
                          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{member.name}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {member.position} · {member.email}
                          </p>
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
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
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
                  {saveMappingsMutation.isPending ? 'Saving…' : 'Save Mappings'}
                </Button>
                {saveMappingsMutation.error instanceof Error ? (
                  <span className="text-sm text-red-700">{saveMappingsMutation.error.message}</span>
                ) : pendingMappings ? (
                  <span className="text-sm text-muted-foreground">You have unsaved mapping changes.</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Mappings are up to date.</span>
                )}
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  )
}
