import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  console.log('Running migrations...')
  const migrationsPath = path.join(__dirname, '../drizzle')
  console.log('Migrations folder:', migrationsPath)
  
  try {
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('Migrations completed!')
  } catch (error) {
    console.error('Migration error:', error)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
 process.exit(0)
})