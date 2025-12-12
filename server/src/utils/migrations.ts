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
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;')
  }
}

