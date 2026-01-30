/**
 * Script to identify and clean up test users from the database
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-users.ts --list       # List test users (dry run)
 *   npx tsx scripts/cleanup-test-users.ts --deactivate # Deactivate test users
 *   npx tsx scripts/cleanup-test-users.ts --delete     # Delete test users
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { users } from '../src/db/schema.js'
import { inArray } from 'drizzle-orm'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal'

const pool = new Pool({
  connectionString: DATABASE_URL,
})

const db = drizzle(pool)

// Patterns that identify test users (SQL LIKE patterns)
const TEST_PATTERNS = {
  // Email patterns
  emails: [
    '%test%@%',
    '%testclient%',
    '%selfreg%',
    '%@test.%',
  ],
  // Username patterns
  usernames: [
    'test%',
    'testclient%',
    'selfreg%',
  ],
  // Name patterns
  names: [
    'SelfReg%',
    'Test %',
    'Test User%',
  ]
}

// Users to NEVER delete (protect real admin accounts)
const PROTECTED_EMAILS = [
  'jessica@vestov.com',
  'admin@vestov.com',
  'jessica.ferreira@vestov.com',
  // Add any other emails you want to protect
]

async function findTestUsers() {
  // Build dynamic OR conditions for all patterns
  const conditions: string[] = []

  for (const pattern of TEST_PATTERNS.emails) {
    conditions.push(`LOWER(email) LIKE LOWER('${pattern}')`)
  }
  for (const pattern of TEST_PATTERNS.usernames) {
    conditions.push(`LOWER(username) LIKE LOWER('${pattern}')`)
  }
  for (const pattern of TEST_PATTERNS.names) {
    conditions.push(`LOWER(full_name) LIKE LOWER('${pattern}')`)
  }

  const orConditions = conditions.join(' OR ')
  const protectedList = PROTECTED_EMAILS.map(e => `'${e}'`).join(', ')

  // Use raw SQL for complex pattern matching
  const result = await pool.query(`
    SELECT id, username, email, full_name, role, is_active, created_at, last_login_at
    FROM users
    WHERE (${orConditions})
      AND email NOT IN (${protectedList})
    ORDER BY created_at
  `)

  return result.rows
}

async function listTestUsers() {
  console.log('\n🔍 Searching for test users...\n')

  const testUsers = await findTestUsers()

  if (testUsers.length === 0) {
    console.log('✅ No test users found!')
    return []
  }

  console.log(`Found ${testUsers.length} test users:\n`)
  console.log('─'.repeat(120))
  console.log(
    'ID'.padEnd(6) +
    'Username'.padEnd(25) +
    'Email'.padEnd(35) +
    'Name'.padEnd(25) +
    'Role'.padEnd(12) +
    'Active'.padEnd(8) +
    'Created'
  )
  console.log('─'.repeat(120))

  for (const user of testUsers) {
    console.log(
      String(user.id).padEnd(6) +
      (user.username || '').slice(0, 23).padEnd(25) +
      (user.email || '').slice(0, 33).padEnd(35) +
      (user.full_name || '').slice(0, 23).padEnd(25) +
      (user.role || '').padEnd(12) +
      (user.is_active ? 'Yes' : 'No').padEnd(8) +
      (user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A')
    )
  }

  console.log('─'.repeat(120))
  console.log(`\nTotal: ${testUsers.length} test users`)

  return testUsers
}

async function deactivateTestUsers() {
  const testUsers = await listTestUsers()

  if (testUsers.length === 0) return

  console.log('\n⚠️  Deactivating test users...\n')

  const userIds = testUsers.map((u: { id: number }) => u.id)

  await db.update(users)
    .set({ isActive: false })
    .where(inArray(users.id, userIds))

  console.log(`✅ Deactivated ${testUsers.length} test users`)
}

async function deleteTestUsers() {
  const testUsers = await listTestUsers()

  if (testUsers.length === 0) return

  console.log('\n⚠️  DELETING test users (this cannot be undone)...\n')

  const userIds = testUsers.map((u: { id: number }) => u.id)

  await db.delete(users)
    .where(inArray(users.id, userIds))

  console.log(`✅ Deleted ${testUsers.length} test users`)
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || '--list'

  try {
    switch (mode) {
      case '--list':
        await listTestUsers()
        break
      case '--deactivate':
        await deactivateTestUsers()
        break
      case '--delete':
        await deleteTestUsers()
        break
      default:
        console.log('Usage:')
        console.log('  npx tsx scripts/cleanup-test-users.ts --list       # List test users (dry run)')
        console.log('  npx tsx scripts/cleanup-test-users.ts --deactivate # Deactivate test users')
        console.log('  npx tsx scripts/cleanup-test-users.ts --delete     # Delete test users')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
