-- Add work_schedule column to client_service_team_members table
-- This migration is idempotent and handles both old and new table names

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB;
