-- Migration: Refactor developers table to use team_members
-- This migration consolidates the redundant developers table into team_members
-- and updates all foreign key references

-- Step 1: Add employment_type to team_members (to track full-time vs part-time)
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

COMMENT ON COLUMN team_members.employment_type IS 'Employment type: fulltime or part_time';

-- Step 2: Rename client_service_developers to client_service_team_members
ALTER TABLE client_service_developers 
RENAME TO client_service_team_members;

-- Step 3: Rename developer_id column to team_member_id
ALTER TABLE client_service_team_members 
RENAME COLUMN developer_id TO team_member_id;

-- Step 4: Drop old foreign key constraint
ALTER TABLE client_service_team_members 
DROP CONSTRAINT IF EXISTS client_service_developers_developer_id_developers_id_fk;

-- Step 5: Add new foreign key to team_members
ALTER TABLE client_service_team_members 
ADD CONSTRAINT client_service_team_members_team_member_id_fkey 
FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;

-- Step 6: Update invoice_developers table reference
ALTER TABLE invoice_developers 
RENAME COLUMN client_service_developer_id TO client_service_team_member_id;

ALTER TABLE invoice_developers 
DROP CONSTRAINT IF EXISTS invoice_developers_client_service_developer_id_client_service_d_fk;

ALTER TABLE invoice_developers 
ADD CONSTRAINT invoice_developers_client_service_team_member_id_fkey 
FOREIGN KEY (client_service_team_member_id) REFERENCES client_service_team_members(id) ON DELETE CASCADE;

-- Step 7: Drop developers table (it's empty anyway)
DROP TABLE IF EXISTS developers;
