import { Pool } from 'pg'
import type { DrizzleMigration } from '../types/migrations.js'

export async function getAppliedMigrations(pool: Pool): Promise<DrizzleMigration[]> {
  try {
    const result = await pool.query<DrizzleMigration>(`
      SELECT name, hash, created_at 
      FROM __drizzle_migrations 
      ORDER BY created_at DESC
    `)
    return result.rows
  } catch (error) {
    const err = error as Error
    if (err.message && err.message.includes('does not exist')) {
      return []
    }
    throw error
  }
}

export async function checkColumnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await pool.query<{ column_name: string }>(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    `, [tableName, columnName])
    return result.rows.length > 0
  } catch {
    return false
  }
}

export async function ensureIsActiveColumn(pool: Pool): Promise<void> {
  const exists = await checkColumnExists(pool, 'users', 'is_active')
  if (!exists) {
    console.log('[MIGRATIONS] Adding missing column: is_active')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;')
  }
}

export async function ensureUserColumns(pool: Pool): Promise<void> {
  // team_member_id
  const hasTeamMemberId = await checkColumnExists(pool, 'users', 'team_member_id')
  if (!hasTeamMemberId) {
    console.log('[MIGRATIONS] Adding missing column: team_member_id')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "team_member_id" integer;')
  }

  // last_login_at
  const hasLastLoginAt = await checkColumnExists(pool, 'users', 'last_login_at')
  if (!hasLastLoginAt) {
    console.log('[MIGRATIONS] Adding missing column: last_login_at')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;')
  }

  // is_active
  await ensureIsActiveColumn(pool)

  // google_id (OAuth support)
  const hasGoogleId = await checkColumnExists(pool, 'users', 'google_id')
  if (!hasGoogleId) {
    console.log('[MIGRATIONS] Adding missing column: google_id (OAuth support)')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" VARCHAR(255) UNIQUE;')
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_users_google_id" ON "users" ("google_id");')
  }

  // auth_provider (OAuth support)
  const hasAuthProvider = await checkColumnExists(pool, 'users', 'auth_provider')
  if (!hasAuthProvider) {
    console.log('[MIGRATIONS] Adding missing column: auth_provider (OAuth support)')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" VARCHAR(50);')
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_users_auth_provider" ON "users" ("auth_provider");')
    await pool.query('UPDATE "users" SET "auth_provider" = \'local\' WHERE "auth_provider" IS NULL;')
  }

  // Make password nullable for OAuth-only users (safe to run multiple times)
  try {
    const passwordNullableCheck = await pool.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'password'
    `)
    
    if (passwordNullableCheck.rows.length > 0 && passwordNullableCheck.rows[0].is_nullable === 'NO') {
      console.log('[MIGRATIONS] Making password column nullable for OAuth support')
      await pool.query('ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;')
    }
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not check/update password column nullable status:', err.message)
  }
}

