import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import type {
  ClickUpComplianceRangePreset,
  ClickUpComplianceRow,
  ClickUpMember,
  ClickUpTimeEntry,
  ClickUpTimeReportRow,
  TeamMember,
} from '@/types/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MappingSelection = Record<string, string>

function formatHours(value: number) {
  return `${value.toFixed(2)}h`
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
      <CardContent className="p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
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
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    teamMemberId: '',
    clientId: '',
    clientServiceId: '',
    attributionStatus: '',
    page: 1,
  })

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
    queryKey: ['clickup-compliance', complianceRangePreset, customStartDate, customEndDate],
    queryFn: () => api.getClickUpCompliance(
      complianceRangePreset === 'custom'
        ? { rangePreset: complianceRangePreset, startDate: customStartDate, endDate: customEndDate }
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
    queryKey: ['clickup-time-report', filters.startDate, filters.endDate, filters.teamMemberId, filters.clientId, filters.clientServiceId, filters.attributionStatus],
    queryFn: () => api.getClickUpTimeReport({
      startDate: filters.startDate,
      endDate: filters.endDate,
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
    queryKey: ['clickup-time-entries', filters.startDate, filters.endDate, filters.teamMemberId, filters.clientId, filters.clientServiceId, filters.attributionStatus, filters.page],
    queryFn: () => api.getClickUpTimeEntries({
      startDate: filters.startDate,
      endDate: filters.endDate,
      teamMemberId: filters.teamMemberId ? Number(filters.teamMemberId) : undefined,
      clientId: filters.clientId ? Number(filters.clientId) : undefined,
      clientServiceId: filters.clientServiceId ? Number(filters.clientServiceId) : undefined,
      attributionStatus: filters.attributionStatus === 'assigned' || filters.attributionStatus === 'unassigned'
        ? filters.attributionStatus
        : undefined,
      page: filters.page,
      pageSize: 20,
    }),
    enabled: Boolean(statusQuery.data?.isConnected),
  })

  const entriesByMember = useMemo(() => {
    const grouped = new Map<string, ClickUpTimeEntry[]>()
    const entries = entriesQuery.data?.entries ?? []

    for (const entry of entries) {
      const key = String(entry.teamMemberId ?? entry.clickupUserId)
      const current = grouped.get(key) ?? []
      current.push(entry)
      grouped.set(key, current)
    }

    return Array.from(grouped.entries()).map(([key, memberEntries]) => {
      const first = memberEntries[0]
      return {
        key,
        teamMemberId: first.teamMemberId ?? null,
        teamMemberName: first.teamMemberName || first.clickupUserName,
        clickupUserName: first.clickupUserName,
        totalHours: memberEntries.reduce((sum, entry) => sum + entry.durationHours, 0),
        totalEntries: memberEntries.length,
        clientName: first.clientName,
        clientServiceName: first.clientServiceName,
        entries: memberEntries,
      }
    })
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
  const compliance = complianceQuery.data?.report
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary/80">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Time Tracking</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-semibold text-blue-950">
                  Connected to {statusQuery.data.workspaceName || 'ClickUp'}
                </p>
                <p className="mt-1 text-sm text-blue-900/80">
                  Last sync: {formatDateTime(statusQuery.data.lastSyncAt)}. Mapped members: {statusQuery.data.mappedCount}. Synced entries: {statusQuery.data.syncedEntryCount}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-200 bg-white/90 text-blue-800">
                Workspace ID: {statusQuery.data.workspaceId}
              </Badge>
              {statusQuery.data.authorizedUserName ? (
                <Badge variant="outline" className="border-blue-200 bg-white/90 text-blue-800">
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
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
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

      <Card className="border-white/80 bg-white/82">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Minimum Hours Compliance
            </CardTitle>
            <CardDescription>
              Each active billable team member is expected to track 6.5h per working day, excluding approved leave.
            </CardDescription>
          </div>
          <div className="grid gap-3 sm:min-w-[360px]">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="compliance-range">Period</Label>
                <select
                  id="compliance-range"
                  value={complianceRangePreset}
                  onChange={(event) => setComplianceRangePreset(event.target.value as ClickUpComplianceRangePreset)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="today">Today</option>
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
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!statusQuery.data?.isConnected ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Connect ClickUp to see the compliance overview.
            </div>
          ) : complianceQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading compliance overview…</div>
          ) : compliance ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Minimum Hours"
                  value={formatHours(compliance.totalExpectedHours)}
                  hint={`${compliance.label} target across ${compliance.totalTeamMembers} team members.`}
                />
                <MetricCard
                  label="Tracked Hours"
                  value={formatHours(compliance.totalTrackedHours)}
                  hint="Actual ClickUp time tracked in the selected period."
                />
                <MetricCard
                  label="Missing Hours"
                  value={formatHours(compliance.totalMissingHours)}
                  hint="The shortfall vs. the 6.5h minimum after approved leave."
                />
                <MetricCard
                  label="Needs Attention"
                  value={String(compliance.missingMembers)}
                  hint="People who are below target or still need a ClickUp mapping."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{compliance.label}</span>
                <span>•</span>
                <span>{formatDate(compliance.startDate)} to {formatDate(compliance.endDate)}</span>
                <span>•</span>
                <span>Approved leave is excluded from the target.</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full min-w-[1100px]">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Team member</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">ClickUp mapping</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Minimum</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Tracked</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Missing</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">% diff</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Leave days</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-white/80">
                    {compliance.rows.map((row: ClickUpComplianceRow) => {
                      const rowClass = row.status === 'missing'
                        ? 'bg-red-50/70'
                        : row.status === 'unmapped'
                          ? 'bg-amber-50/70'
                          : 'bg-white/80'

                      return (
                        <tr key={row.teamMemberId} className={rowClass}>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            <div>{row.teamMemberName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.teamMemberPosition}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {row.clickupUserName ? (
                              <div>
                                <div className="font-medium text-foreground">{row.clickupUserName}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Mapped to ClickUp</div>
                              </div>
                            ) : (
                              <span className="text-amber-700">Needs mapping</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatHours(row.minimumHours)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatHours(row.trackedHours)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                            {row.missingHours > 0 ? formatHours(row.missingHours) : '0.00h'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatSignedPercent(row.differencePercent)}</td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">{row.leaveDays.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge
                              variant="outline"
                              className={
                                row.status === 'missing'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : row.status === 'unmapped'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : row.status === 'no_expected_hours'
                                      ? 'border-slate-200 bg-slate-50 text-slate-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              }
                            >
                              {row.status === 'missing'
                                ? 'Below target'
                                : row.status === 'unmapped'
                                  ? 'Needs mapping'
                                  : row.status === 'no_expected_hours'
                                    ? 'No workdays'
                                    : 'On track'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No compliance data is available yet.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Tracked Hours"
          value={formatHours(reportQuery.data?.summary.totalHours ?? 0)}
          hint="Total hours in the current filter window."
        />
        <MetricCard
          label="Tracked Entries"
          value={String(reportQuery.data?.summary.totalEntries ?? 0)}
          hint="Raw synced ClickUp time entries in the current filter."
        />
        <MetricCard
          label="Mapped Members"
          value={String(statusQuery.data?.mappedCount ?? 0)}
          hint="Vestov team members currently linked to ClickUp users."
        />
        <MetricCard
          label="Needs Mapping"
          value={String(unmappedTeamMembers.length)}
          hint="Team members not linked yet, so their ClickUp hours stay outside reporting."
        />
      </div>

      <Card className="border-white/80 bg-white/82">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Member Mapping
          </CardTitle>
          <CardDescription>
            Link each Vestov team member to one ClickUp user. Only mapped people appear in the admin time report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Some Vestov team members still need a ClickUp link.</p>
                    <p className="mt-1">
                      They will stay out of the report until they are mapped. This keeps the numbers trustworthy instead of guessing.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3">
                {teamMembers
                  .filter((member) => member.status !== 'unavailable')
                  .map((member) => (
                    <div key={member.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white/80 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
                      <div>
                        <p className="font-semibold text-foreground">{member.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {member.position} · {member.email}
                        </p>
                      </div>
                      <select
                        value={mappingSelection[String(member.id)] ?? ''}
                        onChange={(event) => {
                          setMappingSelection((current) => ({
                            ...current,
                            [String(member.id)]: event.target.value,
                          }))
                        }}
                        className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
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

              <div className="flex flex-wrap items-center gap-3">
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
        </CardContent>
      </Card>

      <Card className="border-white/80 bg-white/82">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            Time Report
          </CardTitle>
          <CardDescription>
            Filter by people, client, and service to answer who tracked how much time and where it can be attributed confidently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Team member</Label>
              <select
                value={filters.teamMemberId}
                onChange={(event) => setFilters((current) => ({ ...current, teamMemberId: event.target.value, page: 1 }))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All mapped members</option>
                {teamMembers.map((member: TeamMember) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <select
                value={filters.clientId}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  clientId: event.target.value,
                  clientServiceId: '',
                  page: 1,
                }))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <select
                value={filters.clientServiceId}
                onChange={(event) => setFilters((current) => ({ ...current, clientServiceId: event.target.value, page: 1 }))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
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
            <div className="space-y-2">
              <Label>Attribution</Label>
              <select
                value={filters.attributionStatus}
                onChange={(event) => setFilters((current) => ({ ...current, attributionStatus: event.target.value, page: 1 }))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All entries</option>
                <option value="assigned">Assigned only</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </div>
          </div>

          {reportQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading time report…</div>
          ) : !statusQuery.data?.isConnected ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Connect ClickUp to unlock reporting.</div>
          ) : entriesByMember.length > 0 ? (
            <div className="space-y-3">
              {entriesByMember.map((group) => (
                <details key={group.key} className="rounded-2xl border border-border/70 bg-white/80">
                  <summary className="cursor-pointer list-none px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{group.teamMemberName || group.clickupUserName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.totalEntries} task{group.totalEntries === 1 ? '' : 's'} · {formatHours(group.totalHours)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          {formatHours(group.totalHours)}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                          {group.totalEntries} entries
                        </Badge>
                      </div>
                    </div>
                  </summary>
                  <div className="border-t border-border/60 px-4 py-4">
                    <div className="overflow-x-auto rounded-2xl border border-border/70">
                      <table className="w-full min-w-[900px]">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Task</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">ClickUp link</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Client / service</th>
                            <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Hours</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 bg-white/80">
                          {group.entries.map((entry) => {
                            const taskUrl = formatTaskLink(entry.taskId)
                            return (
                              <tr key={entry.id}>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(entry.entryDate)}</td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {taskUrl ? (
                                    <a
                                      href={taskUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                    >
                                      Open task
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">No task link</span>
                                  )}
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
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No tracked hours match the current filter yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/80 bg-white/82">
        <CardHeader>
          <CardTitle>Time Entry Drill-down</CardTitle>
          <CardDescription>
            Inspect the underlying ClickUp entries when a total looks off or hours stayed unassigned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entriesQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading entries…</div>
          ) : entriesQuery.data && entriesQuery.data.entries.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full min-w-[1080px]">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Team member</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Task</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Attribution</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-white/80">
                    {entriesQuery.data.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(entry.entryDate)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.teamMemberName || entry.clickupUserName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <div className="font-medium text-foreground">{entry.taskName || 'Untitled time entry'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{entry.taskStatus || 'No task status'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {[entry.spaceName, entry.folderName, entry.listName].filter(Boolean).join(' / ') || 'No location details'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {entry.clientName || 'Unassigned'}
                          {entry.clientServiceName ? ` · ${entry.clientServiceName}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatHours(entry.durationHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing page {entriesQuery.data.pagination.page} of {Math.max(entriesQuery.data.pagination.totalPages, 1)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFilters((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                    disabled={filters.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                    disabled={filters.page >= (entriesQuery.data.pagination.totalPages || 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No ClickUp time entries are available for the current filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
