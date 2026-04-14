import { financeActivityLogs } from '../db/schema.js'

export type FinanceAuditInput = {
  action: string
  entityType: string
  entityId: number
  actorId: number
  summary: string
  teamMemberId?: number | null
  clientId?: number | null
  invoiceId?: number | null
  transactionId?: number | null
  beforeData?: Record<string, any> | null
  afterData?: Record<string, any> | null
  metadata?: Record<string, any> | null
}

export function sanitizeRecord<T extends Record<string, any>>(value: T | null | undefined): T | null {
  if (!value) return null
  return JSON.parse(JSON.stringify(value)) as T
}

export function diffRecord(before: Record<string, any> | null | undefined, after: Record<string, any> | null | undefined) {
  const beforeRecord = before || {}
  const afterRecord = after || {}
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
  const changes: Record<string, { before: any; after: any }> = {}

  for (const key of keys) {
    const prev = beforeRecord[key]
    const next = afterRecord[key]
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes[key] = { before: prev ?? null, after: next ?? null }
    }
  }

  return changes
}

export async function logFinanceActivity(tx: any, input: FinanceAuditInput) {
  await tx.insert(financeActivityLogs).values({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    teamMemberId: input.teamMemberId ?? null,
    clientId: input.clientId ?? null,
    invoiceId: input.invoiceId ?? null,
    transactionId: input.transactionId ?? null,
    actorId: input.actorId,
    summary: input.summary,
    beforeData: sanitizeRecord(input.beforeData),
    afterData: sanitizeRecord(input.afterData),
    metadata: sanitizeRecord(input.metadata),
  })
}

export function pickTransactionSnapshot(tx: {
  id: number
  type: string
  category: string | null
  amount: string | number
  description: string | null
  transactionDate: string
  teamMemberId: number | null
  clientId: number | null
  invoiceId: number | null
  isRecurring: boolean | null
}) {
  return {
    id: tx.id,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    description: tx.description,
    transactionDate: tx.transactionDate,
    teamMemberId: tx.teamMemberId,
    clientId: tx.clientId,
    invoiceId: tx.invoiceId,
    isRecurring: tx.isRecurring,
  }
}

export function pickInvoiceSnapshot(inv: {
  id: number
  clientId: number
  invoiceNumber: string
  amount: string | number
  invoiceDate: string
  periodStart: string | null
  periodEnd: string | null
  description: string | null
  status: string
  dueDate: string | null
  paidAt: string | Date | null
  notes: string | null
}) {
  return {
    id: inv.id,
    clientId: inv.clientId,
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount,
    invoiceDate: inv.invoiceDate,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    description: inv.description,
    status: inv.status,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    notes: inv.notes,
  }
}
