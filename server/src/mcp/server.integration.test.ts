import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { eq, like } from 'drizzle-orm'
import express from 'express'
import * as schema from '../db/schema.js'

const databaseUrl = process.env.TEST_DATABASE_URL

test('Vestov MCP authenticates each request and reads paginated business data', { skip: !databaseUrl }, async () => {
  const { hostname, pathname } = new URL(databaseUrl!)
  assert.ok(['127.0.0.1', 'localhost'].includes(hostname) && /test/.test(pathname), 'Use an isolated local test database')
  process.env.DATABASE_URL = databaseUrl
  const { db, pool } = await import('../db/index.js')
  const { mcpRouter } = await import('./server.js')

  const app = express()
  app.use('/api/mcp', mcpRouter)
  const listener = app.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const address = listener.address()
  assert.ok(address && typeof address === 'object')
  const endpoint = new URL(`http://127.0.0.1:${address.port}/api/mcp`)
  const tag = randomBytes(8).toString('hex')
  const token = 'vh_mcp_' + randomBytes(32).toString('base64url')
  const email = `admin-${tag}@example.test`
  const client = new Client({ name: 'vestov-hub-test', version: '1.0.0' })
  const authorize = { Authorization: `Bearer ${token}` }
  let adminId: number | undefined
  let serviceTypeId: number | undefined

  try {
    delete process.env.VESTOV_MCP_TOKEN_SHA256
    assert.equal((await fetch(endpoint, { method: 'POST', headers: authorize })).status, 404)
    process.env.VESTOV_MCP_ADMIN_EMAIL = email
    process.env.VESTOV_MCP_TOKEN_SHA256 = createHash('sha256').update(token).digest('hex')
    assert.equal((await fetch(endpoint, { method: 'POST' })).status, 401)
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 401)
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...authorize, Origin: 'https://example.test' } })).status, 403)
    assert.equal((await fetch(endpoint, { headers: authorize })).status, 405)
    assert.equal((await fetch(endpoint, { method: 'POST', headers: authorize })).status, 403)

    const [admin] = await db.insert(schema.users).values({
      email, username: `mcp-${tag}`, fullName: 'MCP fixture', role: 'admin', isActive: true,
    }).returning()
    adminId = admin.id
    const [first, second] = await db.insert(schema.clients).values([{ name: `${tag} A` }, { name: `${tag} B` }]).returning()
    const [member] = await db.insert(schema.teamMembers).values({
      name: `${tag} employee`, position: 'Test', email: `${tag}@example.test`, startDate: '2026-01-01', monthlyRate: '2500',
    }).returning()
    const [service] = await db.insert(schema.serviceTypes).values({
      name: `${tag} service`, category: 'outstaffing', billingModel: 'monthly',
    }).returning()
    serviceTypeId = service.id
    await db.insert(schema.clientServices).values({ clientId: first.id, serviceTypeId: service.id, startDate: '2026-01-01' })
    const year = String(2200 + parseInt(tag.slice(0, 3), 16))
    const invoiceDate = `${year}-01-01`
    const paymentDate = `${year}-01-02`
    const periodEnd = `${year}-01-31`
    const paidAt = new Date(`${paymentDate}T14:00:00Z`)
    await db.insert(schema.invoices).values([
      { clientId: first.id, invoiceNumber: `${tag}-1`, amount: '1200.00', invoiceDate, periodStart: invoiceDate, periodEnd, paidAt, status: 'paid', createdBy: admin.id },
      { clientId: first.id, invoiceNumber: `${tag}-2`, amount: '2400.00', invoiceDate, periodStart: invoiceDate, periodEnd, paidAt, financeExcludedPaidAt: paidAt, status: 'paid', createdBy: admin.id },
    ])
    await db.insert(schema.financialTransactions).values([
      { type: 'expense', amount: '200.00', transactionDate: paymentDate, createdBy: admin.id },
      { type: 'expense', amount: '500.00', transactionDate: paymentDate, createdBy: admin.id, voidedAt: paidAt },
    ])

    await client.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: authorize } }))
    const { tools } = await client.listTools()
    assert.equal(tools.length, 15)
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint && tool.annotations.destructiveHint === false))

    const read = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args })
      assert.equal(result.isError, undefined, JSON.stringify(result.content))
      return result.structuredContent as Record<string, any>
    }
    const firstPage = await read('list_clients', { name: tag, limit: 1 })
    assert.deepEqual(firstPage.rows.map((row: { id: number }) => row.id), [first.id])
    assert.equal(firstPage.nextAfterId, first.id)
    const secondPage = await read('list_clients', { name: tag, limit: 1, afterId: firstPage.nextAfterId })
    assert.deepEqual(secondPage.rows.map((row: { id: number }) => row.id), [second.id])
    assert.equal(secondPage.nextAfterId, null)
    assert.equal((await read('list_projects', { clientId: first.id })).rows[0].serviceName, service.name)
    assert.equal((await read('list_team_members', { name: tag })).rows[0].id, member.id)
    assert.equal((await read('get_salary_period', { teamMemberId: member.id, month: '2199-01' })).period.baseSalary, '2500.00')

    const range = { from: paymentDate, to: paymentDate }
    assert.equal((await read('get_finance_overview', range)).netProfitLoss, 1000)
    assert.equal((await read('list_financial_transactions', range)).rows.length, 1)
    const invoices = await read('list_invoices', { clientId: first.id, paidFrom: range.from, paidTo: range.to })
    assert.deepEqual(invoices.rows.map((row: { excludedFromFinanceIncome: boolean }) => row.excludedFromFinanceIncome), [false, true])
    assert.equal((await client.callTool({ name: 'list_invoices', arguments: { from: '2026-02-30' } })).isError, true)
    assert.equal((await client.callTool({ name: 'list_invoices', arguments: { ...range, from: `${year}-01-03` } })).isError, true)

    await db.update(schema.users).set({ role: 'client' }).where(eq(schema.users.id, admin.id))
    await assert.rejects(client.listTools(), /Active administrator access required/)
    await db.update(schema.users).set({ role: 'admin', isActive: false }).where(eq(schema.users.id, admin.id))
    await assert.rejects(client.listTools(), /Active administrator access required/)
  } finally {
    try {
      await client.close()
      if (adminId) {
        await db.delete(schema.financialTransactions).where(eq(schema.financialTransactions.createdBy, adminId))
        await db.delete(schema.invoices).where(eq(schema.invoices.createdBy, adminId))
        await db.delete(schema.users).where(eq(schema.users.id, adminId))
      }
      if (serviceTypeId) {
        await db.delete(schema.clientServices).where(eq(schema.clientServices.serviceTypeId, serviceTypeId))
        await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, serviceTypeId))
      }
      await db.delete(schema.clients).where(like(schema.clients.name, `${tag} %`))
      await db.delete(schema.teamMembers).where(eq(schema.teamMembers.email, `${tag}@example.test`))
    } finally {
      listener.close()
      await pool.end()
    }
  }
})
