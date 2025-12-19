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
  const migrationsPath = path.join(__dirname, '../drizzle')
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
  
  const appliedMigrations = await getAppliedMigrations(pool)
  console.log(`\n[MIGRATIONS] Already applied: ${appliedMigrations.length} migrations`)
  if (appliedMigrations.length > 0) {
    appliedMigrations.forEach(m => {
      console.log(`[MIGRATIONS]   ✓ ${m.name} (applied at ${m.created_at})`)
    })
  } else {
    console.log('[MIGRATIONS]   No migrations applied yet')
  }
  
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
