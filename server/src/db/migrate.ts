import type { Pool, PoolClient } from 'pg'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationFolder = [path.join(here, '../drizzle'), path.join(here, '../../drizzle')]
  .find((folder) => fs.existsSync(path.join(folder, 'meta/_journal.json')))!

export async function assertLegacyUpgradeSafe(connection: Pick<PoolClient, 'query'>) {
  // Historical 0010/0018/0025 drop these sources. Check every source before
  // executing any of them, including orphan assignments without developers.
  for (const table of ['developers', 'client_service_developers']) {
    const exists = await connection.query('SELECT to_regclass($1) AS relation', [`public.${table}`])
    if (exists.rows[0].relation) {
      const count = await connection.query(`SELECT count(*) AS count FROM "${table}"`)
      if (Number(count.rows[0].count)) throw new Error(`Legacy ${table} rows need an explicit data migration before upgrade; no rows were changed.`)
    }
  }
  const column = await connection.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='client_id'")
  if (column.rows.length) {
    const memberships = await connection.query('SELECT count(*) AS count FROM users WHERE client_id IS NOT NULL')
    if (Number(memberships.rows[0].count)) throw new Error('Legacy user client memberships need an explicit data migration before upgrade; no rows were changed.')
  }
}

/** One transactional, locked migration path for manual runs and startup.
 * 0038 includes the formerly unregistered prerequisites of 0036/0037. Their
 * historic timestamps are preserved; fresh installs use the reviewed baseline.
 */
export async function runDatabaseMigrations(pool: Pool) {
  const migrations = readMigrationFiles({ migrationsFolder: migrationFolder })
  const repair = migrations.find((migration) => migration.folderMillis === 1788739200000)!
  const connection = await pool.connect()
  try {
    await connection.query('BEGIN')
    // Startup may receive the separate session-store pool. Keep this transaction
    // UTC without changing the session pool's expiry interpretation after commit.
    await connection.query("SET LOCAL TIME ZONE 'UTC'")
    await connection.query('SELECT pg_advisory_xact_lock(7188, 1)')
    await connection.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await connection.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)')
    const { rows } = await connection.query('SELECT max(created_at) AS latest FROM drizzle.__drizzle_migrations')
    const latest = Number(rows[0]?.latest || 0)
    const record = async (migration: typeof repair) => {
      await connection.query('INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ($1,$2)', [migration.hash, migration.folderMillis])
    }
    const execute = async (migration: typeof repair) => {
      for (const statement of migration.sql) await connection.query(statement)
    }
    const { rows: tables } = await connection.query("SELECT to_regclass('public.users') AS users")
    if (!tables[0].users) {
      for (const migration of readMigrationFiles({ migrationsFolder: path.join(migrationFolder, 'baseline') })) await execute(migration)
      // The additive repair also installs lookup defaults and secondary indexes.
      await execute(repair)
      for (const migration of migrations.filter((item) => item.folderMillis <= repair.folderMillis)) await record(migration)
    } else if (latest < repair.folderMillis) {
      // An old database may still need the pre-0025 base schema. Stop instead of
      // executing the historic destructive developer cleanup against live rows.
      if (latest < 1769604512678) {
        await assertLegacyUpgradeSafe(connection)
        for (const migration of migrations.filter((item) => item.folderMillis > latest && item.folderMillis <= 1769604512678 && item.folderMillis !== 1765560000000)) {
          await execute(migration)
          await record(migration)
        }
      }
      await execute(repair)
      await record(repair)
    }
    for (const migration of migrations.filter((item) => item.folderMillis > Math.max(latest, repair.folderMillis))) {
      await execute(migration)
      await record(migration)
    }
    // Fail startup on incomplete schema, including historically missing feedback.
    await connection.query('SELECT client_service_id, admin_response FROM feedback LIMIT 0')
    await connection.query('SELECT payroll_period_id, payroll_data, voided_at FROM financial_transactions LIMIT 0')
    await connection.query('SELECT archived_at, decision_requested_at FROM leave_requests LIMIT 0')
    await connection.query('SELECT first_response_due_at, first_responded_at, resolved_at FROM feedback LIMIT 0')
    await connection.query('SELECT event_key, superseded_at, slack_next_attempt_at FROM workflow_notifications LIMIT 0')
    await connection.query('SELECT user_id, role FROM workflow_assignments LIMIT 0')
    await connection.query('SELECT employment_type FROM payroll_periods LIMIT 0')
    await connection.query('SELECT employment_type FROM salary_rate_history LIMIT 0')
    await connection.query('SELECT team_member_id, payment_transaction_id FROM freelancer_fees LIMIT 0')
    await connection.query('COMMIT')
    console.info('[MIGRATIONS] Schema verified')
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally {
    connection.release()
  }
}
