import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  clientServices,
  clients,
  projectBotSlackRequests,
  projectBotTaskSnapshots,
  serviceTypes,
} from '../db/schema.js'
import { clickupRequest, getClickUpCredentials } from './clickup.js'
import { isProjectBotSlackConfigured, postSlackMessage } from './slackBot.js'

export type ProjectTaskStatus =
  | 'COMPLETED'
  | 'LIVE_REVIEW'
  | 'PUSH_LIVE'
  | 'IN_PROGRESS'
  | 'ON_CLIENT_CLARIFICATION'
  | 'TO_DO'
  | 'PAUSED'
  | 'UNKNOWN'

export type ProjectCommand =
  | { kind: 'now' }
  | { kind: 'sprint' }
  | { kind: 'done' }
  | { kind: 'review' }
  | { kind: 'remaining' }
  | { kind: 'member'; memberName: string }
  | { kind: 'needs-me' }
  | { kind: 'blocked' }
  | { kind: 'carryover' }
  | { kind: 'untracked' }
  | { kind: 'changes-today' }
  | { kind: 'daily' }
  | { kind: 'help' }

export type ProjectBotProject = {
  id: number
  clientId: number
  clientName: string
  serviceTitle: string | null
  serviceTypeName: string | null
  slackChannelId: string | null
  clickupListId: string | null
  clickupListName: string | null
  projectBotEnabled: boolean
  projectBotDailyUpdateEnabled: boolean
  projectBotDailyUpdateTime: string
  projectBotTimezone: string
  projectBotAuthorizedSlackUserIds: string[]
  projectBotLastDailyUpdateAt: Date | null
}

type ClickUpAssignee = {
  id?: number | string
  username?: string
  name?: string
  email?: string
}

type ClickUpCustomField = {
  name?: string
  value?: unknown
  type?: string
  type_config?: {
    options?: Array<{ id?: string; name?: string; label?: string; orderindex?: number }>
  }
}

export type ClickUpProjectTask = {
  id: string
  name: string
  url?: string
  description?: string
  text_content?: string
  status?: { status?: string; type?: string; color?: string } | string
  priority?: { priority?: string; color?: string } | null
  assignees?: ClickUpAssignee[]
  tags?: Array<{ name?: string } | string>
  dependencies?: unknown[]
  custom_fields?: ClickUpCustomField[]
  date_created?: string
  date_updated?: string
  date_done?: string | null
  date_closed?: string | null
  due_date?: string | null
}

type ClickUpList = {
  id: string
  name: string
  start_date?: string | null
  due_date?: string | null
  status?: { status?: string } | null
}

type ProjectData = {
  list: ClickUpList
  tasks: ClickUpProjectTask[]
}

export const PROJECT_BOT_DEFAULT_TAG = 'cursprint'

export function normalizeClickUpListInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  let candidate = trimmed
  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/v\/(?:li|l)\/([^/?#]+)/i)
    if (pathMatch?.[1]) candidate = decodeURIComponent(pathMatch[1])
  } catch {
    // Plain List IDs are accepted without URL parsing.
  }

  const listViewMatch = candidate.match(/^6-(\d+)-\d+$/)
  return listViewMatch?.[1] ?? candidate
}

type SnapshotState = {
  carryoverCount: number
  changed: boolean
  previousStatus: ProjectTaskStatus | null
}

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  COMPLETED: 'Completed',
  LIVE_REVIEW: 'Live Review',
  PUSH_LIVE: 'Push Live',
  IN_PROGRESS: 'In Progress',
  ON_CLIENT_CLARIFICATION: 'On Client Clarification',
  TO_DO: 'To Do',
  PAUSED: 'Paused',
  UNKNOWN: 'Unmapped status',
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'been', 'being', 'can', 'could', 'for', 'from',
  'have', 'into', 'just', 'need', 'please', 'should', 'that', 'the', 'their', 'then', 'there', 'this',
  'was', 'were', 'what', 'when', 'where', 'which', 'with', 'would', 'your', 'you',
])

function normalizeWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeProjectStatus(value: unknown): ProjectTaskStatus {
  const normalized = normalizeWords(typeof value === 'string' ? value : '')

  if (['completed', 'complete', 'production verified', 'verified in production'].includes(normalized)) return 'COMPLETED'
  if (['live review', 'client review', 'qa review', 'ready for review'].includes(normalized)) return 'LIVE_REVIEW'
  if (['push live', 'ready for production', 'ready to deploy'].includes(normalized)) return 'PUSH_LIVE'
  if (['in progress', 'doing', 'active'].includes(normalized)) return 'IN_PROGRESS'
  if (['on client clarification', 'client clarification', 'needs clarification', 'waiting for client'].includes(normalized)) return 'ON_CLIENT_CLARIFICATION'
  if (['to do', 'todo', 'open', 'backlog', 'new'].includes(normalized)) return 'TO_DO'
  if (['paused', 'on hold'].includes(normalized)) return 'PAUSED'
  return 'UNKNOWN'
}

function rawTaskStatus(task: ClickUpProjectTask): string {
  if (typeof task.status === 'string') return task.status
  return task.status?.status || task.status?.type || ''
}

function fieldValue(field: ClickUpCustomField): string {
  if (field.value === null || field.value === undefined) return ''
  if (typeof field.value === 'string' || typeof field.value === 'number' || typeof field.value === 'boolean') {
    const option = field.type_config?.options?.find((candidate) => String(candidate.id) === String(field.value))
    return option?.name || option?.label || String(field.value)
  }
  if (Array.isArray(field.value)) return field.value.map(String).join(', ')
  return JSON.stringify(field.value)
}

function customField(task: ClickUpProjectTask, patterns: RegExp[]): string {
  const field = task.custom_fields?.find((candidate) => patterns.some((pattern) => pattern.test(candidate.name || '')))
  return field ? fieldValue(field).trim() : ''
}

export function taskStatus(task: ClickUpProjectTask): ProjectTaskStatus {
  const normalized = normalizeProjectStatus(rawTaskStatus(task))
  if (normalized !== 'COMPLETED') return normalized

  const verification = customField(task, [/production.*verif/i, /verified.*production/i, /release.*verif/i])
  const tags = (task.tags || []).map((tag) => typeof tag === 'string' ? tag : tag.name || '').join(' ')
  const hasExplicitVerification = /^(true|yes|verified|complete|completed)$/i.test(verification)
    || /production[-\s]?verified/i.test(tags)

  // An explicit COMPLETED ClickUp workflow status is itself an authorized verification gate.
  return normalizeWords(rawTaskStatus(task)) === 'completed' || hasExplicitVerification
    ? 'COMPLETED'
    : 'LIVE_REVIEW'
}

function dateFromClickUp(value: string | null | undefined): Date | null {
  if (!value) return null
  const numeric = Number(value)
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function taskOwners(task: ClickUpProjectTask): string[] {
  return (task.assignees || []).map((assignee) => assignee.username || assignee.name || assignee.email || String(assignee.id || 'Unknown'))
}

function taskPriority(task: ClickUpProjectTask): string {
  return task.priority?.priority || 'No priority'
}

function taskUrl(task: ClickUpProjectTask): string {
  return task.url || `https://app.clickup.com/t/${encodeURIComponent(task.id)}`
}

function projectName(project: ProjectBotProject): string {
  return project.serviceTitle || project.serviceTypeName || `${project.clientName} project`
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function ageInDays(date: Date | null, now = new Date()): number | null {
  return date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000)) : null
}

function taskNextAction(task: ClickUpProjectTask): string {
  const explicit = customField(task, [/next action/i, /next step/i])
  if (explicit) return explicit

  switch (taskStatus(task)) {
    case 'COMPLETED': return 'No action — production verified'
    case 'LIVE_REVIEW': return 'Stakeholder or QA review and acceptance'
    case 'PUSH_LIVE': return 'Deploy to production, then verify'
    case 'IN_PROGRESS': return 'Owner to continue and post the next meaningful update'
    case 'ON_CLIENT_CLARIFICATION': return 'Stakeholder to answer the open question'
    case 'TO_DO': return 'Confirm owner and start when prioritized'
    case 'PAUSED': return 'Decide whether to resume, defer, or remove'
    default: return 'Map this ClickUp status to the project workflow'
  }
}

function taskBlocker(task: ClickUpProjectTask): string | null {
  const explicit = customField(task, [/blocker/i, /blocked reason/i, /waiting on/i])
  if (explicit) return explicit
  if (taskStatus(task) === 'ON_CLIENT_CLARIFICATION') return 'Waiting for client clarification'
  if (taskStatus(task) === 'PAUSED') return 'Work is paused'
  if ((task.dependencies || []).length > 0) return 'Has unresolved ClickUp dependencies'
  return null
}

function taskRisk(task: ClickUpProjectTask, now = new Date()): string | null {
  const status = taskStatus(task)
  if (status === 'COMPLETED') return null
  const due = dateFromClickUp(task.due_date)
  if (due && due.getTime() < now.getTime()) return `Overdue by ${ageInDays(due, now)}d`
  const blocker = taskBlocker(task)
  if (blocker) return blocker
  const updateAge = ageInDays(dateFromClickUp(task.date_updated), now)
  if (updateAge !== null && updateAge >= 7) return `No ClickUp update for ${updateAge}d`
  return null
}

function meaningfulUpdate(task: ClickUpProjectTask): string {
  const updated = dateFromClickUp(task.date_updated)
  const age = ageInDays(updated)
  if (!updated || age === null) return 'No update timestamp in ClickUp'
  if (age === 0) return 'ClickUp updated today'
  if (age === 1) return 'ClickUp updated yesterday'
  return `ClickUp updated ${age}d ago`
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function formatTask(task: ClickUpProjectTask, options?: { compact?: boolean; snapshot?: SnapshotState }): string {
  const owners = taskOwners(task)
  const risk = taskRisk(task)
  const carryover = options?.snapshot?.carryoverCount
    ? ` · ↪ ${options.snapshot.carryoverCount} carryover${options.snapshot.carryoverCount === 1 ? '' : 's'}`
    : ''
  const firstLine = `• <${taskUrl(task)}|${escapeSlack(truncate(task.name, 90))}> — ${owners.length ? escapeSlack(owners.join(', ')) : '_Unassigned_'} · ${escapeSlack(taskPriority(task))}${carryover}`
  if (options?.compact) return `${firstLine}${risk ? ` · ⚠ ${escapeSlack(risk)}` : ''}`

  return `${firstLine}\n  ${meaningfulUpdate(task)} · Next: ${escapeSlack(truncate(taskNextAction(task), 130))}${risk ? ` · ⚠ ${escapeSlack(risk)}` : ''}`
}

function section(title: string, tasks: ClickUpProjectTask[], snapshots: Map<string, SnapshotState>, empty = 'None'): string {
  if (tasks.length === 0) return `*${title}*\n_${empty}_`
  const visible = tasks.slice(0, 12)
  const overflow = tasks.length > visible.length ? `\n_+${tasks.length - visible.length} more in ClickUp_` : ''
  return `*${title} (${tasks.length})*\n${visible.map((task) => formatTask(task, { snapshot: snapshots.get(task.id) })).join('\n')}${overflow}`
}

function capSlackText(value: string): string {
  return value.length <= 3900 ? value : `${value.slice(0, 3820)}\n_Report shortened. Open ClickUp for the complete list._`
}

function taskGoal(task: ClickUpProjectTask): string | null {
  return customField(task, [/sprint goal/i, /product outcome/i, /^goal$/i]) || null
}

async function fetchProjectData(project: ProjectBotProject): Promise<ProjectData> {
  if (!project.clickupListId) throw new Error('This project has no ClickUp List configured.')
  const credentials = await getClickUpCredentials()
  if (!credentials) throw new Error('ClickUp is not connected in Vestov Hub.')

  const listId = encodeURIComponent(project.clickupListId)
  const list = await clickupRequest<ClickUpList>(`/list/${listId}`, credentials.apiToken)
  const tasks: ClickUpProjectTask[] = []

  for (let page = 0; page < 100; page += 1) {
    const payload = await clickupRequest<{ tasks?: ClickUpProjectTask[] }>(`/list/${listId}/task`, credentials.apiToken, {
      archived: false,
      include_closed: true,
      subtasks: true,
      include_timl: true,
      'tags[]': PROJECT_BOT_DEFAULT_TAG,
      page,
    })
    const pageTasks = Array.isArray(payload.tasks) ? payload.tasks : []
    tasks.push(...pageTasks)
    if (pageTasks.length < 100) break
  }

  return { list, tasks }
}

async function syncTaskSnapshots(project: ProjectBotProject, tasks: ClickUpProjectTask[]): Promise<Map<string, SnapshotState>> {
  if (!project.clickupListId) return new Map()
  const existing = await db
    .select()
    .from(projectBotTaskSnapshots)
    .where(eq(projectBotTaskSnapshots.clientServiceId, project.id))
  const byTask = new Map(existing.map((row) => [row.clickupTaskId, row]))
  const now = new Date()
  const result = new Map<string, SnapshotState>()

  await Promise.all(tasks.map(async (task) => {
    const currentStatus = taskStatus(task)
    const row = byTask.get(task.id)
    const statusChangedNow = Boolean(row && row.currentStatus !== currentStatus)
    const changedSinceReport = Boolean(row && (
      row.lastReportedStatus
        ? row.lastReportedStatus !== currentStatus
        : statusChangedNow
    ))
    const listChanged = Boolean(row && row.clickupListId !== project.clickupListId)
    const carryoverCount = (row?.carryoverCount || 0) + (listChanged ? 1 : 0)

    result.set(task.id, {
      carryoverCount,
      changed: changedSinceReport,
      previousStatus: row ? normalizeProjectStatus(row.lastReportedStatus || row.currentStatus) : null,
    })

    const values = {
      clickupListId: project.clickupListId!,
      taskName: task.name,
      currentStatus,
      ownerNames: taskOwners(task),
      priority: taskPriority(task),
      sourceUpdatedAt: dateFromClickUp(task.date_updated),
      sourceDoneAt: dateFromClickUp(task.date_done || task.date_closed),
      lastSeenAt: now,
      carryoverCount,
      updatedAt: now,
    }

    if (row) {
      await db
        .update(projectBotTaskSnapshots)
        .set({
          ...values,
          previousStatus: statusChangedNow ? row.currentStatus : row.previousStatus,
          lastStatusChangedAt: statusChangedNow ? now : row.lastStatusChangedAt,
        })
        .where(eq(projectBotTaskSnapshots.id, row.id))
      return
    }

    await db
      .insert(projectBotTaskSnapshots)
      .values({
        clientServiceId: project.id,
        clickupTaskId: task.id,
        ...values,
      })
      .onConflictDoNothing()
  }))

  return result
}

async function untrackedRequests(projectId: number) {
  return db
    .select()
    .from(projectBotSlackRequests)
    .where(and(
      eq(projectBotSlackRequests.clientServiceId, projectId),
      eq(projectBotSlackRequests.status, 'pending'),
    ))
    .orderBy(desc(projectBotSlackRequests.createdAt))
}

function sprintStart(data: ProjectData): Date | null {
  return dateFromClickUp(data.list.start_date)
}

function sprintGoalSummary(tasks: ClickUpProjectTask[]): string | null {
  const groups = new Map<string, ClickUpProjectTask[]>()
  for (const task of tasks) {
    const goal = taskGoal(task)
    if (!goal) continue
    groups.set(goal, [...(groups.get(goal) || []), task])
  }
  if (groups.size === 0) return null

  return Array.from(groups.entries()).slice(0, 6).map(([goal, goalTasks]) => {
    const completed = goalTasks.filter((task) => taskStatus(task) === 'COMPLETED').length
    const risks = goalTasks.filter((task) => taskRisk(task)).length
    return `• ${escapeSlack(goal)} — ${completed}/${goalTasks.length} verified${risks ? ` · ⚠ ${risks} at risk` : ''}`
  }).join('\n')
}

export function parseProjectCommand(input: string): ProjectCommand {
  const cleaned = normalizeWords(input.replace(/<@[A-Z0-9]+>/gi, ''))
  if (!cleaned || cleaned === 'help' || cleaned === 'commands') return { kind: 'help' }
  const workingMember = cleaned.match(/(?:what\s+is|what\s+are|how\s+is)\s+([a-z][a-z' -]{1,40}?)\s+(?:working|doing|assigned)/)
  if (workingMember?.[1]) return { kind: 'member', memberName: workingMember[1].trim() }
  if (/^(now|current|current work)$/.test(cleaned) || /what.*(working|happening|now)/.test(cleaned)) return { kind: 'now' }
  if (/sprint/.test(cleaned)) return { kind: 'sprint' }
  if (/^(done|completed|complete)$/.test(cleaned) || /what.*(done|completed)/.test(cleaned)) return { kind: 'done' }
  if (/review/.test(cleaned)) return { kind: 'review' }
  if (/remain|unfinished|left/.test(cleaned)) return { kind: 'remaining' }
  if (/needs me|my attention|attention/.test(cleaned)) return { kind: 'needs-me' }
  if (/block|risk/.test(cleaned)) return { kind: 'blocked' }
  if (/carryover|carry over|aging|ageing|stale/.test(cleaned)) return { kind: 'carryover' }
  if (/untracked|without task|not tracked/.test(cleaned)) return { kind: 'untracked' }
  if (/changes today|changed today|today changes|since yesterday/.test(cleaned)) return { kind: 'changes-today' }

  const explicitMember = cleaned.match(/(?:for|is|about)\s+([a-z][a-z' -]{1,40}?)(?:\s+working|\s+tasks?|$)/)
  const memberName = explicitMember?.[1]?.trim() || cleaned.replace(/\s+tasks?$/, '').trim()
  if (memberName && memberName.split(' ').length <= 4) return { kind: 'member', memberName }
  return { kind: 'help' }
}

function helpReport(project: ProjectBotProject): string {
  return `*${escapeSlack(projectName(project))} — Project bot commands*\n` +
    '`/project now` · `/project sprint` · `/project done` · `/project review` · `/project remaining`\n' +
    '`/project <name>` · `/project needs-me` · `/project blocked` · `/project carryover`\n' +
    '`/project untracked` · `/project changes-today`\n' +
    '_You can also mention the bot and ask the same questions in plain language._'
}

export async function buildProjectReport(project: ProjectBotProject, command: ProjectCommand): Promise<string> {
  if (command.kind === 'help') return helpReport(project)

  if (command.kind === 'untracked') {
    const requests = await untrackedRequests(project.id)
    const lines = requests.slice(0, 20).map((request) => {
      const age = ageInDays(request.createdAt) || 0
      const match = request.matchedTaskUrl && request.matchedTaskName
        ? ` · possible <${request.matchedTaskUrl}|${escapeSlack(request.matchedTaskName)}>`
        : ''
      return `• ${escapeSlack(truncate(request.requestText, 150))} — ${request.classification} · ${age}d waiting${match}`
    })
    return capSlackText(`*${escapeSlack(projectName(project))}* · ClickUp: ${escapeSlack(project.clickupListName || project.clickupListId || 'not configured')} · Tag: ${PROJECT_BOT_DEFAULT_TAG}\n` +
      `*Slack requests without a confirmed task (${requests.length})*\n${lines.join('\n') || '_None_'}${requests.length > lines.length ? `\n_+${requests.length - lines.length} more_` : ''}`)
  }

  const data = await fetchProjectData(project)
  const snapshots = await syncTaskSnapshots(project, data.tasks)
  const tasks = data.tasks
  const title = `*${escapeSlack(projectName(project))}* · ClickUp: ${escapeSlack(data.list.name)} · Tag: ${PROJECT_BOT_DEFAULT_TAG}`
  const byStatus = (status: ProjectTaskStatus) => tasks.filter((task) => taskStatus(task) === status)
  const completed = byStatus('COMPLETED')
  const liveReview = byStatus('LIVE_REVIEW')
  const remaining = tasks.filter((task) => taskStatus(task) !== 'COMPLETED')
  const risks = remaining.filter((task) => taskRisk(task))
  const unknown = byStatus('UNKNOWN')
  const warning = unknown.length
    ? `\n⚠ ${unknown.length} task${unknown.length === 1 ? ' has' : 's have'} an unmapped ClickUp status; they remain unfinished until mapped.`
    : ''

  if (command.kind === 'now') {
    const active = tasks.filter((task) => ['IN_PROGRESS', 'PUSH_LIVE'].includes(taskStatus(task)))
    return capSlackText(`${title}\n${section('Current work', active, snapshots, 'No tasks are marked In Progress or Push Live.')}${warning}`)
  }

  if (command.kind === 'done') {
    return capSlackText(`${title}\n${section('Completed and production verified', completed, snapshots, 'No production-verified tasks in this sprint.')}${warning}`)
  }

  if (command.kind === 'review') {
    return capSlackText(`${title}\n${section('Live Review', liveReview, snapshots, 'Nothing is waiting for review.')}${warning}`)
  }

  if (command.kind === 'remaining') {
    return capSlackText(`${title}\n${section('Remaining sprint work', remaining, snapshots, 'No unfinished tasks.')}${warning}`)
  }

  if (command.kind === 'blocked') {
    return capSlackText(`${title}\n${section('Blocked or at risk', risks, snapshots, 'No blockers or schedule risks detected.')}${warning}`)
  }

  if (command.kind === 'needs-me') {
    const attention = tasks.filter((task) => ['LIVE_REVIEW', 'ON_CLIENT_CLARIFICATION'].includes(taskStatus(task)))
    return capSlackText(`${title}\n${section('Needs your attention', attention, snapshots, 'No stakeholder decisions or reviews are waiting.')}${warning}`)
  }

  if (command.kind === 'member') {
    const needle = normalizeWords(command.memberName)
    const assigned = tasks.filter((task) => taskOwners(task).some((owner) => normalizeWords(owner).includes(needle)))
    if (assigned.length === 0) {
      return `${title}\n_No tasks found for “${escapeSlack(command.memberName)}”. Names are matched against ClickUp assignees._`
    }
    const memberSections: string[] = []
    for (const status of ['IN_PROGRESS', 'PUSH_LIVE', 'LIVE_REVIEW', 'ON_CLIENT_CLARIFICATION', 'PAUSED', 'TO_DO', 'COMPLETED', 'UNKNOWN'] as ProjectTaskStatus[]) {
      const statusTasks = assigned.filter((task) => taskStatus(task) === status)
      if (statusTasks.length) memberSections.push(section(STATUS_LABELS[status], statusTasks, snapshots))
    }
    return capSlackText(`${title}\n*${escapeSlack(command.memberName)} — ${assigned.length} tasks*\n${memberSections.join('\n\n')}${warning}`)
  }

  if (command.kind === 'carryover') {
    const start = sprintStart(data)
    const carryover = remaining.filter((task) => {
      const known = snapshots.get(task.id)?.carryoverCount || 0
      const created = dateFromClickUp(task.date_created)
      return known > 0 || Boolean(start && created && created < start) || (ageInDays(dateFromClickUp(task.date_updated)) || 0) >= 7
    })
    const historyNote = start
      ? '_Carryover uses observed List changes plus tasks created before the ClickUp List start date. Counts begin when the bot starts tracking._'
      : '_This ClickUp List has no start date. Aging is shown, but historical sprint carryover cannot be inferred safely._'
    return capSlackText(`${title}\n${section('Carryover and aging', carryover, snapshots, 'No carryover or aging tasks detected.')}\n${historyNote}${warning}`)
  }

  const now = new Date()
  const since = command.kind === 'daily' && project.projectBotLastDailyUpdateAt
    ? project.projectBotLastDailyUpdateAt
    : new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const changed = tasks.filter((task) => {
    const updated = dateFromClickUp(task.date_updated)
    return snapshots.get(task.id)?.changed || Boolean(updated && updated >= since)
  })

  if (command.kind === 'changes-today') {
    return capSlackText(`${title}\n${section('ClickUp task changes since the previous day', changed, snapshots, 'No task changes detected.')}${warning}`)
  }

  if (command.kind === 'sprint') {
    const percentage = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0
    const start = sprintStart(data)
    const addedAfterStart = start
      ? tasks.filter((task) => (dateFromClickUp(task.date_created)?.getTime() || 0) > start.getTime())
      : []
    const goals = sprintGoalSummary(tasks)
    return capSlackText(`${title}\n` +
      `*Sprint health*\n${tasks.length} committed · ${completed.length} verified (${percentage}%) · ${liveReview.length} in review · ${remaining.length} remaining · ${risks.length} at risk` +
      `${start ? ` · ${addedAfterStart.length} added after start` : ''}\n\n` +
      `${section('Completed', completed, snapshots)}\n\n${section('Live Review', liveReview, snapshots)}\n\n${section('Remaining', remaining, snapshots)}` +
      `${goals ? `\n\n*Sprint goals*\n${goals}` : '\n\n⚠ No Sprint Goal or Product Outcome custom field is populated.'}` +
      `${start ? '' : '\n⚠ The ClickUp List has no sprint start date, so scope-added and carryover counts are unavailable.'}${warning}`)
  }

  const movedToReview = changed.filter((task) => snapshots.get(task.id)?.changed && taskStatus(task) === 'LIVE_REVIEW')
  const completedSince = completed.filter((task) => {
    const doneAt = dateFromClickUp(task.date_done || task.date_closed || task.date_updated)
    return Boolean(doneAt && doneAt >= since)
  })
  const active = tasks.filter((task) => taskStatus(task) === 'IN_PROGRESS')
  const attention = tasks.filter((task) => ['LIVE_REVIEW', 'ON_CLIENT_CLARIFICATION'].includes(taskStatus(task)))
  const scopeChanges = tasks.filter((task) => {
    const created = dateFromClickUp(task.date_created)
    return Boolean(created && created >= since)
  })

  return capSlackText(`${title}\n*Daily project update*\n` +
    `${section('Completed and verified', completedSince, snapshots)}\n\n` +
    `${section('Moved to Live Review', movedToReview, snapshots)}\n\n` +
    `${section('In progress', active, snapshots)}\n\n` +
    `${section('Blocked or at risk', risks, snapshots)}\n\n` +
    `${section('Needs stakeholder action', attention, snapshots)}\n\n` +
    `${section('Scope added since the last update', scopeChanges, snapshots)}\n\n` +
    `${section('Next working-day priorities', tasks.filter((task) => ['PUSH_LIVE', 'IN_PROGRESS', 'TO_DO'].includes(taskStatus(task))).slice(0, 5), snapshots)}` +
    `${warning}`)
}

export async function getProjectByChannel(channelId: string): Promise<ProjectBotProject | null> {
  const [project] = await db
    .select({
      id: clientServices.id,
      clientId: clientServices.clientId,
      clientName: clients.name,
      serviceTitle: clientServices.serviceTitle,
      serviceTypeName: serviceTypes.name,
      slackChannelId: clientServices.slackChannelId,
      clickupListId: clientServices.clickupListId,
      clickupListName: clientServices.clickupListName,
      projectBotEnabled: clientServices.projectBotEnabled,
      projectBotDailyUpdateEnabled: clientServices.projectBotDailyUpdateEnabled,
      projectBotDailyUpdateTime: clientServices.projectBotDailyUpdateTime,
      projectBotTimezone: clientServices.projectBotTimezone,
      projectBotAuthorizedSlackUserIds: clientServices.projectBotAuthorizedSlackUserIds,
      projectBotLastDailyUpdateAt: clientServices.projectBotLastDailyUpdateAt,
    })
    .from(clientServices)
    .innerJoin(clients, eq(clientServices.clientId, clients.id))
    .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
    .where(and(
      eq(clientServices.slackChannelId, channelId),
      eq(clientServices.projectBotEnabled, true),
    ))
    .limit(1)

  return project ? {
    ...project,
    projectBotAuthorizedSlackUserIds: Array.isArray(project.projectBotAuthorizedSlackUserIds)
      ? project.projectBotAuthorizedSlackUserIds.filter((value): value is string => typeof value === 'string')
      : [],
  } : null
}

export async function getProjectById(projectId: number): Promise<ProjectBotProject | null> {
  const [project] = await db
    .select({
      id: clientServices.id,
      clientId: clientServices.clientId,
      clientName: clients.name,
      serviceTitle: clientServices.serviceTitle,
      serviceTypeName: serviceTypes.name,
      slackChannelId: clientServices.slackChannelId,
      clickupListId: clientServices.clickupListId,
      clickupListName: clientServices.clickupListName,
      projectBotEnabled: clientServices.projectBotEnabled,
      projectBotDailyUpdateEnabled: clientServices.projectBotDailyUpdateEnabled,
      projectBotDailyUpdateTime: clientServices.projectBotDailyUpdateTime,
      projectBotTimezone: clientServices.projectBotTimezone,
      projectBotAuthorizedSlackUserIds: clientServices.projectBotAuthorizedSlackUserIds,
      projectBotLastDailyUpdateAt: clientServices.projectBotLastDailyUpdateAt,
    })
    .from(clientServices)
    .innerJoin(clients, eq(clientServices.clientId, clients.id))
    .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
    .where(eq(clientServices.id, projectId))
    .limit(1)

  return project ? {
    ...project,
    projectBotAuthorizedSlackUserIds: Array.isArray(project.projectBotAuthorizedSlackUserIds)
      ? project.projectBotAuthorizedSlackUserIds.filter((value): value is string => typeof value === 'string')
      : [],
  } : null
}

export function detectSlackRequest(text: string): string | null {
  const normalized = normalizeWords(text.replace(/<@[A-Z0-9]+>/gi, ''))
  if (normalized.length < 12) return null
  if (/^(what|when|where|who|how)\b.*\b(status|working|done|sprint|task)/.test(normalized)) return null

  if (/\b(bug|broken|error|fails?|failing|issue|regression|not working|returned again)\b/.test(normalized)) return 'bug_report'
  if (/\b(priority|urgent|asap|deprioritize|re prioritize)\b/.test(normalized)) return 'priority_change'
  if (/\b(review|feedback|approve|reject|looks good|change requested)\b/.test(normalized)) return 'review_feedback'
  if (/\b(decide|decision|go no go|choose|confirm direction)\b/.test(normalized)) return 'product_decision'
  if (/\b(feature|request|can we|could we|please add|would like|it would be good)\b/.test(normalized)) return 'feature_request'
  if (/\b(change|adjust|update|replace|remove|rename)\b/.test(normalized)) return 'change_request'
  if (/\b(action item|todo|follow up|needs to|we should)\b/.test(normalized)) return 'action_item'
  return null
}

function tokens(value: string): Set<string> {
  return new Set(normalizeWords(value).split(' ').filter((word) => word.length > 2 && !STOP_WORDS.has(word)))
}

export function requestSimilarity(requestText: string, task: Pick<ClickUpProjectTask, 'name' | 'description' | 'text_content'>): number {
  const left = tokens(requestText)
  const right = tokens(`${task.name} ${task.description || task.text_content || ''}`)
  if (!left.size || !right.size) return 0
  const intersection = [...left].filter((word) => right.has(word)).length
  const union = new Set([...left, ...right]).size
  const jaccard = intersection / union
  const titleContainment = [...tokens(task.name)].filter((word) => left.has(word)).length / Math.max(tokens(task.name).size, 1)
  return Math.min(1, jaccard * 0.65 + titleContainment * 0.35)
}

function requestTitle(text: string): string {
  const firstLine = text.replace(/<@[A-Z0-9]+>/gi, '').split('\n')[0].trim()
  return truncate(firstLine || 'Slack request', 180)
}

function requestButtons(requestId: number, hasMatch: boolean): unknown[] {
  const elements: unknown[] = []
  if (hasMatch) {
    elements.push({
      type: 'button',
      action_id: 'project_bot_link_task',
      text: { type: 'plain_text', text: 'Link existing task' },
      value: String(requestId),
    })
  }
  elements.push({
    type: 'button',
    action_id: 'project_bot_create_task',
    text: { type: 'plain_text', text: hasMatch ? 'Create separate task' : 'Create ClickUp task' },
    style: 'primary',
    value: String(requestId),
  })
  elements.push({
    type: 'button',
    action_id: 'project_bot_dismiss_request',
    text: { type: 'plain_text', text: 'Not a task' },
    value: String(requestId),
  })
  return [{ type: 'actions', elements }]
}

export async function captureSlackRequest(event: {
  channel: string
  ts: string
  thread_ts?: string
  user: string
  text: string
}): Promise<void> {
  const classification = detectSlackRequest(event.text)
  if (!classification) return
  const project = await getProjectByChannel(event.channel)
  if (!project) return

  const data = await fetchProjectData(project)
  const ranked = data.tasks
    .map((task) => ({ task, score: requestSimilarity(event.text, task) }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  const hasPossibleMatch = Boolean(best && best.score >= 0.32)
  const isRegression = Boolean(
    classification === 'bug_report'
    && best
    && best.score >= 0.32
    && taskStatus(best.task) === 'COMPLETED',
  )
  const autoLink = Boolean(best && best.score >= 0.58 && !isRegression)

  const previousRegressionRows = isRegression && best
    ? await db.select({ id: projectBotSlackRequests.id }).from(projectBotSlackRequests).where(eq(projectBotSlackRequests.matchedTaskId, best.task.id))
    : []

  const [created] = await db
    .insert(projectBotSlackRequests)
    .values({
      clientServiceId: project.id,
      slackChannelId: event.channel,
      slackMessageTs: event.ts,
      slackThreadTs: event.thread_ts || event.ts,
      slackUserId: event.user,
      requestText: event.text,
      classification,
      status: autoLink ? 'linked' : 'pending',
      matchedTaskId: hasPossibleMatch ? best.task.id : null,
      matchedTaskName: hasPossibleMatch ? best.task.name : null,
      matchedTaskUrl: hasPossibleMatch ? taskUrl(best.task) : null,
      similarityScore: hasPossibleMatch ? best.score.toFixed(4) : null,
      clickupTaskId: autoLink ? best.task.id : null,
      clickupTaskUrl: autoLink ? taskUrl(best.task) : null,
      regressionCount: isRegression ? previousRegressionRows.length + 1 : 0,
      resolvedAt: autoLink ? new Date() : null,
    })
    .onConflictDoNothing()
    .returning()

  if (!created) return

  if (autoLink && best) {
    await postSlackMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: `This request is already tracked: ${taskUrl(best.task)}`,
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: `✅ Already tracked as <${taskUrl(best.task)}|${escapeSlack(best.task.name)}> — *${STATUS_LABELS[taskStatus(best.task)]}*.` },
      }],
    })
    return
  }

  const prefix = isRegression
    ? `⚠ This may be regression #${created.regressionCount} of <${created.matchedTaskUrl}|${escapeSlack(created.matchedTaskName || 'a completed task')}>. It must be verified again before it can return to Completed.`
    : hasPossibleMatch
      ? `I found a possible related task: <${created.matchedTaskUrl}|${escapeSlack(created.matchedTaskName || 'ClickUp task')}>.`
      : 'I could not find a related ClickUp task.'

  await postSlackMessage({
    channel: event.channel,
    thread_ts: event.thread_ts || event.ts,
    text: `${prefix} Confirm how to track this request.`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${prefix}\n*Classification:* ${classification.replace(/_/g, ' ')}\nAn authorized project user must confirm the action.` } },
      ...requestButtons(created.id, hasPossibleMatch),
    ],
  })
}

function isAuthorizedForWrites(project: ProjectBotProject, slackUserId: string): boolean {
  return project.projectBotAuthorizedSlackUserIds.includes(slackUserId)
}

export async function resolveSlackRequestAction(
  requestId: number,
  actionId: string,
  slackUserId: string,
): Promise<string> {
  const [request] = await db
    .select()
    .from(projectBotSlackRequests)
    .where(eq(projectBotSlackRequests.id, requestId))
    .limit(1)
  if (!request) throw new Error('This tracked Slack request no longer exists.')
  if (request.status !== 'pending') return 'This request has already been resolved.'

  const project = await getProjectById(request.clientServiceId)
  if (!project || !project.projectBotEnabled) throw new Error('The project bot is no longer enabled for this project.')
  if (!isAuthorizedForWrites(project, slackUserId)) {
    throw new Error('You are not authorized to create or link ClickUp tasks for this project.')
  }

  const supportedActions = new Set([
    'project_bot_dismiss_request',
    'project_bot_link_task',
    'project_bot_create_task',
  ])
  if (!supportedActions.has(actionId)) throw new Error('Unsupported project action.')
  if (actionId === 'project_bot_link_task' && (!request.matchedTaskId || !request.matchedTaskUrl)) {
    throw new Error('No existing task was selected for this request.')
  }
  if (actionId === 'project_bot_create_task' && !project.clickupListId) {
    throw new Error('This project has no ClickUp List configured.')
  }

  const credentials = actionId === 'project_bot_create_task' ? await getClickUpCredentials() : null
  if (actionId === 'project_bot_create_task' && !credentials) {
    throw new Error('ClickUp is not connected in Vestov Hub.')
  }

  const [claimed] = await db
    .update(projectBotSlackRequests)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(and(
      eq(projectBotSlackRequests.id, request.id),
      eq(projectBotSlackRequests.status, 'pending'),
    ))
    .returning({ id: projectBotSlackRequests.id })
  if (!claimed) return 'This request has already been resolved.'

  if (actionId === 'project_bot_dismiss_request') {
    await db
      .update(projectBotSlackRequests)
      .set({ status: 'dismissed', resolvedBySlackUserId: slackUserId, resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(projectBotSlackRequests.id, request.id))
    return 'Marked as not requiring a tracked task.'
  }

  if (actionId === 'project_bot_link_task') {
    await db
      .update(projectBotSlackRequests)
      .set({
        status: 'linked',
        clickupTaskId: request.matchedTaskId,
        clickupTaskUrl: request.matchedTaskUrl,
        resolvedBySlackUserId: slackUserId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectBotSlackRequests.id, request.id))
    await postSlackMessage({
      channel: request.slackChannelId,
      thread_ts: request.slackThreadTs || request.slackMessageTs,
      text: `Linked to ClickUp: ${request.matchedTaskUrl}`,
    }).catch((error) => console.error('[PROJECT BOT] Could not post linked-task confirmation:', error))
    return `Linked to ${request.matchedTaskUrl}`
  }

  const regression = request.regressionCount > 0 && Boolean(request.matchedTaskId)
  let createdTask: { id: string; url?: string }
  try {
    createdTask = await clickupRequest<{ id: string; url?: string }>(
      `/list/${encodeURIComponent(project.clickupListId!)}/task`,
      credentials!.apiToken,
      undefined,
      {
        method: 'POST',
        body: {
          name: regression ? `[Regression] ${requestTitle(request.requestText)}` : requestTitle(request.requestText),
          markdown_content: [
            request.requestText,
            '',
            '---',
            `Captured from Slack channel ${request.slackChannelId}, message ${request.slackMessageTs}.`,
            `Requested by Slack user ${request.slackUserId}.`,
            regression && request.matchedTaskUrl ? `Possible regression of ${request.matchedTaskUrl}.` : '',
          ].filter(Boolean).join('\n'),
          links_to: regression ? request.matchedTaskId : undefined,
          tags: [PROJECT_BOT_DEFAULT_TAG],
          notify_all: false,
        },
      },
    )
  } catch (error) {
    await db
      .update(projectBotSlackRequests)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(and(
        eq(projectBotSlackRequests.id, request.id),
        eq(projectBotSlackRequests.status, 'processing'),
      ))
    throw error
  }
  const url = createdTask.url || `https://app.clickup.com/t/${createdTask.id}`

  await db
    .update(projectBotSlackRequests)
    .set({
      status: 'created',
      clickupTaskId: createdTask.id,
      clickupTaskUrl: url,
      resolvedBySlackUserId: slackUserId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectBotSlackRequests.id, request.id))

  await postSlackMessage({
    channel: request.slackChannelId,
    thread_ts: request.slackThreadTs || request.slackMessageTs,
    text: `${regression ? 'Regression task' : 'ClickUp task'} created: ${url}`,
  }).catch((error) => console.error('[PROJECT BOT] Could not post created-task confirmation:', error))
  return `${regression ? 'Regression task' : 'Task'} created: ${url}`
}

async function markTasksReported(projectId: number, tasks: ClickUpProjectTask[]): Promise<void> {
  const ids = tasks.map((task) => task.id)
  if (!ids.length) return
  const now = new Date()
  await Promise.all(tasks.map((task) => db
    .update(projectBotTaskSnapshots)
    .set({ lastReportedStatus: taskStatus(task), lastReportedAt: now, updatedAt: now })
    .where(and(
      eq(projectBotTaskSnapshots.clientServiceId, projectId),
      eq(projectBotTaskSnapshots.clickupTaskId, task.id),
    ))))
}

function zonedParts(date: Date, timezone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

let schedulerStarted = false
let schedulerRunning = false

async function runDailyUpdates(): Promise<void> {
  if (schedulerRunning || !isProjectBotSlackConfigured()) return
  schedulerRunning = true
  try {
    const projects = await db
      .select({ id: clientServices.id })
      .from(clientServices)
      .where(and(
        eq(clientServices.projectBotEnabled, true),
        eq(clientServices.projectBotDailyUpdateEnabled, true),
      ))

    for (const row of projects) {
      const project = await getProjectById(row.id)
      if (!project?.slackChannelId || !project.clickupListId) continue
      let localNow: { date: string; time: string }
      try {
        localNow = zonedParts(new Date(), project.projectBotTimezone)
      } catch {
        console.warn(`[PROJECT BOT] Invalid timezone for project ${project.id}: ${project.projectBotTimezone}`)
        continue
      }
      const lastLocalDate = project.projectBotLastDailyUpdateAt
        ? zonedParts(project.projectBotLastDailyUpdateAt, project.projectBotTimezone).date
        : null
      if (localNow.time < project.projectBotDailyUpdateTime || lastLocalDate === localNow.date) continue

      try {
        const report = await buildProjectReport(project, { kind: 'daily' })
        await postSlackMessage({ channel: project.slackChannelId, text: report })
        const data = await fetchProjectData(project)
        await markTasksReported(project.id, data.tasks)
        await db
          .update(clientServices)
          .set({ projectBotLastDailyUpdateAt: new Date() })
          .where(eq(clientServices.id, project.id))
      } catch (error) {
        console.error(`[PROJECT BOT] Daily update failed for project ${project.id}:`, error)
      }
    }
  } finally {
    schedulerRunning = false
  }
}

export function startProjectBotScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true
  setInterval(() => {
    void runDailyUpdates()
  }, 60_000)
  setTimeout(() => {
    void runDailyUpdates()
  }, 10_000)
}
