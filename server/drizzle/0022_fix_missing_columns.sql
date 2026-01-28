-- Migration: Safety net - ensures all columns exist across all tables
-- This is a backup migration that fixes any missing columns
-- All operations use IF NOT EXISTS/IF EXISTS to be fully idempotent

-- ============================================
-- CLIENT_SERVICES TABLE
-- ============================================
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_level_price NUMERIC(10, 2);
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255);

-- ============================================
-- TEAM_MEMBERS TABLE
-- ============================================
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT TRUE;

-- ============================================
-- REIMBURSEMENT_REQUESTS TABLE
-- ============================================
ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS career_year INTEGER DEFAULT 1;

-- ============================================
-- SHIFTS TABLE
-- ============================================
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS service_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_shifts_service_id ON shifts(service_id);

-- ============================================
-- USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_member_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- ============================================
-- CLIENTS TABLE
-- ============================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ============================================
-- CLIENT_SERVICE_TEAM_MEMBERS TABLE (ensure it exists with all columns)
-- ============================================
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

-- Add any missing columns to existing table
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB;
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

-- Add FK constraints if missing
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
EXCEPTION WHEN others THEN NULL;
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
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- INVOICE_DEVELOPERS TABLE (ensure correct column name and FK)
-- ============================================
-- Handle column rename or creation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_developers' AND column_name = 'client_service_team_member_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'invoice_developers' AND column_name = 'client_service_developer_id'
    ) THEN
      ALTER TABLE invoice_developers RENAME COLUMN client_service_developer_id TO client_service_team_member_id;
    ELSE
      ALTER TABLE invoice_developers ADD COLUMN client_service_team_member_id INTEGER;
    END IF;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop old FK constraints before adding new one
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

-- Add FK constraint if missing
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
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- CLEANUP: Remove legacy tables (after FK constraints are dropped)
-- ============================================
-- First drop FK constraints from client_service_developers to developers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_service_developers') THEN
    ALTER TABLE client_service_developers DROP CONSTRAINT IF EXISTS client_service_developers_developer_id_developers_id_fk;
    ALTER TABLE client_service_developers DROP CONSTRAINT IF EXISTS client_service_developers_client_service_id_client_services_id_fk;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DROP TABLE IF EXISTS developers CASCADE;
DROP TABLE IF EXISTS client_service_developers CASCADE;
