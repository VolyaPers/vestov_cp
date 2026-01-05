CREATE TABLE IF NOT EXISTS "user_invites" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_by" integer REFERENCES "users"("id"),
  "source" varchar(50),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_invites_user_id_idx" ON "user_invites" ("user_id");
CREATE INDEX IF NOT EXISTS "user_invites_email_idx" ON "user_invites" ("email");


