ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "clerk_user_id" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_clerk_user_id"
ON "users" ("clerk_user_id");
