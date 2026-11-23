import { Router, type RequestHandler } from 'express'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, invoices } from '../db/schema.js'
import { canAccessClient } from '../services/access.js'
import { financeError, FinanceValidationError, positiveId } from '../lib/money.js'
import { hostedUrl, retrieveInvoice, syncInvoice, uniqueBillingEmail, verifiedInvoice } from '../services/stripeInvoices.js'

export function createStripeBillingRouter(retrieve = retrieveInvoice) {
  const router = Router()
  router.post('/:id/stripe', async (req,res) => {
    try {
      if (req.user?.role !== 'admin' || (req.user as any).originalUserId) throw new FinanceValidationError('Admin access required',403)
      await syncInvoice(positiveId(req.params.id), req.body.stripeInvoiceId || '', req.user.id, retrieve)
      res.json({ok:true})
    } catch (error) { financeError(res,error,'Unable to publish the Stripe invoice') }
  })
  router.get('/:id/stripe', async (req,res) => {
    try {
      if (!req.user || !['admin','client'].includes(req.user.role)) throw new FinanceValidationError('Client access required',403)
      const [row] = await db.select({invoice:invoices,email:uniqueBillingEmail}).from(invoices).innerJoin(clients,eq(clients.id,invoices.clientId)).where(eq(invoices.id,positiveId(req.params.id)))
      if (!row || !await canAccessClient(req.user,row.invoice.clientId) || !row.invoice.stripeInvoiceId || !['paid','sent','overdue'].includes(row.invoice.status))
        throw new FinanceValidationError('Issued invoice not found',404)
      const remote = await retrieve(row.invoice.stripeInvoiceId)
      const current = verifiedInvoice(remote,row.invoice,row.email)
      if (current.status === 'cancelled') throw new FinanceValidationError('This Stripe invoice was voided.',409)
      res.set('Cache-Control','no-store').json({url:hostedUrl(remote)})
    } catch(error) { financeError(res,error,'Unable to open the Stripe invoice') }
  })
  return router
}
export const stripeBillingRouter = createStripeBillingRouter()

export const createStripeWebhook = (retrieve = retrieveInvoice, signingSecret = () => process.env.STRIPE_INVOICE_WEBHOOK_SECRET): RequestHandler => async (req,res) => {
  const secret = signingSecret()
  if (!secret) { res.sendStatus(503); return }
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent((req as any).rawBody, req.get('stripe-signature') || '', secret)
  } catch { res.status(400).json({error:'Invalid Stripe signature'}); return }
  try {
    if (event.type.startsWith('invoice.') && event.data.object.object === 'invoice') {
      const [local] = await db.select({id:invoices.id}).from(invoices).where(eq(invoices.stripeInvoiceId,event.data.object.id))
      // Re-read Stripe under the invoice lock; duplicate or reordered events cannot undo later payments.
      if (local) await syncInvoice(local.id, event.data.object.id,null,retrieve)
    }
    res.json({received:true})
  } catch { res.status(503).json({error:'Stripe invoice synchronization requires retry'}) }
}

export const stripeWebhook = createStripeWebhook()
