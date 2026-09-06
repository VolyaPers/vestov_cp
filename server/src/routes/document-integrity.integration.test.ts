import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (databaseUrl && (!/^\/vestov_(fix|test|audit|fresh)/.test(new URL(databaseUrl).pathname) || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))) throw new Error('Document integrity tests require an isolated local vestov database')

test('document mutations retain files on rollback and Clerk linking has one concurrent winner', { skip: !databaseUrl }, async () => {
  process.env.DATABASE_URL = databaseUrl!
  process.env.UPLOADS_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'vestov-document-integrity-'))
  const { db, pool } = await import('../db/index.js')
  const { default: express } = await import('express')
  const { documentsRouter } = await import('./documents.js')
  const { clientContactsRouter } = await import('./client-contacts.js')
  const { syncLocalUserWithClerk } = await import('./auth.js')
  const tag = randomUUID().replaceAll('-', '').slice(0, 12), fixtureKey = randomUUID()
  const userIds: number[] = [], clientIds: number[] = [], serviceIds: number[] = []
  let serviceTypeId: number | undefined
  const guardTable = `fixture_doc_guard_${tag}`, linkDelay = `fixture_link_delay_${tag}`
  const app = express()
  app.use(express.json())
  app.use(async (req: any, _res, next) => {
    const id = Number(req.get('x-fixture-user'))
    if (req.get('x-fixture-key') === fixtureKey && userIds.includes(id)) [req.user] = await db.select().from(schema.users).where(eq(schema.users.id, id))
    req.isAuthenticated = () => Boolean(req.user?.isActive)
    next()
  })
  app.use('/documents', documentsRouter)
  app.use('/contacts', clientContactsRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  const request = async (route: string, userId: number, method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}/documents${route}`, { method, headers: { 'content-type': 'application/json', 'x-fixture-key': fixtureKey, 'x-fixture-user': String(userId) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() as any }
  }
  try {
    const [admin, client, pending] = await db.insert(schema.users).values([
      { username: `${tag}_admin`, email: `${tag}_admin@example.test`, fullName: 'Fixture admin', role: 'admin' },
      { username: `${tag}_client`, email: `${tag}_client@example.test`, fullName: 'Fixture client', role: 'client' },
      { username: `${tag}_pending`, email: `${tag}_pending@example.test`, fullName: 'Fixture pending', role: 'client' },
    ]).returning(); userIds.push(admin.id, client.id, pending.id)
    const [company] = await db.insert(schema.clients).values({ name: `${tag} company` }).returning(); clientIds.push(company.id)
    const [type] = await db.insert(schema.serviceTypes).values({ name: `${tag} service`, category: 'outstaffing', billingModel: 'hourly' }).returning(); serviceTypeId = type.id
    const projects = await db.insert(schema.clientServices).values([1, 2].map(() => ({ clientId: company.id, serviceTypeId: type.id, startDate: '2020-01-01' }))).returning(); serviceIds.push(...projects.map(project => project.id))
    const makeFolder = async (name: string, parentFolderId: number | null = null, clientServiceId = projects[0].id) => {
      const [folder] = await db.insert(schema.documentFolders).values({ name, parentFolderId, clientServiceId, createdBy: admin.id }).returning(); return folder
    }
    const root = await makeFolder('Root'), middle = await makeFolder('Middle', root.id), child = await makeFolder('Child', middle.id), foreign = await makeFolder('Other service', null, projects[1].id)
    await fs.mkdir(path.join(process.env.UPLOADS_DIR!, 'documents'))
    const deniedAvatar = new FormData(); deniedAvatar.set('avatar', new Blob(['fixture'], { type: 'image/png' }), 'denied.png')
    const avatarResponse = await fetch(`${base}/contacts/1/avatar`, { method: 'POST', headers: { 'x-fixture-key': fixtureKey, 'x-fixture-user': String(client.id) }, body: deniedAvatar })
    assert.equal(avatarResponse.status, 403)
    assert.deepEqual(await fs.readdir(process.env.UPLOADS_DIR!), ['documents'], 'An unauthorized avatar upload must not write a file')
    const makeDoc = async (name: string, folderId: number | null, fileName = name) => {
      const file = path.join(process.env.UPLOADS_DIR!, 'documents', fileName)
      await fs.writeFile(file, `file:${fileName}`)
      const [document] = await db.insert(schema.documents).values({ name, url: `/uploads/documents/${fileName}`, clientId: company.id, clientServiceId: projects[0].id, folderId, userId: admin.id, visibleToClient: true }).returning()
      return { ...document, file }
    }
    const moved = await makeDoc('moved.txt', middle.id), nested = await makeDoc('nested.txt', child.id), blocked = await makeDoc('blocked.txt', root.id)
    assert.equal((await request('/folder', admin.id, 'POST', { clientServiceId: projects[0].id, name: '   ' })).status, 400)
    assert.equal((await request(`/folder/${root.id}`, admin.id, 'PUT', { name: '   ' })).status, 400)
    assert.equal((await request('/folder', admin.id, 'POST', { clientServiceId: projects[0].id, parentFolderId: foreign.id, name: 'Wrong parent' })).status, 404)
    assert.equal((await request(`/folder/${root.id}`, client.id, 'PUT', { name: 'No access' })).status, 403)
    assert.equal((await request(`/folder/${root.id}e0`, admin.id, 'PUT', { name: 'Bad ID' })).status, 400)
    assert.equal((await request(`/folder/${child.id}`, admin.id, 'PUT', { name: 'Renamed child' })).body.name, 'Renamed child')

    // A real FK failure exercises PostgreSQL rollback, without replacing DB code.
    await pool.query(`CREATE TABLE "${guardTable}" (document_id integer REFERENCES documents(id))`)
    await pool.query(`INSERT INTO "${guardTable}" VALUES ($1)`, [blocked.id])
    assert.equal((await request(`/${blocked.id}`, admin.id, 'DELETE')).status, 500)
    assert.equal(await fs.readFile(blocked.file, 'utf8'), 'file:blocked.txt')
    assert.equal((await db.select().from(schema.documents).where(eq(schema.documents.id, blocked.id))).length, 1)
    assert.equal((await request(`/folder/${root.id}?deleteContents=true`, admin.id, 'DELETE')).status, 500)
    for (const document of [moved, nested, blocked]) assert.equal((await fs.stat(document.file)).isFile(), true)
    assert.equal((await db.select().from(schema.documentFolders).where(eq(schema.documentFolders.id, child.id))).length, 1)
    assert.equal((await db.select().from(schema.documents).where(eq(schema.documents.id, moved.id))).length, 1)
    await pool.query(`DROP TABLE "${guardTable}"`)

    assert.equal((await request(`/folder/${middle.id}?deleteContents=false`, admin.id, 'DELETE')).status, 200)
    assert.equal((await db.select().from(schema.documents).where(eq(schema.documents.id, moved.id)))[0].folderId, root.id)
    assert.equal((await db.select().from(schema.documentFolders).where(eq(schema.documentFolders.id, child.id)))[0].parentFolderId, root.id)
    assert.equal((await fs.stat(moved.file)).isFile(), true)
    const shared = await makeDoc('shared-reference.txt', null, 'blocked.txt')
    assert.equal((await request(`/${blocked.id}`, admin.id, 'DELETE')).status, 200)
    assert.equal((await fs.stat(shared.file)).isFile(), true, 'A referenced shared URL must retain its file')
    assert.equal((await request(`/${shared.id}`, admin.id, 'DELETE')).status, 200)
    await assert.rejects(fs.stat(shared.file), { code: 'ENOENT' })
    assert.equal((await request(`/folder/${root.id}?deleteContents=true`, admin.id, 'DELETE')).status, 200)
    await assert.rejects(fs.stat(nested.file), { code: 'ENOENT' })
    await assert.rejects(fs.stat(moved.file), { code: 'ENOENT' })

    // Delay the first UPDATE so both real requests read the initially unlinked
    // account. The compare-and-set predicate must allow exactly one identity.
    await pool.query(`CREATE FUNCTION "${linkDelay}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${pending.id} THEN PERFORM pg_sleep(0.2); END IF; RETURN NEW; END $$`)
    await pool.query(`CREATE TRIGGER "${linkDelay}" BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION "${linkDelay}"()`)
    const clerk = (id: string, verified = true) => ({ id, fullName: 'Provider name', imageUrl: '', primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'primary', emailAddress: pending.email, verification: { status: verified ? 'verified' : 'unverified' } }] })
    const results = await Promise.allSettled([syncLocalUserWithClerk(clerk(`${tag}_clerk_a`)), syncLocalUserWithClerk(clerk(`${tag}_clerk_b`))])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    assert.equal(rejected.reason.statusCode, 409)
    const [linked] = await db.select().from(schema.users).where(eq(schema.users.id, pending.id))
    assert.equal(await syncLocalUserWithClerk(clerk(linked.clerkUserId!)), pending.id)
    await assert.rejects(syncLocalUserWithClerk(clerk(`${tag}_unverified`, false)), { statusCode: 400 })
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, pending.id))
    await assert.rejects(syncLocalUserWithClerk(clerk(linked.clerkUserId!)), { statusCode: 403 })
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await pool.query(`DROP TABLE IF EXISTS "${guardTable}"`)
    await pool.query(`DROP TRIGGER IF EXISTS "${linkDelay}" ON users`)
    await pool.query(`DROP FUNCTION IF EXISTS "${linkDelay}"()`)
    if (clientIds.length) await db.delete(schema.documents).where(inArray(schema.documents.clientId, clientIds))
    if (serviceIds.length) { await db.delete(schema.documentFolders).where(inArray(schema.documentFolders.clientServiceId, serviceIds)); await db.delete(schema.clientServices).where(inArray(schema.clientServices.id, serviceIds)) }
    if (clientIds.length) await db.delete(schema.clients).where(inArray(schema.clients.id, clientIds))
    if (serviceTypeId) await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, serviceTypeId))
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    await pool.end(); await fs.rm(process.env.UPLOADS_DIR!, { recursive: true, force: true })
  }
})
