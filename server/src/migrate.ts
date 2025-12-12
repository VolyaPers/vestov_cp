import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  console.log('========================================')
  console.log('Running database migrations...')
  console.log('========================================')
  const migrationsPath = path.join(__dirname, '../drizzle')
  console.log('Migrations folder:', migrationsPath)
  console.log('Database URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
  
  try {
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('========================================')
    console.log('✓ Migrations completed successfully!')
    console.log('========================================')
  } catch (error) {
    console.error('========================================')
    console.error('✗ Migration error:', error)
    console.error('========================================')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
 process.exit(0)
})