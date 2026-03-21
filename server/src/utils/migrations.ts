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

  // clerk_user_id (Clerk support)
  const hasClerkUserId = await checkColumnExists(pool, 'users', 'clerk_user_id')
  if (!hasClerkUserId) {
    console.log('[MIGRATIONS] Adding missing column: clerk_user_id (Clerk support)')
    await pool.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" VARCHAR(255) UNIQUE;')
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_users_clerk_user_id" ON "users" ("clerk_user_id");')
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

export async function ensureFinanceTables(pool: Pool): Promise<void> {
  try {
    const hasMonthlySalaryExtras = await checkColumnExists(pool, 'team_members', 'monthly_salary_extras')
    if (!hasMonthlySalaryExtras) {
      console.log('[MIGRATIONS] Adding missing column: team_members.monthly_salary_extras')
      await pool.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "monthly_salary_extras" jsonb;`)
    }
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not ensure team_members.monthly_salary_extras:', err.message)
  }

  // financial_transactions
  try {
    const hasFT = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'financial_transactions'
    `)
    if (hasFT.rows.length === 0) {
      console.log('[MIGRATIONS] Creating missing table: financial_transactions')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "financial_transactions" (
          "id" serial PRIMARY KEY NOT NULL,
          "type" varchar(20) NOT NULL,
          "category" text,
          "amount" numeric(12, 2) NOT NULL,
          "description" text,
          "transaction_date" date NOT NULL,
          "team_member_id" integer REFERENCES "team_members"("id"),
          "client_id" integer REFERENCES "clients"("id"),
          "invoice_id" integer REFERENCES "invoices"("id"),
          "is_recurring" boolean DEFAULT false,
          "created_by" integer NOT NULL REFERENCES "users"("id"),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_ft_type" ON "financial_transactions" ("type");
        CREATE INDEX IF NOT EXISTS "idx_ft_date" ON "financial_transactions" ("transaction_date");
        CREATE INDEX IF NOT EXISTS "idx_ft_team_member" ON "financial_transactions" ("team_member_id");
      `)
    }
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not ensure financial_transactions:', err.message)
  }

  // finance_categories
  try {
    const hasFC = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'finance_categories'
    `)
    if (hasFC.rows.length === 0) {
      console.log('[MIGRATIONS] Creating missing table: finance_categories')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "finance_categories" (
          "id" serial PRIMARY KEY NOT NULL,
          "kind" varchar(20) NOT NULL,
          "name" text NOT NULL,
          "created_by" integer REFERENCES "users"("id"),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_finance_categories_kind" ON "finance_categories" ("kind");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_categories_kind_name_lower"
          ON "finance_categories" ("kind", lower("name"));
      `)
    }

    await pool.query(`
      INSERT INTO "finance_categories" ("kind", "name")
      SELECT 'income', x.name
      FROM (VALUES
        ('Client Payment'),
        ('Consulting'),
        ('Service Fee'),
        ('Other Income')
      ) AS x(name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM "finance_categories" fc
        WHERE fc."kind" = 'income'
          AND lower(fc."name") = lower(x.name)
      );
    `)

    await pool.query(`
      INSERT INTO "finance_categories" ("kind", "name")
      SELECT 'expense', x.name
      FROM (VALUES
        ('Software'),
        ('Operations'),
        ('Marketing'),
        ('Office'),
        ('Tax'),
        ('Other Cost')
      ) AS x(name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM "finance_categories" fc
        WHERE fc."kind" = 'expense'
          AND lower(fc."name") = lower(x.name)
      );
    `)
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not ensure finance_categories:', err.message)
  }

  // integration_settings
  try {
    const hasIS = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'integration_settings'
    `)
    if (hasIS.rows.length === 0) {
      console.log('[MIGRATIONS] Creating missing table: integration_settings')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "integration_settings" (
          "id" serial PRIMARY KEY NOT NULL,
          "provider" varchar(50) NOT NULL,
          "credentials" text NOT NULL DEFAULT '',
          "is_active" boolean DEFAULT false,
          "last_sync_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "integration_settings_provider_unique" UNIQUE("provider")
        );
      `)
    }
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not ensure integration_settings:', err.message)
  }

  // salary_rate_history
  try {
    const hasSRH = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'salary_rate_history'
    `)
    if (hasSRH.rows.length === 0) {
      console.log('[MIGRATIONS] Creating missing table: salary_rate_history')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "salary_rate_history" (
          "id" serial PRIMARY KEY NOT NULL,
          "team_member_id" integer NOT NULL REFERENCES "team_members"("id"),
          "monthly_rate" numeric(10, 2) NOT NULL,
          "effective_date" date NOT NULL,
          "note" text,
          "created_by" integer NOT NULL REFERENCES "users"("id"),
          "created_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_srh_team_member" ON "salary_rate_history" ("team_member_id");
        CREATE INDEX IF NOT EXISTS "idx_srh_effective_date" ON "salary_rate_history" ("effective_date");
      `)
    }
  } catch (error) {
    const err = error as Error
    console.warn('[MIGRATIONS] Could not ensure salary_rate_history:', err.message)
  }
}
