import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { teamMembers } from '../db/schema.js'
import { cents, money, salaryExtras, FinanceValidationError } from '../lib/money.js'

export type EmploymentType = 'fulltime' | 'part_time' | 'freelancer'
export function employmentType(value: unknown = 'fulltime'): EmploymentType {
  if (!['fulltime', 'part_time', 'freelancer'].includes(value as string)) throw new FinanceValidationError('Employment type must be fulltime, part_time, or freelancer')
  return value as EmploymentType
}
export const benefitFactor = (type: unknown = 'fulltime') => type === 'freelancer' ? 0 : type === 'part_time' ? 0.5 : 1
export const reimbursementPolicy = (year: number, type: unknown = 'fulltime') => ({
  yearlyLimit: Math.min(700, 200 + Math.max(1, year) * 100) * benefitFactor(type),
  reimbursementRate: 0.5 * benefitFactor(type),
})
/** Base salary is the actual contracted amount. Only benefits use this factor. */
export function payableExtras(value: unknown, type: unknown) {
  return salaryExtras(value).map(extra => ({ ...extra, amount: extra.reimbursementId ? extra.amount : money(Math.round(cents(extra.amount) * benefitFactor(type))) })).filter(extra => cents(extra.amount) > 0)
}
export function assertEmployeeBenefits(member: { employmentType?: string }) {
  if (member.employmentType === 'freelancer') throw new FinanceValidationError('Freelancers have project fees only; employee benefits and monthly payroll are unavailable', 409)
}
/** Check both the linked profile and email to reject legacy/unlinked freelancer identities. */
export async function isFreelancerAccount(user: { teamMemberId?: number | null; email?: string } | null | undefined, connection: any = db): Promise<boolean> {
  if (!user) return false
  const predicates = []
  if (user.teamMemberId) predicates.push(eq(teamMembers.id, user.teamMemberId))
  if (user.email) predicates.push(sql`lower(${teamMembers.email}) = ${user.email.trim().toLowerCase()}`)
  if (!predicates.length) return false
  const [member] = await connection.select({ id: teamMembers.id }).from(teamMembers).where(and(eq(teamMembers.employmentType, 'freelancer'), or(...predicates))).limit(1)
  return Boolean(member)
}
export async function assertPortalAccount(user: { teamMemberId?: number | null; email?: string }, connection: any = db) {
  if (await isFreelancerAccount(user, connection)) throw new FinanceValidationError('Freelancers do not have portal accounts or invitations', 403)
}
