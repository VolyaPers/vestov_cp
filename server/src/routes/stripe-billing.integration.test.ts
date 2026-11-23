import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import type { RemoteInvoice } from '../services/stripeInvoices.js'
import * as s from '../db/schema.js'

test('Stripe publication, partial payments, tenant isolation and signed retries', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  const {db,pool} = await import('../db/index.js')
  const {createStripeBillingRouter,createStripeWebhook} = await import('./stripe-billing.js')
  const {totalsForClient} = await import('../services/invoiceTotals.js')
  const tag = randomUUID(), stripeId = 'in_' + tag.replaceAll('-','')
  const [client] = await db.insert(s.clients).values({name:tag,email:'billing@example.test'}).returning()
  const [admin, member, outsider] = await db.insert(s.users).values(['admin','client','client'].map((role,index)=>({role,fullName:role,username:tag+index,email:tag+index+'@example.test'}))).returning()
  await db.insert(s.clientUsers).values({clientId:client.id,userId:member.id,assignedBy:admin.id})
  const [local] = await db.insert(s.invoices).values({invoiceNumber:tag,clientId:client.id,createdBy:admin.id,amount:'100.25',invoiceDate:'2026-11-01',periodStart:'2026-10-01',periodEnd:'2026-10-31'}).returning()
  const remote: RemoteInvoice = {id:stripeId,currency:'usd',total:10025,amount_paid:2500,amount_remaining:7525,status:'open',customer_email:'wrong@example.test',metadata:{},due_date:null,hosted_invoice_url:'https://invoice.stripe.com/i/test',status_transitions:{paid_at:null,finalized_at:1,marked_uncollectible_at:null,voided_at:null}}
  let reads = 0
  const retrieve = async () => { reads++; return remote }
  const app=express(); app.use(express.json({verify:(req,_res,buf)=>{(req as any).rawBody=buf}}))
  const secret='test-signing-secret'
  app.post('/events',createStripeWebhook(retrieve,()=>secret))
  app.use((req,_res,next)=>{req.user=[admin,member,outsider].find(user=>user.id===Number(req.get('actor'))) as Express.User;next()})
  app.use(createStripeBillingRouter(retrieve))
  const server = app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
  const base='http://127.0.0.1:'+(server.address() as any).port
  const publish=(actor:number)=>fetch(base+'/'+local.id+'/stripe',{method:'POST',headers:{actor:String(actor),'Content-Type':'application/json'},body:JSON.stringify({stripeInvoiceId:stripeId})})
  const open=(actor:number)=>fetch(base+'/'+local.id+'/stripe',{headers:{actor:String(actor)}})
  try {
    assert.equal((await publish(member.id)).status,403)
    assert.equal((await publish(admin.id)).status,409)
    remote.customer_email = client.email
    const [otherCompany] = await db.insert(s.clients).values({name:tag+'-other',email:client.email}).returning()
    try { assert.equal((await publish(admin.id)).status,409) }
    finally { await db.delete(s.clients).where(eq(s.clients.id,otherCompany.id)) }
    remote.total++; assert.equal((await publish(admin.id)).status,409);remote.total--
    assert.equal((await publish(admin.id)).status,200)
    assert.deepEqual(await totalsForClient(client.id,false),{totalInvoiced:100.25,totalPaid:25,pendingAmount:75.25,overdueAmount:0})
    const priorReads=reads;assert.equal((await open(outsider.id)).status,404);assert.equal(reads,priorReads)
    assert.equal((await (await open(member.id)).json()).url,remote.hosted_invoice_url)
    remote.amount_paid=10025;remote.amount_remaining=0;remote.status='paid';remote.status_transitions.paid_at=1794182400
    const payload=JSON.stringify({id:'evt_fixture',type:'invoice.paid',data:{object:{object:'invoice',id:stripeId}}})
    const send=(signature:string)=>fetch(base+'/events',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload})
    assert.equal((await send('bad-signature')).status,400)
    const signature=Stripe.webhooks.generateTestHeaderString({payload,secret})
    assert.equal((await send(signature)).status,200);assert.equal((await send(signature)).status,200)
    assert.deepEqual(await totalsForClient(client.id,false),{totalInvoiced:100.25,totalPaid:100.25,pendingAmount:0,overdueAmount:0})
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()))
    await db.delete(s.financeActivityLogs).where(eq(s.financeActivityLogs.invoiceId,local.id))
    await db.delete(s.invoices).where(eq(s.invoices.id,local.id))
    await db.delete(s.clientUsers).where(eq(s.clientUsers.clientId,client.id))
    await db.delete(s.clients).where(eq(s.clients.id,client.id))
    for(const user of [admin,member,outsider]) await db.delete(s.users).where(eq(s.users.id,user.id))
    await pool.end()
  }
})
