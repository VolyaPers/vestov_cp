-- Add user management fields to users table
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;
ALTER TABLE "users" DROP COLUMN IF EXISTS "client_id";

-- Create client_users table for many-to-many relationship
CREATE TABLE IF NOT EXISTS "client_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"access_level" varchar(20) DEFAULT 'read' NOT NULL,
	"is_active" boolean DEFAULT true,
	"assigned_by" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "client_users" ADD CONSTRAINT "client_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "client_users" ADD CONSTRAINT "client_users_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create unique constraint to prevent duplicate client-user assignments
CREATE UNIQUE INDEX IF NOT EXISTS "client_users_client_id_user_id_unique" ON "client_users" ("client_id", "user_id");