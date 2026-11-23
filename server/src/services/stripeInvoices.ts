import Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, integrationSettings, invoices } from '../db/schema.js'
import { decrypt } from '../lib/encryption.js'
import { cents, money, FinanceValidationError } from '../lib/money.js'
import { logFinanceActivity } from '../lib/financeAudit.js'

export type RemoteInvoice = Pick<Stripe.Invoice, 'id'|'total'|'currency'|'amount_paid'|'amount_remaining'|'status'|'customer_email'|'metadata'|'due_date'|'hosted_invoice_url'|'status_transitions'>
export async function retrieveInvoice(id: string): Promise<RemoteInvoice> {
  const [settings] = await db.select().from(integrationSettings).where(eq(integrationSettings.provider, 'stripe'))
  if (!settings?.isActive || !settings.credentials) throw new FinanceValidationError('Stripe is not connected. Contact your account lead.', 503)
  try {
    const { secretKey } = JSON.parse(decrypt(settings.credentials))
    return await new Stripe(secretKey, {timeout: 6000, maxNetworkRetries: 0}).invoices.retrieve(id)
  } catch {
    throw new FinanceValidationError('Stripe invoice could not be retrieved. Check the invoice ID and connection, then retry.', 502)
  }
}

// A shared accounts-payable mailbox is not sufficient to identify a company.
export const uniqueBillingEmail = sql<string | null>`case when not exists
  (select 1 from clients other where other.id <> clients.id
   and lower(trim(other.email)) = lower(trim(clients.email)))
  then clients.email else null end`

export function verifiedInvoice(remote: RemoteInvoice, local: typeof invoices.$inferSelect, email: string | null) {
  const owner = remote.metadata?.vestov_client_id
  const matchesClient = owner != null ? owner === String(local.clientId) : !!email && remote.customer_email?.trim().toLowerCase() === email.trim().toLowerCase()
  if ((remote.metadata?.vestov_invoice_id != null && remote.metadata.vestov_invoice_id !== String(local.id)) || !matchesClient || remote.currency !== 'usd' || remote.total !== cents(local.amount))
    throw new FinanceValidationError('The Stripe invoice must match this client, USD currency and invoice total.', 409)
  if (!['open','paid','void','uncollectible'].includes(remote.status || ''))
    throw new FinanceValidationError('Finalize the invoice in Stripe first.', 409)
  const paidTimestamp = remote.status_transitions.paid_at
  if (remote.status === 'paid' && !paidTimestamp) throw new FinanceValidationError('Stripe has not confirmed the payment date.', 409)
  const status = remote.status === 'paid' ? 'paid' : remote.status === 'void' ? 'cancelled' : remote.status === 'uncollectible' ? 'overdue' : 'sent'
  return { stripeInvoiceId: remote.id, stripePaidAmount: money(remote.amount_paid), stripeRemaining: money(remote.amount_remaining),
    status, paidAt: status === 'paid' ? new Date(paidTimestamp! * 1000) : null,
    dueDate: remote.due_date ? new Date(remote.due_date * 1000).toISOString().slice(0,10) : null }
}

export function hostedUrl(remote: RemoteInvoice) {
  const url = remote.hosted_invoice_url && new URL(remote.hosted_invoice_url)
  if (!url || url.protocol !== 'https:' || url.hostname !== 'invoice.stripe.com' || url.username || url.password || url.port)
    throw new FinanceValidationError('The hosted invoice is unavailable. Contact your account lead.', 409)
  return url.href
}

export async function syncInvoice(id: number, stripeId: string, actorId: number | null, retrieve = retrieveInvoice) {
  if (typeof stripeId !== 'string' || !/^in_[A-Za-z0-9]{1,128}$/.test(stripeId)) throw new FinanceValidationError('Enter a Stripe invoice ID starting with in_.')
  try {
    return await db.transaction(async tx => {
      const [local] = await tx.select().from(invoices).where(eq(invoices.id,id)).for('update')
      if (!local) throw new FinanceValidationError('Invoice not found',404)
      if (local.stripeInvoiceId && local.stripeInvoiceId !== stripeId) throw new FinanceValidationError('This invoice already has a different Stripe invoice.',409)
      if (!local.stripeInvoiceId && local.status === 'cancelled') throw new FinanceValidationError('A cancelled invoice cannot be published.',409)
      const [client] = await tx.select({email:uniqueBillingEmail}).from(clients).where(eq(clients.id,local.clientId))
      const remote = await retrieve(stripeId)
      if (remote.id !== stripeId) throw new FinanceValidationError('Unexpected Stripe invoice.',409)
      const update = verifiedInvoice(remote, local, client.email)
      if (!local.stripeInvoiceId && local.status === 'paid' && (update.status !== 'paid' || remote.amount_paid !== cents(local.amount)))
        throw new FinanceValidationError('The recorded payment does not match Stripe. Reconcile it before linking.',409)
      if (!local.stripeInvoiceId && update.status === 'cancelled') throw new FinanceValidationError('A void Stripe invoice cannot be published.',409)
      if (local.stripeInvoiceId === stripeId && local.stripePaidAmount === update.stripePaidAmount && local.stripeRemaining === update.stripeRemaining && local.status === update.status && local.dueDate === update.dueDate && local.paidAt?.getTime() === update.paidAt?.getTime()) return
      await tx.update(invoices).set({...update, updatedAt:new Date()}).where(eq(invoices.id,id))
      if (actorId) await logFinanceActivity(tx,{actorId,invoiceId:id,clientId:local.clientId,entityId:id,entityType:'invoice',action:'stripe_invoice_sync',summary:'Published Stripe invoice status and balance',afterData:update})
    })
  } catch (e) {
    if ((e as any)?.cause?.code === '23505' || (e as any)?.code === '23505') throw new FinanceValidationError('That Stripe invoice is already linked.',409)
    throw e
  }
}
