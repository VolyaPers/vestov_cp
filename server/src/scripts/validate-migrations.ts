import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Validates that all SQL migration files are registered in _journal.json
 * This prevents migrations from being missed during deployment
 */
function validateMigrations(): { valid: boolean; missing: string[] } {
  const drizzlePath = path.join(__dirname, '../../drizzle')
  const journalPath = path.join(drizzlePath, 'meta', '_journal.json')

  // Read all SQL files
  const sqlFiles = fs.readdirSync(drizzlePath)
    .filter(f => f.endsWith('.sql') && !f.startsWith('.'))
    .map(f => f.replace('.sql', ''))
    .sort()

  // Read journal
  if (!fs.existsSync(journalPath)) {
    console.error('❌ _journal.json not found!')
    return { valid: false, missing: sqlFiles }
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
  const journalTags = new Set(
    journal.entries?.map((entry: { tag: string }) => entry.tag) || []
  )

  // Find missing migrations
  const missing = sqlFiles.filter(file => !journalTags.has(file))

  return { valid: missing.length === 0, missing }
}

// Run validation
const result = validateMigrations()

if (result.valid) {
  console.log('✅ All migrations are registered in _journal.json')
  process.exit(0)
} else {
  console.error('❌ The following migrations are NOT in _journal.json:')
  result.missing.forEach(m => console.error(`   - ${m}.sql`))
  console.error('\n💡 To fix:')
  console.error('   1. Use "npm run db:generate" to create migrations (recommended)')
  console.error('   2. Or manually add them to server/drizzle/meta/_journal.json')
  console.error('\n📖 See MIGRATION_SOLUTION.md for details')
  process.exit(1)
}

