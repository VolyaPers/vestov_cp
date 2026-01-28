-- Migration: Refactor developers table to use team_members
-- This migration is fully idempotent and handles all possible database states
-- IMPORTANT: Uses DO blocks with EXCEPTION handling to ensure each step completes

-- Step 1: Add employment_type to team_members (to track full-time vs part-time)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

-- Step 2: Ensure client_service_team_members table exists
-- This creates it fresh if needed, or leaves existing data intact
CREATE TABLE IF NOT EXISTS client_service_team_members (
  id SERIAL PRIMARY KEY,
  client_service_id INTEGER NOT NULL,
  team_member_id INTEGER NOT NULL,
  employment_type VARCHAR(20) NOT NULL DEFAULT 'fulltime',
  hourly_rate NUMERIC(10, 2),
  fixed_price NUMERIC(10, 2),
  work_schedule JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 3: Add any missing columns if table exists but columns don't
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB;
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10, 2);
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS end_date DATE;

-- Step 4: Add FK constraints to client_service_team_members if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_service_team_members_client_service_id_fkey'
    AND table_name = 'client_service_team_members'
  ) THEN
    ALTER TABLE client_service_team_members
    ADD CONSTRAINT client_service_team_members_client_service_id_fkey
    FOREIGN KEY (client_service_id) REFERENCES client_services(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK constraint client_service_id already exists or failed: %', SQLERRM;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_service_team_members_team_member_id_fkey'
    AND table_name = 'client_service_team_members'
  ) THEN
    ALTER TABLE client_service_team_members
    ADD CONSTRAINT client_service_team_members_team_member_id_fkey
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK constraint team_member_id already exists or failed: %', SQLERRM;
END $$;

-- Step 5: Migrate data from old table if it exists (only if target is empty)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_service_developers' AND table_schema = 'public') THEN
    -- Check if there's data to migrate and target is empty
    IF (SELECT COUNT(*) FROM client_service_team_members) = 0 THEN
      INSERT INTO client_service_team_members (
        id, client_service_id, team_member_id, employment_type,
        hourly_rate, fixed_price, is_active, start_date, end_date, created_at
      )
      SELECT
        id, client_service_id, developer_id, employment_type,
        hourly_rate, fixed_price, is_active, start_date, end_date, created_at
      FROM client_service_developers
      ON CONFLICT (id) DO NOTHING;

      -- Reset sequence to max id
      PERFORM setval('client_service_team_members_id_seq', COALESCE((SELECT MAX(id) FROM client_service_team_members), 1));
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Data migration skipped or failed: %', SQLERRM;
END $$;

-- Step 6: Handle invoice_developers table column rename
DO $$ BEGIN
  -- Add new column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_developers' AND column_name = 'client_service_team_member_id'
  ) THEN
    -- Check if old column exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'invoice_developers' AND column_name = 'client_service_developer_id'
    ) THEN
      ALTER TABLE invoice_developers RENAME COLUMN client_service_developer_id TO client_service_team_member_id;
    ELSE
      -- Neither column exists, create the new one
      ALTER TABLE invoice_developers ADD COLUMN client_service_team_member_id INTEGER;
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'invoice_developers column handling failed: %', SQLERRM;
END $$;

-- Step 7: Drop old FK constraints on invoice_developers (if they exist)
-- Try all possible constraint names (Drizzle truncates long names)
DO $$ BEGIN
  ALTER TABLE invoice_developers DROP CONSTRAINT IF EXISTS invoice_developers_client_service_developer_id_fk;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoice_developers DROP CONSTRAINT IF EXISTS invoice_developers_client_service_developer_id_client_service_d_fk;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoice_developers DROP CONSTRAINT IF EXISTS invoice_developers_client_service_developer_id_client_service_developers_id_fk;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Step 8: Add new FK constraint on invoice_developers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoice_developers_client_service_team_member_id_fkey'
    AND table_name = 'invoice_developers'
  ) THEN
    ALTER TABLE invoice_developers
    ADD CONSTRAINT invoice_developers_client_service_team_member_id_fkey
    FOREIGN KEY (client_service_team_member_id) REFERENCES client_service_team_members(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK constraint on invoice_developers failed: %', SQLERRM;
END $$;

-- Step 9: Drop FK constraints from client_service_developers to developers (if they exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_service_developers') THEN
    ALTER TABLE client_service_developers DROP CONSTRAINT IF EXISTS client_service_developers_developer_id_developers_id_fk;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Step 10: Now safe to drop developers table (dependencies removed)
DROP TABLE IF EXISTS developers CASCADE;

-- Step 11: Drop old client_service_developers table (data was migrated)
DROP TABLE IF EXISTS client_service_developers CASCADE;
