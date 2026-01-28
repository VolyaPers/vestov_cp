-- Add missing columns to client_service_team_members table
-- This migration is idempotent and ensures all columns exist

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB;
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10, 2);
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS end_date DATE;
