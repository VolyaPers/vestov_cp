import './env.js'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getAppliedMigrations } from './utils/migrations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  console.log('========================================')
  console.log('Running database migrations (manual)...')
  console.log('========================================')
  // Try dist/drizzle first (for production builds), then fall back to ../drizzle (for development)
  const migrationsPathInDist = path.join(__dirname, 'drizzle')
  const migrationsPathInParent = path.join(__dirname, '../drizzle')
  const migrationsPath = fs.existsSync(migrationsPathInDist) ? migrationsPathInDist : migrationsPathInParent
  console.log('Migrations folder:', migrationsPath)
  console.log('Database URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
  
  try {
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql') && !f.startsWith('.'))
      .sort()
    console.log(`\n[MIGRATIONS] Available migration files: ${migrationFiles.length}`)
    migrationFiles.forEach(f => {
      console.log(`[MIGRATIONS]   - ${f}`)
    })
  } catch (fsError) {
    console.error('[MIGRATIONS] Could not read migrations folder:', fsError)
  }
  
  // Debug: Check if __drizzle_migrations table exists
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '__drizzle_migrations'
      ) as exists
    `)
    console.log(`\n[MIGRATIONS] __drizzle_migrations table exists: ${tableCheck.rows[0]?.exists}`)
  } catch (e) {
    console.error('[MIGRATIONS] Error checking __drizzle_migrations table:', e)
  }

  // Debug: Check client_service_team_members table
  try {
    const cstmCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'client_service_team_members'
      ) as exists
    `)
    console.log(`[MIGRATIONS] client_service_team_members table exists: ${cstmCheck.rows[0]?.exists}`)
  } catch (e) {
    console.error('[MIGRATIONS] Error checking client_service_team_members table:', e)
  }

  const appliedMigrations = await getAppliedMigrations(pool)
  console.log(`\n[MIGRATIONS] Already applied: ${appliedMigrations.length} migrations`)
  if (appliedMigrations.length > 0) {
    appliedMigrations.forEach(m => {
      console.log(`[MIGRATIONS]   ✓ ${m.name} (applied at ${m.created_at})`)
    })
  } else {
    console.log('[MIGRATIONS]   No migrations applied yet')
  }

  // CRITICAL FIX: Run essential schema fixes directly via SQL
  // This bypasses Drizzle's migration system which isn't tracking properly
  // Each ALTER TABLE is run separately to avoid multi-statement issues
  console.log('\n[MIGRATIONS] Running critical schema fixes directly...')

  const schemaFixes = [
    // client_service_team_members columns
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2)` },
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10, 2)` },
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE` },
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS end_date DATE` },
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB` },
    { table: 'client_service_team_members', sql: `ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime'` },

    // client_services columns
    { table: 'client_services', sql: `ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_title TEXT` },
    { table: 'client_services', sql: `ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_level_price NUMERIC(10, 2)` },
    { table: 'client_services', sql: `ALTER TABLE client_services ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255)` },

    // team_members columns
    { table: 'team_members', sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS position TEXT` },
    { table: 'team_members', sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE` },
    { table: 'team_members', sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime'` },
    { table: 'team_members', sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT TRUE` },

    // users columns
    { table: 'users', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS team_member_id INTEGER` },
    { table: 'users', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP` },
    { table: 'users', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE` },
    { table: 'users', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)` },
    { table: 'users', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50)` },

    // shifts columns
    { table: 'shifts', sql: `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS service_id INTEGER` },

    // reimbursement_requests columns
    { table: 'reimbursement_requests', sql: `ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS career_year INTEGER DEFAULT 1` },

    // clients columns
    { table: 'clients', sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT` },
  ]

  for (const fix of schemaFixes) {
    try {
      await pool.query(fix.sql)
      console.log(`[MIGRATIONS] ✓ ${fix.table}: column added/verified`)
    } catch (err) {
      const error = err as Error
      console.error(`[MIGRATIONS] ✗ ${fix.table} error:`, error.message)
    }
  }
  console.log('[MIGRATIONS] ✓ All critical schema fixes processed')

  console.log('\n[MIGRATIONS] Running Drizzle migrations...')
  try {
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('[MIGRATIONS] ✓ Drizzle migrations completed')
    
    const afterMigrations = await getAppliedMigrations(pool)
    console.log(`\n[MIGRATIONS] Total migrations in database: ${afterMigrations.length}`)
    if (afterMigrations.length > 0) {
      console.log('[MIGRATIONS] Most recent migrations:')
      afterMigrations.slice(0, 5).forEach(m => {
        console.log(`[MIGRATIONS]   ✓ ${m.name} (${m.created_at})`)
      })
    }

    // Debug: Check table again after migration
    try {
      const tableCheckAfter = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '__drizzle_migrations'
        ) as exists
      `)
      console.log(`[MIGRATIONS] __drizzle_migrations table exists AFTER migration: ${tableCheckAfter.rows[0]?.exists}`)

      // Check table contents directly
      if (tableCheckAfter.rows[0]?.exists) {
        const contents = await pool.query('SELECT * FROM __drizzle_migrations LIMIT 5')
        console.log(`[MIGRATIONS] __drizzle_migrations contents (first 5):`, contents.rows)
      }
    } catch (e) {
      console.error('[MIGRATIONS] Error checking after migration:', e)
    }

    // Check if client_service_team_members was created
    try {
      const cstmCheckAfter = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'client_service_team_members'
        ORDER BY ordinal_position
      `)
      console.log(`[MIGRATIONS] client_service_team_members columns:`, cstmCheckAfter.rows.map(r => r.column_name))
    } catch (e) {
      console.error('[MIGRATIONS] Error checking client_service_team_members columns:', e)
    }
    
    console.log('========================================')
    console.log('✓ Migrations completed successfully!')
    console.log('========================================')
  } catch (error) {
    const err = error as Error & { code?: string; detail?: string }
    console.error('========================================')
    console.error('✗ Migration error occurred!')
    console.error('========================================')
    console.error('[MIGRATIONS] Error message:', err.message)
    console.error('[MIGRATIONS] Error code:', err.code)
    console.error('[MIGRATIONS] Error detail:', err.detail)
    console.error('[MIGRATIONS] Full error:', error)
    console.error('========================================')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
 process.exit(0)
})
