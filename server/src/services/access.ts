import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, clientUsers, clientServices, clientServiceTeamMembers, teamMembers } from '../db/schema.js'

export type AccessUser = { id: number; role: string; teamMemberId?: number | null; email?: string; isActive?: boolean }
export type AccessPermission = 'read' | 'write' | 'admin'
export const isValidId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export const effectiveProjectPredicate = () => and(
  eq(clientServices.isActive, true),
  sql`(${clientServices.startDate} IS NULL OR ${clientServices.startDate} <= CURRENT_DATE)`,
  sql`(${clientServices.endDate} IS NULL OR ${clientServices.endDate} >= CURRENT_DATE)`,
)

export async function resolveEmployeeId(user?: AccessUser | null): Promise<number | null> {
  if (!user || user.isActive === false || user.role !== 'team_member') return null
  // A linked ID is authoritative. Email fallback supports old unlinked accounts only.
  const predicate = isValidId(user.teamMemberId)
    ? eq(teamMembers.id, user.teamMemberId)
    : user.email ? eq(teamMembers.email, user.email.trim().toLowerCase()) : null
  if (!predicate) return null
  const [member] = await db.select({ id: teamMembers.id, status: teamMembers.status, employmentType: teamMembers.employmentType }).from(teamMembers).where(predicate).limit(1)
  return member && member.status !== 'inactive' && member.employmentType !== 'freelancer' ? member.id : null
}

export async function accessibleClientIds(user?: AccessUser | null): Promise<number[]> {
  if (!user || user.isActive === false) return []
  if (user.role === 'admin') return (await db.select({ id: clients.id }).from(clients)).map(row => row.id)
  if (user.role === 'client') {
    return (await db.select({ id: clientUsers.clientId }).from(clientUsers)
      .where(and(eq(clientUsers.userId, user.id), eq(clientUsers.isActive, true)))).map(row => row.id)
  }
  const employeeId = await resolveEmployeeId(user)
  if (!employeeId) return []
  const rows = await db.select({ id: clientServices.clientId }).from(clientServiceTeamMembers)
    .innerJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
    .where(and(eq(clientServiceTeamMembers.teamMemberId, employeeId), eq(clientServiceTeamMembers.isActive, true), effectiveProjectPredicate(), sql`${clientServiceTeamMembers.startDate} <= CURRENT_DATE`, sql`(${clientServiceTeamMembers.endDate} IS NULL OR ${clientServiceTeamMembers.endDate} >= CURRENT_DATE)`))
  return [...new Set(rows.map(row => row.id))]
}

export async function canAccessClient(user: AccessUser | null | undefined, clientId: number, permission: AccessPermission = 'read'): Promise<boolean> {
  if (!user || user.isActive === false || !isValidId(clientId)) return false
  if (user.role === 'admin') return true
  if (user.role === 'client') {
    const [membership] = await db.select({ accessLevel: clientUsers.accessLevel }).from(clientUsers)
      .where(and(eq(clientUsers.userId, user.id), eq(clientUsers.clientId, clientId), eq(clientUsers.isActive, true))).limit(1)
    if (!membership) return false
    return permission === 'read' || membership.accessLevel === 'admin' || (permission === 'write' && membership.accessLevel === 'write')
  }
  if (permission === 'admin') return false
  return (await accessibleClientIds(user)).includes(clientId)
}

export async function canAccessService(user: AccessUser | null | undefined, serviceId: number, permission: AccessPermission = 'read'): Promise<boolean> {
  if (!user || user.isActive === false || !isValidId(serviceId)) return false
  const [service] = await db.select({ clientId: clientServices.clientId }).from(clientServices).where(eq(clientServices.id, serviceId)).limit(1)
  if (!service || !await canAccessClient(user, service.clientId, permission)) return false
  if (user.role !== 'team_member') return true
  const employeeId = await resolveEmployeeId(user)
  if (!employeeId) return false
  const [assignment] = await db.select({ id: clientServiceTeamMembers.id }).from(clientServiceTeamMembers)
    .innerJoin(clientServices, eq(clientServices.id, clientServiceTeamMembers.clientServiceId))
    .where(and(eq(clientServiceTeamMembers.clientServiceId, serviceId), eq(clientServiceTeamMembers.teamMemberId, employeeId!), eq(clientServiceTeamMembers.isActive, true), effectiveProjectPredicate(), sql`${clientServiceTeamMembers.startDate} <= CURRENT_DATE`, sql`(${clientServiceTeamMembers.endDate} IS NULL OR ${clientServiceTeamMembers.endDate} >= CURRENT_DATE)`)).limit(1)
  return Boolean(assignment)
}

export async function canReadDocument(user: AccessUser | null | undefined, document: { clientId: number | null; clientServiceId?: number | null; userId?: number | null; visibleToClient: boolean }): Promise<boolean> {
  if (!user || user.isActive === false) return false
  if (user.role === 'admin') return true
  if (user.role === 'client' && !document.visibleToClient) return false
  if (!document.clientId || !await canAccessClient(user, document.clientId)) return false
  return document.clientServiceId ? canAccessService(user, document.clientServiceId) : true
}
