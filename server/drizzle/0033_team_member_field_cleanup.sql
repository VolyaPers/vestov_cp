-- Migration 0033: Team member field cleanup
-- 1. Consolidate role → position (keep only position)
-- 2. Remove isDeveloper (replaced by existing isBillable)
-- 3. Ensure employment_type is NOT NULL with default

-- Step 1: Copy role → position where position is null or empty
UPDATE team_members SET position = role WHERE position IS NULL OR position = '';

-- Step 2: Set default for any remaining null positions
UPDATE team_members SET position = 'Team Member' WHERE position IS NULL;

-- Step 3: Make position NOT NULL
ALTER TABLE team_members ALTER COLUMN position SET NOT NULL;

-- Step 4: Drop the role column (data preserved in position)
ALTER TABLE team_members DROP COLUMN IF EXISTS role;

-- Step 5: Drop is_developer column (replaced by is_billable)
ALTER TABLE team_members DROP COLUMN IF EXISTS is_developer;

-- Step 6: Ensure employment_type has proper defaults and NOT NULL
UPDATE team_members SET employment_type = 'fulltime' WHERE employment_type IS NULL;
ALTER TABLE team_members ALTER COLUMN employment_type SET NOT NULL;
ALTER TABLE team_members ALTER COLUMN employment_type SET DEFAULT 'fulltime';
