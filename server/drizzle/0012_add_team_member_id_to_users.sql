-- Add team_member_id column to users table (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_member_id INTEGER;

-- Add foreign key constraint (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_team_member_id_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_team_member_id_fk
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_team_member_id ON users(team_member_id);

-- Update existing team_member users to link them by email (one-time migration)
UPDATE users u
SET team_member_id = tm.id
FROM team_members tm
WHERE u.role = 'team_member'
  AND u.email = tm.email
  AND u.team_member_id IS NULL;
