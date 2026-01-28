-- Add work_schedule column to client_service_developers/client_service_team_members table
-- Handle both old and new table names for idempotency

DO $$ BEGIN
  -- Try adding to client_service_developers (old name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_service_developers') THEN
    ALTER TABLE client_service_developers ADD COLUMN IF NOT EXISTS work_schedule jsonb;
  END IF;
  -- Try adding to client_service_team_members (new name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_service_team_members') THEN
    ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule jsonb;
  END IF;
EXCEPTION WHEN others THEN null;
END $$;
