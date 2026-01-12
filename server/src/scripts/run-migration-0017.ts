import '../env.js'
import { pool } from '../db/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
  console.log('========================================')
  console.log('Running migration 0017: Add career_year to reimbursements')
  console.log('========================================')
  
  try {
    const migrationPath = path.join(__dirname, '../../drizzle/0017_add_career_year_to_reimbursements.sql')
    console.log('Migration file path:', migrationPath)
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    console.log('Executing migration SQL...')
    
    await pool.query(migrationSQL)
    
    console.log('✓ Migration 0017 completed successfully!')
    console.log('========================================')
  } catch (error) {
    console.error('✗ Migration failed:', error)
    const err = error as Error
    console.error('Error details:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()

