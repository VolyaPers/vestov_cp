-- Add OAuth fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50);

-- Make password nullable for OAuth-only users
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Create index for google_id lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create index for auth_provider lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Set default auth_provider for existing users
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;
