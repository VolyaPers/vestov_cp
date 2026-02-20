-- Add timezone support for preferred shifts feature
ALTER TABLE team_members ADD COLUMN timezone TEXT;
ALTER TABLE users ADD COLUMN timezone TEXT;
