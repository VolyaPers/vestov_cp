import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, timestamp, date, serial } from 'drizzle-orm/pg-core'
import { applicationPoolConfig } from './connection.js'

const url = process.env.TIMESTAMP_TEST_DATABASE_URL
if (url && !/^vestov_(fix|test|audit)_/.test(new URL(url).pathname.slice(1))) {
  throw new Error('Timestamp test requires a separate vestov_fix_/test_/audit_ database')
}
const clock = pgTable('utc_clock_fixture', {
  id: serial('id').primaryKey(),
  automatic: timestamp('automatic').defaultNow().notNull(),
  explicit: timestamp('explicit').notNull(),
  absolute: timestamp('absolute', { withTimezone: true }).notNull(),
  calendarDate: date('calendar_date').notNull(),
})

test('database defaults and explicit Drizzle dates agree under non-UTC process and DB settings', { skip: !url }, async () => {
  const oldTZ = process.env.TZ
  const oldUrl = process.env.DATABASE_URL
  const oldOptions = process.env.PGOPTIONS
  process.env.TZ = 'America/New_York'
  const control = new Pool({ connectionString: url, options: '-c TimeZone=Europe/Kyiv' })
  const withOptions = new URL(url!)
  withOptions.searchParams.set('options', '-c TimeZone=Europe/Kyiv -c statement_timeout=12000')
  process.env.DATABASE_URL = withOptions.toString()
  process.env.PGOPTIONS = '-c TimeZone=Pacific/Auckland'
  const { pool: application } = await import('./index.js')
  const fromEnvironment = new Pool(applicationPoolConfig(url!, '-c TimeZone=Europe/Kyiv'))
  async function sample(pool: Pool) {
    const connection = await pool.connect()
    try {
      await connection.query('BEGIN')
      await connection.query('CREATE TEMP TABLE utc_clock_fixture (id serial PRIMARY KEY, automatic timestamp NOT NULL DEFAULT now(), explicit timestamp NOT NULL, absolute timestamptz NOT NULL, calendar_date date NOT NULL) ON COMMIT DROP')
      const settings = (await connection.query("SELECT current_setting('TimeZone') AS timezone, current_setting('statement_timeout') AS timeout, extract(timezone from now()) AS offset_seconds")).rows[0]
      const explicit = new Date()
      const typed = drizzle(connection)
      const [row] = await typed.insert(clock).values({ explicit, absolute: explicit, calendarDate: '2026-09-06' }).returning()
      const raw = (await connection.query('SELECT automatic::text AS automatic, explicit::text AS explicit FROM utc_clock_fixture')).rows[0]
      assert.equal(row.explicit.getTime(), explicit.getTime(), 'Drizzle explicit timestamp preserves the instant under non-UTC Node TZ')
      assert.equal(row.absolute.getTime(), explicit.getTime(), 'Absolute timestamptz is unchanged')
      assert.equal(row.calendarDate, '2026-09-06', 'Calendar DATE never shifts with timezone')
      return { settings, difference: row.automatic.getTime() - explicit.getTime(), raw }
    } finally {
      await connection.query('ROLLBACK') // temporary fixture disappears; no application rows touched
      connection.release()
    }
  }
  try {
    assert.notEqual(new Date().getTimezoneOffset(), 0, 'Process must actually be non-UTC')
    const before = await sample(control)
    assert.equal(before.settings.timezone, 'Europe/Kyiv')
    assert.ok(Math.abs(before.difference - Number(before.settings.offset_seconds) * 1000) < 1500, 'Control reproduces defaultNow local-wall-time drift')
    const fixed = await sample(application)
    assert.equal(fixed.settings.timezone, 'UTC', 'Application override wins over connection URI timezone')
    assert.equal(fixed.settings.timeout, '12s', 'Unrelated URI connection settings are preserved')
    assert.ok(Math.abs(fixed.difference) < 1500, 'defaultNow and explicit new Date are the same instant')
    const environment = await sample(fromEnvironment)
    assert.equal(environment.settings.timezone, 'UTC', 'UTC also wins over inherited PGOPTIONS')
    assert.ok(Math.abs(environment.difference) < 1500)
    const migrationConnection = await control.connect()
    try {
      await migrationConnection.query('BEGIN')
      await migrationConnection.query("SET LOCAL TIME ZONE 'UTC'")
      assert.equal((await migrationConnection.query('SHOW TimeZone')).rows[0].TimeZone, 'UTC')
      await migrationConnection.query('COMMIT')
      assert.equal((await migrationConnection.query('SHOW TimeZone')).rows[0].TimeZone, 'Europe/Kyiv', 'Migration-local UTC does not alter session-store expiry semantics')
    } finally { migrationConnection.release() }
    // Repeated/new connections receive the startup setting, not an async on-connect race.
    const clients = await Promise.all([application.connect(), application.connect()])
    try { for (const client of clients) assert.equal((await client.query('SHOW TimeZone')).rows[0].TimeZone, 'UTC') }
    finally { clients.forEach(client => client.release()) }
    console.info(JSON.stringify({ controlDriftMs: Math.round(before.difference), applicationDriftMs: Math.round(fixed.difference), inheritedOptionsDriftMs: Math.round(environment.difference), processTimezone: process.env.TZ }))
  } finally {
    await Promise.all([control.end(), application.end(), fromEnvironment.end()])
    if (oldUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = oldUrl
    if (oldOptions === undefined) delete process.env.PGOPTIONS
    else process.env.PGOPTIONS = oldOptions
    if (oldTZ === undefined) delete process.env.TZ
    else process.env.TZ = oldTZ
  }
})
