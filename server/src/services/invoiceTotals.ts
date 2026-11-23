import { and, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { invoices as i } from '../db/schema.js'

export const issuedStatuses = ['sent', 'overdue', 'paid']
const emptyTotals = { totalInvoiced: 0, totalPaid: 0, pendingAmount: 0, overdueAmount: 0 }

export async function totalsForClients(clientIds: number[], admin: boolean) {
  if (!clientIds.length) return []
  const paid = sql`coalesce(${i.stripePaidAmount}, case when ${i.status} = 'paid' and ${i.paidAt} is not null then ${i.amount} else 0 end)`
  const balance = sql`coalesce(${i.stripeRemaining}, ${i.amount} - ${paid})`
  const open = sql`${i.status} in ('sent','overdue')`
  const rows = await db.select({
    clientId: i.clientId,
    totalInvoiced: sql`coalesce(sum(${i.amount}) filter (where ${i.status} <> 'cancelled'),0)`.mapWith(Number),
    totalPaid: sql`coalesce(sum(${paid}) filter (where ${i.status} <> 'cancelled'),0)`.mapWith(Number),
    pendingAmount: sql`coalesce(sum(${balance}) filter (where ${open}),0)`.mapWith(Number),
    overdueAmount: sql`coalesce(sum(${balance}) filter (where ${open} and ( ${i.dueDate} < current_date or (${i.dueDate} is null and ${i.status} = 'overdue'))),0)`.mapWith(Number),
  }).from(i)
    .where(and(inArray(i.clientId, [...new Set(clientIds)]), admin ? undefined : inArray(i.status, issuedStatuses)))
    .groupBy(i.clientId)

  const byClient = new Map(rows.map(row => [row.clientId, row]))
  return clientIds.map(clientId => byClient.get(clientId) ?? { clientId, ...emptyTotals })
}

export async function totalsForClient(clientId: number, admin: boolean) {
  const [{ clientId: _clientId, ...totals }] = await totalsForClients([clientId], admin)
  return totals
}
