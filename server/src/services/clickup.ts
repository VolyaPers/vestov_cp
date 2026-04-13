import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  clickupDailyRollups,
  clickupMemberMappings,
  clickupSyncRuns,
  clickupTimeEntries,
  clientServiceTeamMembers,
  clientServices,
  clients,
  leaveRequests,
  integrationSettings,
  teamMembers,
} from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'
const CLICKUP_PROVIDER = 'clickup'
const INITIAL_SYNC_DAYS = 180
const OVERLAP_SYNC_DAYS = 14
const SCHEDULE_INTERVAL_MS = 2 * 60 * 60 * 1000
const STALE_RUNNING_SYNC_MS = 6 * 60 * 60 * 1000

type ClickUpCredentials = {
  apiToken: string
  workspaceId: string
  workspaceName: string
  workspaceColor?: string | null
  authorizedUserId?: string | null
  authorizedUserName?: string | null
  authorizedUserEmail?: string | null
}

type ClickUpWorkspace = {
  id: string
  name: string
  color?: string | null
  members: ClickUpRemoteMember[]
}

type ClickUpRemoteMember = {
  id: string
  name: string
  email?: string | null
  initials?: string | null
  avatarUrl?: string | null
}

type ClickUpIntegrationStatus = {
  isConnected: boolean
  isActive: boolean
  workspaceId: string | null
  workspaceName: string | null
  workspaceColor?: string | null
  authorizedUserName?: string | null
  lastSyncAt: string | null
}

type ClickUpTimeEntryRecord = {
  externalId: string
  workspaceId: string
  clickupUserId: string
  clickupUserName: string
  clickupUserEmail: string | null
  taskId: string | null
  taskName: string | null
  taskStatus: string | null
  listId: string | null
  listName: string | null
  folderId: string | null
  folderName: string | null
  spaceId: string | null
  spaceName: string | null
  durationMs: string
  isBillable: boolean | null
  startAt: Date | null
  endAt: Date | null
  entryDate: string
  tags: unknown
  sourceData: unknown
  sourceUpdatedAt: Date | null
}

type SyncTrigger = 'manual' | 'scheduled'

type ComplianceRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_year'
  | 'custom'
type ComplianceStatus = 'missing' | 'on_track' | 'no_expected_hours' | 'unmapped'

type ClickUpComplianceRow = {
  teamMemberId: number
  teamMemberName: string
  teamMemberPosition: string
  teamMemberStatus: string
  isBillable: boolean
  clickupUserId: string | null
  clickupUserName: string | null
  minimumDays: number
  leaveDays: number
  minimumHours: number
  trackedHours: number
  missingHours: number
  differenceHours: number
  differencePercent: number | null
  status: ComplianceStatus
}

type ClickUpComplianceReport = {
  rangePreset: ComplianceRangePreset
  label: string
  startDate: string
  endDate: string
  totalTeamMembers: number
  totalExpectedHours: number
  totalTrackedHours: number
  totalMissingHours: number
  missingMembers: number
  rows: ClickUpComplianceRow[]
}

type ClickUpComplianceResponse = {
  generatedAt: string
  report: ClickUpComplianceReport
}

let activeSyncPromise: Promise<{ runId: number; fetched: number; upserted: number; skipped: number }> | null = null
let schedulerStarted = false

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value === undefined || value === null ? null : String(value)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseClickUpDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && value.trim() !== '') {
      const date = new Date(numeric)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function toDateOnly(value: Date): string {
  return value.toISOString().split('T')[0]
}

function decimalToNumber(value: string | number | null | undefined | unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value !== 'string') {
    return 0
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function msToHours(value: string | number | null | undefined): number {
  return decimalToNumber(value) / (1000 * 60 * 60)
}

function toDateOnlyUTC(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseDateOnlyUTC(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function addDaysUTC(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isWeekdayUTC(value: Date): boolean {
  const day = value.getUTCDay()
  return day >= 1 && day <= 5
}

function compareDateOnly(a: string, b: string): number {
  return a.localeCompare(b)
}

function maxDateOnly(a: string, b: string): string {
  return compareDateOnly(a, b) >= 0 ? a : b
}

function minDateOnly(a: string, b: string): string {
  return compareDateOnly(a, b) <= 0 ? a : b
}

function countWeekdaysInRange(startDate: string, endDate: string): number {
  if (compareDateOnly(startDate, endDate) > 0) {
    return 0
  }

  let count = 0
  let current = parseDateOnlyUTC(startDate)
  const end = parseDateOnlyUTC(endDate)

  while (current <= end) {
    if (isWeekdayUTC(current)) {
      count += 1
    }
    current = addDaysUTC(current, 1)
  }

  return count
}

type ComplianceRangeBounds = {
  label: string
  startDate: string
  endDate: string
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getPreviousWeekBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const weekday = current.getUTCDay()
  const currentMondayOffset = (weekday + 6) % 7
  const currentMonday = addDaysUTC(current, -currentMondayOffset)
  const previousMonday = addDaysUTC(currentMonday, -7)
  const previousSunday = addDaysUTC(previousMonday, 6)

  return {
    label: 'Last week',
    startDate: toDateOnlyUTC(previousMonday),
    endDate: toDateOnlyUTC(previousSunday),
  }
}

function getCurrentWeekBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const weekday = current.getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const monday = addDaysUTC(current, -mondayOffset)
  const sunday = addDaysUTC(monday, 6)
  return {
    label: 'This week',
    startDate: toDateOnlyUTC(monday),
    endDate: toDateOnlyUTC(sunday),
  }
}

function getPreviousMonthBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const previousMonthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1))
  const previousMonthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0))
  return {
    label: 'Last month',
    startDate: toDateOnlyUTC(previousMonthStart),
    endDate: toDateOnlyUTC(previousMonthEnd),
  }
}

function getCurrentMonthBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0))
  return {
    label: 'This month',
    startDate: toDateOnlyUTC(monthStart),
    endDate: toDateOnlyUTC(monthEnd),
  }
}

function getPreviousQuarterBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const currentQuarter = Math.floor(current.getUTCMonth() / 3)
  const previousQuarter = currentQuarter - 1
  const year = previousQuarter >= 0 ? current.getUTCFullYear() : current.getUTCFullYear() - 1
  const quarterIndex = previousQuarter >= 0 ? previousQuarter : 3
  const startMonth = quarterIndex * 3

  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0))

  return {
    label: 'Last quarter',
    startDate: toDateOnlyUTC(start),
    endDate: toDateOnlyUTC(end),
  }
}

function getPreviousYearBounds(referenceDate = new Date()): ComplianceRangeBounds {
  const current = startOfUtcDay(referenceDate)
  const year = current.getUTCFullYear() - 1
  return {
    label: 'Last year',
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

function resolveComplianceRange(
  rangePreset: ComplianceRangePreset,
  startDate?: string,
  endDate?: string,
  referenceDate = new Date(),
): ComplianceRangeBounds {
  if (rangePreset === 'today') {
    const today = toDateOnlyUTC(startOfUtcDay(referenceDate))
    return {
      label: 'Today',
      startDate: today,
      endDate: today,
    }
  }
  if (rangePreset === 'this_week') {
    return getCurrentWeekBounds(referenceDate)
  }
  if (rangePreset === 'this_month') {
    return getCurrentMonthBounds(referenceDate)
  }
  if (rangePreset === 'custom') {
    const fallbackStart = toDateOnlyUTC(addDaysUTC(startOfUtcDay(referenceDate), -30))
    const fallbackEnd = toDateOnlyUTC(startOfUtcDay(referenceDate))
    const resolvedStart = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : fallbackStart
    const resolvedEnd = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : fallbackEnd
    return {
      label: 'Custom range',
      startDate: compareDateOnly(resolvedStart, resolvedEnd) <= 0 ? resolvedStart : resolvedEnd,
      endDate: compareDateOnly(resolvedStart, resolvedEnd) <= 0 ? resolvedEnd : resolvedStart,
    }
  }

  if (rangePreset === 'last_week') {
    return getPreviousWeekBounds(referenceDate)
  }
  if (rangePreset === 'last_month') {
    return getPreviousMonthBounds(referenceDate)
  }
  if (rangePreset === 'last_quarter') {
    return getPreviousQuarterBounds(referenceDate)
  }
  return getPreviousYearBounds(referenceDate)
}

function calculateLeaveDaysInPeriod(
  leaveRequest: {
    startDate: string
    endDate: string
    halfDayStart: boolean | null
    halfDayEnd: boolean | null
  },
  periodStart: string,
  periodEnd: string,
): number {
  const overlapStart = maxDateOnly(leaveRequest.startDate, periodStart)
  const overlapEnd = minDateOnly(leaveRequest.endDate, periodEnd)

  if (compareDateOnly(overlapStart, overlapEnd) > 0) {
    return 0
  }

  let total = 0
  let current = parseDateOnlyUTC(overlapStart)
  const end = parseDateOnlyUTC(overlapEnd)

  while (current <= end) {
    if (isWeekdayUTC(current)) {
      const currentDate = toDateOnlyUTC(current)
      let fraction = 1

      if (currentDate === leaveRequest.startDate && leaveRequest.halfDayStart) {
        fraction -= 0.5
      }
      if (currentDate === leaveRequest.endDate && leaveRequest.halfDayEnd) {
        fraction -= 0.5
      }

      total += Math.max(fraction, 0)
    }

    current = addDaysUTC(current, 1)
  }

  return total
}

function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()
  if (sameMonth) {
    return start.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return `${start.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

async function clickupRequest<T>(path: string, token: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${CLICKUP_API_BASE}${path}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message = typeof payload?.err === 'string'
      ? payload.err
      : typeof payload?.error === 'string'
        ? payload.error
        : `ClickUp API error: ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

function extractRemoteMembers(input: unknown): ClickUpRemoteMember[] {
  if (!input || typeof input !== 'object') {
    return []
  }

  const rawCandidates = [
    (input as { members?: unknown[] }).members,
    (input as { users?: unknown[] }).users,
    (input as { user?: unknown }).user ? [(input as { user: unknown }).user] : undefined,
  ].flatMap((value) => (Array.isArray(value) ? value : []))

  const members = rawCandidates.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const user = (item as { user?: unknown }).user && typeof (item as { user?: unknown }).user === 'object'
      ? (item as { user: Record<string, unknown> }).user
      : item as Record<string, unknown>

    const id = normalizeText(user.id ?? (item as Record<string, unknown>).id)
    if (!id) {
      return []
    }

    const name = normalizeText(
      user.username ??
      user.name ??
      user.email ??
      (item as Record<string, unknown>).username ??
      (item as Record<string, unknown>).name
    ) ?? `ClickUp user ${id}`

    return [{
      id,
      name,
      email: normalizeText(user.email ?? (item as Record<string, unknown>).email),
      initials: normalizeText(user.initials ?? (item as Record<string, unknown>).initials),
      avatarUrl: normalizeText(user.profilePicture ?? user.profile_picture ?? user.avatar ?? (item as Record<string, unknown>).avatar),
    }]
  })

  return Array.from(
    new Map(members.map((member) => [member.id, member])).values(),
  )
}

function workspaceFromApiRecord(record: Record<string, unknown>): ClickUpWorkspace | null {
  const id = normalizeText(record.id)
  const name = normalizeText(record.name)

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    color: normalizeText(record.color),
    members: extractRemoteMembers(record),
  }
}

function normalizeTimeEntry(rawEntry: Record<string, unknown>, workspaceId: string): ClickUpTimeEntryRecord | null {
  const externalId = normalizeText(rawEntry.id ?? rawEntry.timer_id ?? rawEntry.time_entry_id)
  const user = rawEntry.user && typeof rawEntry.user === 'object'
    ? rawEntry.user as Record<string, unknown>
    : {}
  const task = rawEntry.task && typeof rawEntry.task === 'object'
    ? rawEntry.task as Record<string, unknown>
    : {}
  const list = rawEntry.list && typeof rawEntry.list === 'object'
    ? rawEntry.list as Record<string, unknown>
    : {}
  const folder = rawEntry.folder && typeof rawEntry.folder === 'object'
    ? rawEntry.folder as Record<string, unknown>
    : {}
  const space = rawEntry.space && typeof rawEntry.space === 'object'
    ? rawEntry.space as Record<string, unknown>
    : {}

  const clickupUserId = normalizeText(user.id ?? rawEntry.user_id ?? rawEntry.assignee)
  if (!externalId || !clickupUserId) {
    return null
  }

  const clickupUserName = normalizeText(user.username ?? user.name ?? user.email) ?? `ClickUp user ${clickupUserId}`
  const clickupUserEmail = normalizeText(user.email)

  const startAt = parseClickUpDate(rawEntry.start ?? rawEntry.start_time ?? rawEntry.startAt ?? rawEntry.start_date)
  const endAt = parseClickUpDate(rawEntry.end ?? rawEntry.end_time ?? rawEntry.endAt ?? rawEntry.end_date)
  let durationMs = Math.abs(decimalToNumber(rawEntry.duration ?? rawEntry.duration_ms))

  if (durationMs <= 0 && startAt && endAt) {
    durationMs = Math.max(endAt.getTime() - startAt.getTime(), 0)
  }

  if (durationMs <= 0 && startAt && !endAt) {
    durationMs = Math.max(Date.now() - startAt.getTime(), 0)
  }

  const entryDate = toDateOnly(startAt ?? endAt ?? new Date())
  const sourceUpdatedAt = parseClickUpDate(rawEntry.at ?? rawEntry.updated ?? rawEntry.date_updated)
  const taskStatus = task.status && typeof task.status === 'object'
    ? normalizeText((task.status as Record<string, unknown>).status ?? (task.status as Record<string, unknown>).type)
    : normalizeText(task.status)

  return {
    externalId,
    workspaceId,
    clickupUserId,
    clickupUserName,
    clickupUserEmail,
    taskId: normalizeText(task.id ?? rawEntry.task_id),
    taskName: normalizeText(task.name ?? rawEntry.task_name),
    taskStatus,
    listId: normalizeText(list.id ?? rawEntry.list_id),
    listName: normalizeText(list.name ?? rawEntry.list_name),
    folderId: normalizeText(folder.id ?? rawEntry.folder_id),
    folderName: normalizeText(folder.name ?? rawEntry.folder_name),
    spaceId: normalizeText(space.id ?? rawEntry.space_id),
    spaceName: normalizeText(space.name ?? rawEntry.space_name),
    durationMs: Math.round(durationMs).toString(),
    isBillable: typeof rawEntry.billable === 'boolean'
      ? rawEntry.billable
      : typeof rawEntry.is_billable === 'boolean'
        ? rawEntry.is_billable
        : null,
    startAt,
    endAt,
    entryDate,
    tags: rawEntry.tags ?? task.tags ?? [],
    sourceData: rawEntry,
    sourceUpdatedAt,
  }
}

export async function validateClickUpToken(apiToken: string): Promise<{ workspace: ClickUpWorkspace; status: ClickUpIntegrationStatus }> {
  const [workspaces, userPayload] = await Promise.all([
    listClickUpWorkspaces(apiToken),
    clickupRequest<{ user?: Record<string, unknown> }>('/user', apiToken).catch(() => ({ user: undefined })),
  ])

  if (workspaces.length === 0) {
    throw new Error('The ClickUp token did not return any accessible workspaces.')
  }

  const workspace = workspaces[0]
  const user = userPayload.user ?? {}

  return {
    workspace,
    status: {
      isConnected: true,
      isActive: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceColor: workspace.color,
      authorizedUserName: normalizeText(user.username ?? user.email ?? user.name),
      lastSyncAt: null,
    },
  }
}

export async function listClickUpWorkspaces(apiToken: string): Promise<ClickUpWorkspace[]> {
  const workspacePayload = await clickupRequest<{ teams?: unknown[] }>('/team', apiToken)

  return Array.isArray(workspacePayload.teams)
    ? workspacePayload.teams.flatMap((team) => {
        if (!team || typeof team !== 'object') {
          return []
        }
        const workspace = workspaceFromApiRecord(team as Record<string, unknown>)
        return workspace ? [workspace] : []
      })
    : []
}

export async function getClickUpCredentials(): Promise<ClickUpCredentials | null> {
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.provider, CLICKUP_PROVIDER))

  if (!row || !row.credentials || !row.isActive) {
    return null
  }

  let credentials: Partial<ClickUpCredentials>
  try {
    credentials = JSON.parse(decrypt(row.credentials))
  } catch {
    return null
  }

  if (!credentials.apiToken || !credentials.workspaceId || !credentials.workspaceName) {
    return null
  }

  return credentials as ClickUpCredentials
}

export async function getClickUpStatus(): Promise<ClickUpIntegrationStatus & {
  latestSync: null | {
    id: number
    status: string
    triggerType: string
    startedAt: string
    completedAt: string | null
    entriesFetched: number
    entriesUpserted: number
    entriesSkipped: number
    errorMessage: string | null
  }
  mappedCount: number
  syncedEntryCount: number
  lastEntryDate: string | null
  runningSync: boolean
}> {
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.provider, CLICKUP_PROVIDER))

  if (!row || !row.credentials) {
    return {
      isConnected: false,
      isActive: false,
      workspaceId: null,
      workspaceName: null,
      workspaceColor: null,
      authorizedUserName: null,
      lastSyncAt: null,
      latestSync: null,
      mappedCount: 0,
      syncedEntryCount: 0,
      lastEntryDate: null,
      runningSync: false,
    }
  }

  let credentials: Partial<ClickUpCredentials> = {}
  try {
    credentials = JSON.parse(decrypt(row.credentials))
  } catch {
    // Keep default metadata response if decryption fails.
  }

  const [latestSync] = await db
    .select()
    .from(clickupSyncRuns)
    .where(credentials.workspaceId ? eq(clickupSyncRuns.workspaceId, credentials.workspaceId) : undefined)
    .orderBy(desc(clickupSyncRuns.startedAt))
    .limit(1)

  const [mappingCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clickupMemberMappings)
    .where(credentials.workspaceId ? eq(clickupMemberMappings.workspaceId, credentials.workspaceId) : undefined)

  const [entryStats] = await db
    .select({
      count: sql<number>`count(*)`,
      lastEntryDate: sql<string | null>`max(${clickupTimeEntries.entryDate})`,
    })
    .from(clickupTimeEntries)
    .where(credentials.workspaceId ? eq(clickupTimeEntries.workspaceId, credentials.workspaceId) : undefined)

  return {
    isConnected: Boolean(credentials.workspaceId && row.isActive),
    isActive: Boolean(row.isActive),
    workspaceId: credentials.workspaceId ?? null,
    workspaceName: credentials.workspaceName ?? null,
    workspaceColor: credentials.workspaceColor ?? null,
    authorizedUserName: credentials.authorizedUserName ?? null,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    latestSync: latestSync
      ? {
          id: latestSync.id,
          status: latestSync.status,
          triggerType: latestSync.triggerType,
          startedAt: latestSync.startedAt.toISOString(),
          completedAt: latestSync.completedAt ? latestSync.completedAt.toISOString() : null,
          entriesFetched: latestSync.entriesFetched,
          entriesUpserted: latestSync.entriesUpserted,
          entriesSkipped: latestSync.entriesSkipped,
          errorMessage: latestSync.errorMessage,
        }
      : null,
    mappedCount: Number(mappingCountResult?.count || 0),
    syncedEntryCount: Number(entryStats?.count || 0),
    lastEntryDate: entryStats?.lastEntryDate ?? null,
    runningSync: Boolean(latestSync && latestSync.status === 'running' && (!latestSync.completedAt || (Date.now() - latestSync.startedAt.getTime()) < STALE_RUNNING_SYNC_MS)),
  }
}

export async function listClickUpMemberMappings() {
  const credentials = await getClickUpCredentials()
  if (!credentials) {
    return []
  }

  const rows = await db
    .select({
      id: clickupMemberMappings.id,
      workspaceId: clickupMemberMappings.workspaceId,
      teamMemberId: clickupMemberMappings.teamMemberId,
      clickupUserId: clickupMemberMappings.clickupUserId,
      clickupUserName: clickupMemberMappings.clickupUserName,
      clickupUserEmail: clickupMemberMappings.clickupUserEmail,
      lastSeenAt: clickupMemberMappings.lastSeenAt,
      updatedAt: clickupMemberMappings.updatedAt,
      teamMemberName: teamMembers.name,
      teamMemberEmail: teamMembers.email,
      teamMemberPosition: teamMembers.position,
    })
    .from(clickupMemberMappings)
    .innerJoin(teamMembers, eq(clickupMemberMappings.teamMemberId, teamMembers.id))
    .where(eq(clickupMemberMappings.workspaceId, credentials.workspaceId))
    .orderBy(asc(teamMembers.name))

  return rows.map((row) => ({
    ...row,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

async function fetchRemoteWorkspaceMembers(credentials: ClickUpCredentials): Promise<ClickUpRemoteMember[]> {
  const workspacePayload = await clickupRequest<{ teams?: unknown[] }>('/team', credentials.apiToken)
  const workspaces = Array.isArray(workspacePayload.teams)
    ? workspacePayload.teams
        .flatMap((team) => {
          if (!team || typeof team !== 'object') {
            return []
          }
          const workspace = workspaceFromApiRecord(team as Record<string, unknown>)
          return workspace ? [workspace] : []
        })
    : []

  const workspace = workspaces.find((item) => item.id === credentials.workspaceId) ?? workspaces[0]
  const remoteMembers = workspace?.members ?? []

  if (remoteMembers.length > 0) {
    return remoteMembers
  }

  const localMembers = await db
    .select({
      clickupUserId: clickupTimeEntries.clickupUserId,
      clickupUserName: clickupTimeEntries.clickupUserName,
      clickupUserEmail: clickupTimeEntries.clickupUserEmail,
      lastSeenAt: sql<string | null>`max(${clickupTimeEntries.entryDate})`,
    })
    .from(clickupTimeEntries)
    .where(eq(clickupTimeEntries.workspaceId, credentials.workspaceId))
    .groupBy(clickupTimeEntries.clickupUserId, clickupTimeEntries.clickupUserName, clickupTimeEntries.clickupUserEmail)

  return localMembers.map((member) => ({
    id: member.clickupUserId,
    name: member.clickupUserName,
    email: member.clickupUserEmail,
    initials: null,
    avatarUrl: null,
  }))
}

export async function listClickUpMembers() {
  const credentials = await getClickUpCredentials()
  if (!credentials) {
    return []
  }

  const [mappings, remoteMembers] = await Promise.all([
    listClickUpMemberMappings(),
    fetchRemoteWorkspaceMembers(credentials),
  ])

  const mappingByUserId = new Map(mappings.map((mapping) => [mapping.clickupUserId, mapping]))
  const uniqueMembers = Array.from(
    new Map(remoteMembers.map((member) => [member.id, member])).values(),
  )

  return uniqueMembers
    .map((member) => {
      const mapping = mappingByUserId.get(member.id)
      return {
        clickupUserId: member.id,
        clickupUserName: member.name,
        clickupUserEmail: member.email ?? null,
        initials: member.initials ?? null,
        avatarUrl: member.avatarUrl ?? null,
        teamMemberId: mapping?.teamMemberId ?? null,
        teamMemberName: mapping?.teamMemberName ?? null,
        teamMemberEmail: mapping?.teamMemberEmail ?? null,
        lastSeenAt: mapping?.lastSeenAt ?? null,
      }
    })
    .sort((a, b) => a.clickupUserName.localeCompare(b.clickupUserName))
}

function getSyncWindow(previousCompletedAt: Date | null) {
  const end = new Date()

  if (!previousCompletedAt) {
    const start = new Date(end.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000)
    return { start, end }
  }

  const start = new Date(previousCompletedAt.getTime() - OVERLAP_SYNC_DAYS * 24 * 60 * 60 * 1000)
  return { start, end }
}

async function getRemoteAssigneeIds(credentials: ClickUpCredentials): Promise<string[]> {
  const members = await fetchRemoteWorkspaceMembers(credentials)
  const uniqueIds = Array.from(new Set(members.map((member) => member.id).filter(Boolean)))

  if (uniqueIds.length > 0) {
    return uniqueIds
  }

  if (credentials.authorizedUserId) {
    return [credentials.authorizedUserId]
  }

  const authorizedUser = await clickupRequest<{ user?: Record<string, unknown> }>('/user', credentials.apiToken)
  const authorizedUserId = normalizeText(authorizedUser.user?.id)
  return authorizedUserId ? [authorizedUserId] : []
}

async function fetchRemoteTimeEntries(credentials: ClickUpCredentials, start: Date, end: Date): Promise<ClickUpTimeEntryRecord[]> {
  const assigneeIds = await getRemoteAssigneeIds(credentials)

  const response = await clickupRequest<{ data?: unknown[] }>(
    `/team/${credentials.workspaceId}/time_entries`,
    credentials.apiToken,
    {
      start_date: start.getTime(),
      end_date: end.getTime(),
      assignee: assigneeIds.length > 0 ? assigneeIds.join(',') : undefined,
      include_task_tags: true,
      include_location_names: true,
    },
  )

  const rows = Array.isArray(response.data) ? response.data : []
  return rows.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const normalized = normalizeTimeEntry(entry as Record<string, unknown>, credentials.workspaceId)
    return normalized ? [normalized] : []
  })
}

async function markStaleRunningSyncs(workspaceId: string) {
  const threshold = new Date(Date.now() - STALE_RUNNING_SYNC_MS)
  await db
    .update(clickupSyncRuns)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Marked as failed because a newer sync superseded a stale running job.',
      updatedAt: new Date(),
    })
    .where(and(
      eq(clickupSyncRuns.workspaceId, workspaceId),
      eq(clickupSyncRuns.status, 'running'),
      lte(clickupSyncRuns.startedAt, threshold),
    ))
}

async function recomputeEntryMappingsAndRollups(workspaceId: string) {
  const [mappings, entries] = await Promise.all([
    db.select().from(clickupMemberMappings).where(eq(clickupMemberMappings.workspaceId, workspaceId)),
    db.select().from(clickupTimeEntries).where(eq(clickupTimeEntries.workspaceId, workspaceId)),
  ])

  const mappingByUserId = new Map(mappings.map((mapping) => [mapping.clickupUserId, mapping]))
  const mappedTeamMemberIds = Array.from(new Set(mappings.map((mapping) => mapping.teamMemberId)))

  const assignmentRows = mappedTeamMemberIds.length > 0
    ? await db
        .select({
          teamMemberId: teamMembers.id,
          clientServiceId: clientServices.id,
          clientId: clientServices.clientId,
          startDate: sql<string>`cast(${clientServices.startDate} as text)`,
          assignmentStartDate: sql<string>`cast(${clientServiceTeamMembers.startDate} as text)`,
          assignmentEndDate: sql<string | null>`cast(${clientServiceTeamMembers.endDate} as text)`,
        })
        .from(clientServiceTeamMembers)
        .innerJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
        .innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
        .where(and(
          inArray(teamMembers.id, mappedTeamMemberIds),
          eq(clientServiceTeamMembers.isActive, true),
        ))
    : []

  const assignmentsByTeamMemberId = new Map<number, Array<{ clientServiceId: number; clientId: number; startDate: string; endDate: string | null }>>()

  for (const row of assignmentRows) {
    const existing = assignmentsByTeamMemberId.get(row.teamMemberId) ?? []
    existing.push({
      clientServiceId: row.clientServiceId,
      clientId: row.clientId,
      startDate: row.assignmentStartDate || row.startDate,
      endDate: row.assignmentEndDate,
    })
    assignmentsByTeamMemberId.set(row.teamMemberId, existing)
  }

  const updates = entries.map(async (entry) => {
    const mapping = mappingByUserId.get(entry.clickupUserId)
    let teamMemberId: number | null = mapping?.teamMemberId ?? null
    let clientId: number | null = null
    let clientServiceId: number | null = null
    let attributionStatus: 'assigned' | 'unassigned' = 'unassigned'

    if (teamMemberId) {
      const assignments = assignmentsByTeamMemberId.get(teamMemberId) ?? []
      const eligibleAssignments = assignments.filter((assignment) => {
        if (entry.entryDate < assignment.startDate) {
          return false
        }
        if (assignment.endDate && entry.entryDate > assignment.endDate) {
          return false
        }
        return true
      })

      if (eligibleAssignments.length === 1) {
        clientId = eligibleAssignments[0].clientId
        clientServiceId = eligibleAssignments[0].clientServiceId
        attributionStatus = 'assigned'
      }
    }

    await db
      .update(clickupTimeEntries)
      .set({
        teamMemberId,
        clientId,
        clientServiceId,
        attributionStatus,
        updatedAt: new Date(),
      })
      .where(eq(clickupTimeEntries.id, entry.id))
  })

  await Promise.all(updates)

  await db.delete(clickupDailyRollups).where(eq(clickupDailyRollups.workspaceId, workspaceId))

  const refreshedEntries = await db
    .select()
    .from(clickupTimeEntries)
    .where(eq(clickupTimeEntries.workspaceId, workspaceId))

  const rollupMap = new Map<string, {
    workspaceId: string
    rollupDate: string
    clickupUserId: string
    clickupUserName: string
    teamMemberId: number | null
    clientId: number | null
    clientServiceId: number | null
    attributionStatus: string
    totalDurationMs: number
    entryCount: number
  }>()

  for (const entry of refreshedEntries) {
    const key = [
      entry.workspaceId,
      entry.entryDate,
      entry.clickupUserId,
      entry.teamMemberId ?? 'none',
      entry.clientId ?? 'none',
      entry.clientServiceId ?? 'none',
      entry.attributionStatus,
    ].join(':')

    const existing = rollupMap.get(key) ?? {
      workspaceId: entry.workspaceId,
      rollupDate: entry.entryDate,
      clickupUserId: entry.clickupUserId,
      clickupUserName: entry.clickupUserName,
      teamMemberId: entry.teamMemberId,
      clientId: entry.clientId,
      clientServiceId: entry.clientServiceId,
      attributionStatus: entry.attributionStatus,
      totalDurationMs: 0,
      entryCount: 0,
    }

    existing.totalDurationMs += decimalToNumber(entry.durationMs)
    existing.entryCount += 1
    rollupMap.set(key, existing)
  }

  const rollupValues = Array.from(rollupMap.values())
  if (rollupValues.length === 0) {
    return
  }

  await db.insert(clickupDailyRollups).values(
    rollupValues.map((rollup) => ({
      workspaceId: rollup.workspaceId,
      rollupDate: rollup.rollupDate,
      clickupUserId: rollup.clickupUserId,
      clickupUserName: rollup.clickupUserName,
      teamMemberId: rollup.teamMemberId,
      clientId: rollup.clientId,
      clientServiceId: rollup.clientServiceId,
      attributionStatus: rollup.attributionStatus,
      totalDurationMs: Math.round(rollup.totalDurationMs).toString(),
      entryCount: rollup.entryCount,
    })),
  )
}

export async function replaceClickUpMemberMappings(
  mappings: Array<{
    teamMemberId: number
    clickupUserId: string
    clickupUserName: string
    clickupUserEmail?: string | null
  }>,
  createdBy: number,
) {
  const credentials = await getClickUpCredentials()
  if (!credentials) {
    throw new Error('Connect ClickUp before saving member mappings.')
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(clickupMemberMappings)
      .where(eq(clickupMemberMappings.workspaceId, credentials.workspaceId))

    if (mappings.length > 0) {
      await tx.insert(clickupMemberMappings).values(
        mappings.map((mapping) => ({
          workspaceId: credentials.workspaceId,
          teamMemberId: mapping.teamMemberId,
          clickupUserId: mapping.clickupUserId,
          clickupUserName: mapping.clickupUserName,
          clickupUserEmail: mapping.clickupUserEmail ?? null,
          createdBy,
        })),
      )
    }
  })

  await recomputeEntryMappingsAndRollups(credentials.workspaceId)

  return listClickUpMemberMappings()
}

export async function syncClickUpTimeEntries(triggerType: SyncTrigger, triggeredBy?: number) {
  if (activeSyncPromise) {
    throw new Error('A ClickUp sync is already running. Please wait for it to finish.')
  }

  activeSyncPromise = (async () => {
    const credentials = await getClickUpCredentials()
    if (!credentials) {
      throw new Error('Connect ClickUp before running a sync.')
    }

    await markStaleRunningSyncs(credentials.workspaceId)

    const [latestSuccessfulRun] = await db
      .select()
      .from(clickupSyncRuns)
      .where(and(
        eq(clickupSyncRuns.workspaceId, credentials.workspaceId),
        eq(clickupSyncRuns.status, 'success'),
      ))
      .orderBy(desc(clickupSyncRuns.completedAt))
      .limit(1)

    const syncWindow = getSyncWindow(latestSuccessfulRun?.completedAt ?? null)

    const [syncRun] = await db
      .insert(clickupSyncRuns)
      .values({
        workspaceId: credentials.workspaceId,
        status: 'running',
        triggerType,
        rangeStart: syncWindow.start,
        rangeEnd: syncWindow.end,
        triggeredBy: triggeredBy ?? null,
      })
      .returning()

    try {
      const remoteEntries = await fetchRemoteTimeEntries(credentials, syncWindow.start, syncWindow.end)
      let upserted = 0

      for (const entry of remoteEntries) {
        const [existing] = await db
          .select({ id: clickupTimeEntries.id })
          .from(clickupTimeEntries)
          .where(eq(clickupTimeEntries.externalId, entry.externalId))
          .limit(1)

        const payload = {
          workspaceId: entry.workspaceId,
          externalId: entry.externalId,
          clickupUserId: entry.clickupUserId,
          clickupUserName: entry.clickupUserName,
          clickupUserEmail: entry.clickupUserEmail,
          taskId: entry.taskId,
          taskName: entry.taskName,
          taskStatus: entry.taskStatus,
          listId: entry.listId,
          listName: entry.listName,
          folderId: entry.folderId,
          folderName: entry.folderName,
          spaceId: entry.spaceId,
          spaceName: entry.spaceName,
          durationMs: entry.durationMs,
          isBillable: entry.isBillable,
          startAt: entry.startAt,
          endAt: entry.endAt,
          entryDate: entry.entryDate,
          tags: entry.tags,
          sourceData: entry.sourceData,
          sourceUpdatedAt: entry.sourceUpdatedAt,
          syncedAt: new Date(),
          updatedAt: new Date(),
        }

        if (existing) {
          await db
            .update(clickupTimeEntries)
            .set(payload)
            .where(eq(clickupTimeEntries.id, existing.id))
        } else {
          await db.insert(clickupTimeEntries).values(payload)
        }

        upserted += 1
      }

      await recomputeEntryMappingsAndRollups(credentials.workspaceId)

      await db
        .update(clickupSyncRuns)
        .set({
          status: 'success',
          completedAt: new Date(),
          entriesFetched: remoteEntries.length,
          entriesUpserted: upserted,
          entriesSkipped: 0,
          updatedAt: new Date(),
        })
        .where(eq(clickupSyncRuns.id, syncRun.id))

      await db
        .update(integrationSettings)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrationSettings.provider, CLICKUP_PROVIDER))

      return {
        runId: syncRun.id,
        fetched: remoteEntries.length,
        upserted,
        skipped: 0,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ClickUp sync error'

      await db
        .update(clickupSyncRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(clickupSyncRuns.id, syncRun.id))

      throw error
    }
  })()

  try {
    return await activeSyncPromise
  } finally {
    activeSyncPromise = null
  }
}

export async function getClickUpTimeReport(filters: {
  startDate?: string
  endDate?: string
  teamMemberId?: number
  clientId?: number
  clientServiceId?: number
  attributionStatus?: 'assigned' | 'unassigned'
}) {
  const credentials = await getClickUpCredentials()
  if (!credentials) {
    return {
      summary: {
        totalDurationMs: 0,
        totalHours: 0,
        totalEntries: 0,
        mappedMembers: 0,
      },
      rows: [],
    }
  }

  const conditions = [eq(clickupDailyRollups.workspaceId, credentials.workspaceId)]

  if (filters.startDate) {
    conditions.push(gte(clickupDailyRollups.rollupDate, filters.startDate))
  }
  if (filters.endDate) {
    conditions.push(lte(clickupDailyRollups.rollupDate, filters.endDate))
  }
  if (filters.teamMemberId) {
    conditions.push(eq(clickupDailyRollups.teamMemberId, filters.teamMemberId))
  }
  if (filters.clientId) {
    conditions.push(eq(clickupDailyRollups.clientId, filters.clientId))
  }
  if (filters.clientServiceId) {
    conditions.push(eq(clickupDailyRollups.clientServiceId, filters.clientServiceId))
  }
  if (filters.attributionStatus) {
    conditions.push(eq(clickupDailyRollups.attributionStatus, filters.attributionStatus))
  }

  const rows = await db
    .select({
      clickupUserId: clickupDailyRollups.clickupUserId,
      clickupUserName: clickupDailyRollups.clickupUserName,
      teamMemberId: clickupDailyRollups.teamMemberId,
      teamMemberName: teamMembers.name,
      teamMemberPosition: teamMembers.position,
      clientId: clickupDailyRollups.clientId,
      clientName: clients.name,
      clientServiceId: clickupDailyRollups.clientServiceId,
      clientServiceName: clientServices.serviceTitle,
      attributionStatus: clickupDailyRollups.attributionStatus,
      totalDurationMs: sql<string>`sum(${clickupDailyRollups.totalDurationMs})`,
      totalEntries: sql<number>`sum(${clickupDailyRollups.entryCount})`,
    })
    .from(clickupDailyRollups)
    .leftJoin(teamMembers, eq(clickupDailyRollups.teamMemberId, teamMembers.id))
    .leftJoin(clients, eq(clickupDailyRollups.clientId, clients.id))
    .leftJoin(clientServices, eq(clickupDailyRollups.clientServiceId, clientServices.id))
    .where(and(...conditions))
    .groupBy(
      clickupDailyRollups.clickupUserId,
      clickupDailyRollups.clickupUserName,
      clickupDailyRollups.teamMemberId,
      teamMembers.name,
      teamMembers.position,
      clickupDailyRollups.clientId,
      clients.name,
      clickupDailyRollups.clientServiceId,
      clientServices.serviceTitle,
      clickupDailyRollups.attributionStatus,
    )
    .orderBy(desc(sql`sum(${clickupDailyRollups.totalDurationMs})`))

  const [summary] = await db
    .select({
      totalDurationMs: sql<string>`coalesce(sum(${clickupDailyRollups.totalDurationMs}), 0)`,
      totalEntries: sql<number>`coalesce(sum(${clickupDailyRollups.entryCount}), 0)`,
      mappedMembers: sql<number>`count(distinct ${clickupDailyRollups.teamMemberId}) filter (where ${clickupDailyRollups.teamMemberId} is not null)`,
    })
    .from(clickupDailyRollups)
    .where(and(...conditions))

  return {
    summary: {
      totalDurationMs: decimalToNumber(summary?.totalDurationMs),
      totalHours: msToHours(summary?.totalDurationMs),
      totalEntries: Number(summary?.totalEntries || 0),
      mappedMembers: Number(summary?.mappedMembers || 0),
    },
    rows: rows.map((row) => ({
      ...row,
      totalDurationMs: decimalToNumber(row.totalDurationMs),
      totalHours: msToHours(row.totalDurationMs),
    })),
  }
}

export async function getClickUpTimeEntries(filters: {
  startDate?: string
  endDate?: string
  teamMemberId?: number
  clientId?: number
  clientServiceId?: number
  attributionStatus?: 'assigned' | 'unassigned'
  page?: number
  pageSize?: number
}) {
  const credentials = await getClickUpCredentials()
  if (!credentials) {
    return {
      entries: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }
  }

  const page = Math.max(filters.page || 1, 1)
  const pageSize = Math.min(Math.max(filters.pageSize || 25, 1), 100)
  const offset = (page - 1) * pageSize

  const conditions = [eq(clickupTimeEntries.workspaceId, credentials.workspaceId)]

  if (filters.startDate) {
    conditions.push(gte(clickupTimeEntries.entryDate, filters.startDate))
  }
  if (filters.endDate) {
    conditions.push(lte(clickupTimeEntries.entryDate, filters.endDate))
  }
  if (filters.teamMemberId) {
    conditions.push(eq(clickupTimeEntries.teamMemberId, filters.teamMemberId))
  }
  if (filters.clientId) {
    conditions.push(eq(clickupTimeEntries.clientId, filters.clientId))
  }
  if (filters.clientServiceId) {
    conditions.push(eq(clickupTimeEntries.clientServiceId, filters.clientServiceId))
  }
  if (filters.attributionStatus) {
    conditions.push(eq(clickupTimeEntries.attributionStatus, filters.attributionStatus))
  }

  const [totalRows, entries] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(clickupTimeEntries)
      .where(and(...conditions)),
    db
      .select({
        id: clickupTimeEntries.id,
        externalId: clickupTimeEntries.externalId,
        clickupUserId: clickupTimeEntries.clickupUserId,
        clickupUserName: clickupTimeEntries.clickupUserName,
        clickupUserEmail: clickupTimeEntries.clickupUserEmail,
        teamMemberId: clickupTimeEntries.teamMemberId,
        teamMemberName: teamMembers.name,
        clientId: clickupTimeEntries.clientId,
        clientName: clients.name,
        clientServiceId: clickupTimeEntries.clientServiceId,
        clientServiceName: clientServices.serviceTitle,
        attributionStatus: clickupTimeEntries.attributionStatus,
        taskId: clickupTimeEntries.taskId,
        taskName: clickupTimeEntries.taskName,
        taskStatus: clickupTimeEntries.taskStatus,
        listName: clickupTimeEntries.listName,
        folderName: clickupTimeEntries.folderName,
        spaceName: clickupTimeEntries.spaceName,
        durationMs: clickupTimeEntries.durationMs,
        isBillable: clickupTimeEntries.isBillable,
        startAt: clickupTimeEntries.startAt,
        endAt: clickupTimeEntries.endAt,
        entryDate: clickupTimeEntries.entryDate,
        tags: clickupTimeEntries.tags,
        sourceUpdatedAt: clickupTimeEntries.sourceUpdatedAt,
      })
      .from(clickupTimeEntries)
      .leftJoin(teamMembers, eq(clickupTimeEntries.teamMemberId, teamMembers.id))
      .leftJoin(clients, eq(clickupTimeEntries.clientId, clients.id))
      .leftJoin(clientServices, eq(clickupTimeEntries.clientServiceId, clientServices.id))
      .where(and(...conditions))
      .orderBy(desc(clickupTimeEntries.entryDate), desc(clickupTimeEntries.startAt), desc(clickupTimeEntries.updatedAt))
      .limit(pageSize)
      .offset(offset),
  ])

  const total = Number(totalRows[0]?.count || 0)

  return {
    entries: entries.map((entry) => ({
      ...entry,
      durationMs: decimalToNumber(entry.durationMs),
      durationHours: msToHours(entry.durationMs),
      startAt: entry.startAt ? entry.startAt.toISOString() : null,
      endAt: entry.endAt ? entry.endAt.toISOString() : null,
      sourceUpdatedAt: entry.sourceUpdatedAt ? entry.sourceUpdatedAt.toISOString() : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getClickUpComplianceOverview(params?: {
  rangePreset?: ComplianceRangePreset
  startDate?: string
  endDate?: string
}): Promise<ClickUpComplianceResponse> {
  const credentials = await getClickUpCredentials()
  const rangePreset = params?.rangePreset ?? 'last_month'
  const now = new Date()
  const fallbackToday = toDateOnlyUTC(now)
  const bounds = resolveComplianceRange(rangePreset, params?.startDate, params?.endDate, now)

  if (!credentials) {
    return {
      generatedAt: now.toISOString(),
      report: {
        rangePreset,
        label: bounds.label,
        startDate: fallbackToday,
        endDate: fallbackToday,
        totalTeamMembers: 0,
        totalExpectedHours: 0,
        totalTrackedHours: 0,
        totalMissingHours: 0,
        missingMembers: 0,
        rows: [],
      },
    }
  }

  const [members, rollups, leaves, mappings] = await Promise.all([
    db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        position: teamMembers.position,
        status: teamMembers.status,
        isBillable: teamMembers.isBillable,
        startDate: teamMembers.startDate,
      })
      .from(teamMembers)
      .where(and(
        eq(teamMembers.isBillable, true),
        ne(teamMembers.status, 'unavailable'),
        lte(teamMembers.startDate, bounds.endDate),
      )),
    db
      .select({
        teamMemberId: clickupDailyRollups.teamMemberId,
        rollupDate: clickupDailyRollups.rollupDate,
        totalDurationMs: sql<string>`sum(${clickupDailyRollups.totalDurationMs})`,
      })
      .from(clickupDailyRollups)
      .where(and(
        eq(clickupDailyRollups.workspaceId, credentials.workspaceId),
        gte(clickupDailyRollups.rollupDate, bounds.startDate),
        lte(clickupDailyRollups.rollupDate, bounds.endDate),
        sql`${clickupDailyRollups.teamMemberId} is not null`,
      ))
      .groupBy(clickupDailyRollups.teamMemberId, clickupDailyRollups.rollupDate),
    db
      .select({
        employeeId: leaveRequests.employeeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
      })
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.status, 'approved'),
        gte(leaveRequests.endDate, bounds.startDate),
        lte(leaveRequests.startDate, bounds.endDate),
      )),
    db
      .select({
        teamMemberId: clickupMemberMappings.teamMemberId,
        clickupUserId: clickupMemberMappings.clickupUserId,
        clickupUserName: clickupMemberMappings.clickupUserName,
      })
      .from(clickupMemberMappings)
      .where(eq(clickupMemberMappings.workspaceId, credentials.workspaceId)),
  ])

  const trackedByMemberAndDate = new Map<number, Map<string, number>>()
  for (const rollup of rollups) {
    if (rollup.teamMemberId === null) {
      continue
    }

    const memberMap = trackedByMemberAndDate.get(rollup.teamMemberId) ?? new Map<string, number>()
    memberMap.set(rollup.rollupDate, (memberMap.get(rollup.rollupDate) ?? 0) + msToHours(rollup.totalDurationMs))
    trackedByMemberAndDate.set(rollup.teamMemberId, memberMap)
  }

  const mappingByTeamMemberId = new Map(mappings.map((mapping) => [mapping.teamMemberId, mapping]))

  const rows = members.map((member) => {
    const effectiveStart = maxDateOnly(member.startDate, bounds.startDate)
    const workdays = countWeekdaysInRange(effectiveStart, bounds.endDate)

    const leaveDays = leaves
      .filter((leave) => leave.employeeId === member.id)
      .reduce((sum, leave) => sum + calculateLeaveDaysInPeriod(leave, bounds.startDate, bounds.endDate), 0)

    const minimumDays = Math.max(workdays - leaveDays, 0)
    const minimumHours = minimumDays * 6.5

    const trackedHours = (() => {
      const memberMap = trackedByMemberAndDate.get(member.id)
      if (!memberMap) {
        return 0
      }

      let total = 0
      for (const [date, hours] of memberMap.entries()) {
        if (compareDateOnly(date, bounds.startDate) >= 0 && compareDateOnly(date, bounds.endDate) <= 0) {
          total += hours
        }
      }
      return total
    })()

    const differenceHours = trackedHours - minimumHours
    const missingHours = Math.max(minimumHours - trackedHours, 0)
    const differencePercent = minimumHours > 0 ? (differenceHours / minimumHours) * 100 : null
    const mapping = mappingByTeamMemberId.get(member.id)
    const status: ComplianceStatus = minimumHours <= 0
      ? 'no_expected_hours'
      : !mapping
        ? 'unmapped'
        : trackedHours + 0.0001 >= minimumHours
          ? 'on_track'
          : 'missing'

    return {
      teamMemberId: member.id,
      teamMemberName: member.name,
      teamMemberPosition: member.position,
      teamMemberStatus: member.status,
      isBillable: member.isBillable,
      clickupUserId: mapping?.clickupUserId ?? null,
      clickupUserName: mapping?.clickupUserName ?? null,
      minimumDays,
      leaveDays,
      minimumHours,
      trackedHours,
      missingHours,
      differenceHours,
      differencePercent,
      status,
    }
  }).sort((a, b) => {
    if (a.status === 'missing' && b.status !== 'missing') return -1
    if (a.status !== 'missing' && b.status === 'missing') return 1
    return a.differenceHours - b.differenceHours
  })

  const totalExpectedHours = rows.reduce((sum, row) => sum + row.minimumHours, 0)
  const totalTrackedHours = rows.reduce((sum, row) => sum + row.trackedHours, 0)
  const totalMissingHours = rows.reduce((sum, row) => sum + row.missingHours, 0)

  return {
    generatedAt: now.toISOString(),
    report: {
      rangePreset,
      label: bounds.label,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      totalTeamMembers: rows.length,
      totalExpectedHours,
      totalTrackedHours,
      totalMissingHours,
      missingMembers: rows.filter((row) => row.status === 'missing' || row.status === 'unmapped').length,
      rows,
    },
  }
}

async function runScheduledSync() {
  try {
    const status = await getClickUpStatus()
    if (!status.isConnected || status.runningSync) {
      return
    }

    await syncClickUpTimeEntries('scheduled')
  } catch (error) {
    console.error('[ClickUp Scheduler] Scheduled sync failed:', error)
  }
}

export function startClickUpScheduler() {
  if (schedulerStarted) {
    return
  }

  schedulerStarted = true
  setInterval(() => {
    void runScheduledSync()
  }, SCHEDULE_INTERVAL_MS)
}
