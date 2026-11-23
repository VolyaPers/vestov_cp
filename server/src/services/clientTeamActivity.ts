import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clientServices, clickupMemberMappings } from '../db/schema.js'
import { clickupRequest, getClickUpCredentials } from './clickup.js'
import type { ClickUpProjectTask } from './projectBot.js'

export function isInProgress(task: ClickUpProjectTask) {
  const status = typeof task.status === 'string' ? task.status : task.status?.status
  return status?.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') === 'in progress'
}

export function assignedProgressTasks(tasks: ClickUpProjectTask[], userId: string) {
  return [...new Map(tasks.filter(task => isInProgress(task) && task.assignees?.some(person => String(person.id) === userId)).map(task => [task.id, {
    id: task.id, name: task.name, url: `https://app.clickup.com/t/${encodeURIComponent(task.id)}`,
  }])).values()]
}

export async function clientTeamActivity(clientId: number, members: { employeeId: number; projectIds: number[] }[]) {
  const credentials = await getClickUpCredentials()
  if (!credentials) return members.map(member => ({ id: member.employeeId, tasks: [], taskState: 'disconnected' }))
  const ids = [...new Set(members.flatMap(member => member.projectIds))]
  if (!ids.length) return []
  const [projects, mappings] = await Promise.all([
    db.select().from(clientServices).where(and(eq(clientServices.clientId, clientId), inArray(clientServices.id, ids))),
    db.select().from(clickupMemberMappings).where(and(eq(clickupMemberMappings.workspaceId, credentials.workspaceId), inArray(clickupMemberMappings.teamMemberId, members.map(member => member.employeeId)))),
  ])
  const lists = [...new Set(projects.flatMap(project => project.clickupListId ? [project.clickupListId] : []))]
  const results = new Map(await Promise.all(lists.map(async listId => {
    try {
      const tasks: ClickUpProjectTask[] = []
      const signal = AbortSignal.timeout(15_000)
      for (let page = 0; page < 100; page++) {
        const response = await clickupRequest<{ tasks: ClickUpProjectTask[]; last_page?: boolean }>(`/list/${encodeURIComponent(listId)}/task`, credentials.apiToken,
          { archived: false, include_closed: false, subtasks: true, include_timl: true, page }, { signal })
        if (!Array.isArray(response.tasks)) throw new Error('Invalid task response')
        tasks.push(...response.tasks)
        if (response.last_page === true || response.tasks.length < 100) return [listId, tasks] as const
      }
      throw new Error('Incomplete task response')
    } catch { return [listId, null] as const }
  })))
  return members.map(member => {
    const mapping = mappings.find(row => row.teamMemberId === member.employeeId)
    const assignedProjects = projects.filter(project => member.projectIds.includes(project.id))
    const incomplete = assignedProjects.some(project => !project.clickupListId || !results.get(project.clickupListId))
    const tasks = mapping ? assignedProjects.flatMap(project => assignedProgressTasks(results.get(project.clickupListId || '') || [], mapping.clickupUserId).map(task => ({ ...task, project: project.serviceTitle || 'Project' }))) : []
    return { id: member.employeeId, tasks: [...new Map(tasks.map(task => [task.id, task])).values()], taskState: !mapping ? 'unmapped' : incomplete ? 'unavailable' : 'ready' }
  })
}
