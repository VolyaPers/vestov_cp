import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { feedback, leaveRequests, leaveTypes, reimbursementRequests, teamMembers, users, workflowAssignments, workflowNotifications } from '../db/schema.js'
import { FinanceValidationError } from '../lib/money.js'
import { workflowDueAt } from '../utils/workflowTime.js'

type WorkflowUser = { id: number; role: string; isActive?: boolean; originalUserId?: number }
const configuredIds = (value?: string) => [...new Set((value || '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]

async function assignments(tx: any = db) {
  const overrides = process.env.WORKFLOW_OWNER_USER_IDS !== undefined || process.env.WORKFLOW_DEPUTY_USER_IDS !== undefined
  if (overrides) {
    const ownerIds = configuredIds(process.env.WORKFLOW_OWNER_USER_IDS)
    const deputyIds = configuredIds(process.env.WORKFLOW_DEPUTY_USER_IDS)
    const ids = [...new Set([...ownerIds, ...deputyIds])]
    if (!ids.length) return []
    const rows = await tx.select({ id: users.id, displayName: users.fullName }).from(users).where(and(inArray(users.id, ids), eq(users.role, 'admin'), eq(users.isActive, true)))
    return rows.map((row: any) => ({ ...row, role: ownerIds.includes(row.id) ? 'owner' : 'deputy' }))
  }
  return tx.select({ id: users.id, role: workflowAssignments.role, displayName: workflowAssignments.displayName }).from(workflowAssignments)
    .innerJoin(users, eq(users.id, workflowAssignments.userId)).where(and(eq(users.isActive, true), eq(users.role, 'admin')))
}
export async function workflowRecipients(tx: any = db): Promise<{ ownerIds: number[]; deputyIds: number[]; allIds: number[] }> {
  const rows = await assignments(tx)
  return { ownerIds: rows.filter((r: any) => r.role === 'owner').map((r: any) => r.id), deputyIds: rows.filter((r: any) => r.role === 'deputy').map((r: any) => r.id), allIds: rows.map((r: any) => r.id) }
}
export async function getWorkflowAccess(user?: WorkflowUser | null) {
  const eligible = Boolean(user && user.role === 'admin' && user.isActive !== false && !user.originalUserId)
  const recipients = eligible ? await workflowRecipients() : { ownerIds: [], deputyIds: [] }
  const isOwner = eligible && recipients.ownerIds.includes(user!.id)
  const isDeputy = eligible && recipients.deputyIds.includes(user!.id)
  return { isOwner, isDeputy, canViewQueue: isOwner || isDeputy, canApproveLeave: isOwner || isDeputy, canApprovePurchase: isOwner, canManageFeedback: isOwner, canRecordPayment: isOwner || isDeputy }
}
export type WorkflowCapability = keyof Awaited<ReturnType<typeof getWorkflowAccess>>
export async function requireWorkflowCapability(user: WorkflowUser, capability: WorkflowCapability) {
  const access = await getWorkflowAccess(user)
  if (!access[capability]) throw new FinanceValidationError('This action is assigned to the workflow owner or an authorized administrative deputy.', 403)
  return access
}
export async function queueWorkflowNotification(tx: any, notice: { eventKey: string; recipientIds: number[]; title: string; body: string; href: string }) {
  const ids = [...new Set(notice.recipientIds)].filter(id => Number.isSafeInteger(id) && id > 0)
  if (!ids.length) return
  if (!notice.href.startsWith('/') || notice.href.startsWith('//')) throw new Error('Workflow notifications require a local link')
  const recipients = await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.isActive, true)))
  if (!recipients.length) return
  await tx.insert(workflowNotifications).values(recipients.map((recipient: any) => ({
    eventKey: notice.eventKey, userId: recipient.id, title: notice.title, body: notice.body, href: notice.href,
  }))).onConflictDoNothing({ target: [workflowNotifications.eventKey, workflowNotifications.userId] })
}
export interface DecisionItem {
  id: string; kind: 'leave' | 'purchase' | 'feedback'; entityId: number; title: string; description: string;
  status: string; createdAt: string; dueAt: string | null; overdue: boolean; ownerName: string; href: string;
  canAct: boolean; recipientIds: number[];
}
export async function listWorkflowDecisions(user?: WorkflowUser, now = new Date()) {
  const [members, access, leaves, purchases, feedbackRows] = await Promise.all([
    assignments(), user ? getWorkflowAccess(user) : Promise.resolve(null),
    db.select({ id: leaveRequests.id, createdAt: leaveRequests.createdAt, decisionRequestedAt: leaveRequests.decisionRequestedAt, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, daysCount: leaveRequests.daysCount, name: teamMembers.name, type: leaveTypes.name, status: leaveRequests.status }).from(leaveRequests)
      .innerJoin(teamMembers, eq(teamMembers.id, leaveRequests.employeeId)).innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(and(eq(leaveRequests.status, 'pending'), isNull(leaveRequests.archivedAt))),
    db.select({ id: reimbursementRequests.id, createdAt: reimbursementRequests.requestedAt, confirmedAt: reimbursementRequests.confirmedAt, name: teamMembers.name, description: reimbursementRequests.description, status: reimbursementRequests.status, amount: reimbursementRequests.reimbursementAmount }).from(reimbursementRequests)
      .innerJoin(teamMembers, eq(teamMembers.id, reimbursementRequests.employeeId))
      .where(and(inArray(reimbursementRequests.status, ['pending', 'approved', 'confirmed']), isNull(reimbursementRequests.paidAt))),
    db.select({ id: feedback.id, createdAt: feedback.createdAt, status: feedback.status, name: users.fullName, firstRespondedAt: feedback.firstRespondedAt, adminRespondedAt: feedback.adminRespondedAt, firstResponseDueAt: feedback.firstResponseDueAt }).from(feedback)
      .innerJoin(users, eq(users.id, feedback.userId)).where(inArray(feedback.status, ['pending', 'reviewed', 'in_progress', 'awaiting_client'])),
  ])
  const owner = members.filter((r: any) => r.role === 'owner'), deputy = members.filter((r: any) => r.role === 'deputy')
  const ownerName = owner.map((r: any) => r.displayName).join(', ') || 'Owner not configured'
  const administrativeName = [...owner, ...deputy].map((r: any) => r.displayName).join(' / ') || 'Owner not configured'
  const ownerIds = owner.map((r: any) => r.id), allIds = members.map((r: any) => r.id)
  const make = (item: Omit<DecisionItem, 'dueAt' | 'overdue' | 'createdAt'> & { createdAt: Date; dueAt: Date | null }): DecisionItem => ({ ...item, createdAt: item.createdAt.toISOString(), dueAt: item.dueAt?.toISOString() ?? null, overdue: Boolean(item.dueAt && item.dueAt <= now) })
  const items: DecisionItem[] = [
    ...leaves.map(row => make({ id: `leave:${row.id}`, entityId: row.id, kind: 'leave', title: `${row.name} · ${row.type}`, description: `${row.startDate} – ${row.endDate} · ${row.daysCount} working days`, status: row.status, createdAt: row.createdAt, dueAt: workflowDueAt(row.decisionRequestedAt || row.createdAt), ownerName: administrativeName, href: `/admin/vacation?request=${row.id}`, canAct: Boolean(access?.canApproveLeave), recipientIds: allIds })),
    ...purchases.map(row => make({ id: `purchase:${row.id}`, entityId: row.id, kind: 'purchase', title: `${row.name} · $${row.amount}`, description: row.description, status: row.status === 'confirmed' ? 'awaiting_payment' : row.status === 'approved' ? 'awaiting_receipt' : row.status, createdAt: row.createdAt, dueAt: row.status === 'pending' ? workflowDueAt(row.createdAt) : null, ownerName: row.status === 'confirmed' ? administrativeName : row.status === 'approved' ? row.name : ownerName, href: `/admin/reimbursements?request=${row.id}`, canAct: Boolean(row.status === 'pending' ? access?.canApprovePurchase : row.status === 'confirmed' && access?.canRecordPayment), recipientIds: row.status === 'confirmed' ? allIds : ownerIds })),
    ...feedbackRows.map(row => make({ id: `feedback:${row.id}`, entityId: row.id, kind: 'feedback', title: `Feedback · ${row.name}`, description: row.status === 'awaiting_client' || row.status === 'reviewed' ? 'Waiting for client confirmation' : 'Client conversation', status: row.status === 'reviewed' ? 'awaiting_client' : row.status, createdAt: row.createdAt, dueAt: row.firstRespondedAt || row.adminRespondedAt ? null : row.firstResponseDueAt || workflowDueAt(row.createdAt), ownerName, href: `/admin/feedback?feedback=${row.id}`, canAct: Boolean(access?.canManageFeedback && !['reviewed', 'awaiting_client'].includes(row.status)), recipientIds: ownerIds })),
  ]
  items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || a.createdAt.localeCompare(b.createdAt))
  return { items, owners: { owner: owner.map((r: any) => r.displayName), deputy: deputy.map((r: any) => r.displayName) } }
}
