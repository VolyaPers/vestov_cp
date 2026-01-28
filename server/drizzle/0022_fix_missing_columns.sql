-- Migration: Fix missing columns across all tables
-- This migration ensures all columns defined in the schema exist in the database
-- Uses IF NOT EXISTS to safely run even if columns already exist

-- client_services table
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_level_price NUMERIC(10, 2);
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255);

-- team_members table
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

-- reimbursement_requests table
ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS career_year INTEGER DEFAULT 1;

-- shifts table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS service_id INTEGER;

-- users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_member_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50);

-- clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create client_service_team_members if it doesn't exist (renamed from client_service_developers)
CREATE TABLE IF NOT EXISTS client_service_team_members (
  id SERIAL PRIMARY KEY,
  client_service_id INTEGER NOT NULL REFERENCES client_services(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  employment_type VARCHAR(20) NOT NULL DEFAULT 'fulltime',
  hourly_rate NUMERIC(10, 2),
  fixed_price NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index on shifts.service_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_shifts_service_id ON shifts(service_id);

-- Create indexes on users for OAuth if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
