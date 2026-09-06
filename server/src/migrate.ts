import './env.js'
import { pool } from './db/index.js'
import { runDatabaseMigrations } from './db/migrate.js'

runDatabaseMigrations(pool).catch((error) => {
  console.error('[MIGRATIONS] Failed; all changes rolled back:', error.message)
  process.exitCode = 1
}).finally(() => pool.end())
