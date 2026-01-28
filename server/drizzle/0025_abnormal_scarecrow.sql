-- Migration 0025: Full schema sync (idempotent)
-- All operations use IF NOT EXISTS / IF EXISTS for safety

-- Create tables if they don't exist
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

CREATE TABLE IF NOT EXISTS "reimbursement_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"year" integer NOT NULL,
	"career_year" integer NOT NULL,
	"expense_amount" numeric(10, 2) NOT NULL,
	"reimbursement_amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_by" integer NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"approval_note" text,
	"evidence_url" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shift_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"break_type" varchar(20) DEFAULT 'regular',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shift_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"schedule_id" integer,
	"service_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_late" boolean DEFAULT false,
	"late_minutes" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Ensure client_service_team_members table exists (may have been renamed or created fresh)
CREATE TABLE IF NOT EXISTS "client_service_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
	"team_member_id" integer NOT NULL,
	"employment_type" varchar(20) DEFAULT 'fulltime' NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"work_schedule" jsonb,
	"is_active" boolean DEFAULT true,
	"start_date" date DEFAULT CURRENT_DATE NOT NULL,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Drop legacy tables safely
DROP TABLE IF EXISTS "developers" CASCADE;
DROP TABLE IF EXISTS "client_service_developers" CASCADE;

-- Add columns with IF NOT EXISTS
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "work_schedule" jsonb;
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2);
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "fixed_price" numeric(10, 2);
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "start_date" date DEFAULT CURRENT_DATE;
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE "client_service_team_members" ADD COLUMN IF NOT EXISTS "employment_type" varchar(20) DEFAULT 'fulltime';

ALTER TABLE "client_services" ADD COLUMN IF NOT EXISTS "service_title" text;
ALTER TABLE "client_services" ADD COLUMN IF NOT EXISTS "slack_channel_id" varchar(255);

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logo_url" text;

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "is_developer" boolean DEFAULT false;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "team_member_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar(50);

ALTER TABLE "invoice_developers" ADD COLUMN IF NOT EXISTS "client_service_team_member_id" integer;

-- Handle employment_cycles.cycle_midpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employment_cycles' AND column_name = 'cycle_midpoint'
  ) THEN
    ALTER TABLE "employment_cycles" ADD COLUMN "cycle_midpoint" date;
    UPDATE "employment_cycles" SET "cycle_midpoint" = "start_date" WHERE "cycle_midpoint" IS NULL;
  END IF;
END $$;

-- Make password nullable (safe to run multiple times)
DO $$ BEGIN
  ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make contract_type nullable (safe to run multiple times)
DO $$ BEGIN
  ALTER TABLE "clients" ALTER COLUMN "contract_type" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add FK constraints if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_users_client_id_clients_id_fk') THEN
    ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_users_user_id_users_id_fk') THEN
    ALTER TABLE "client_users" ADD CONSTRAINT "client_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_users_assigned_by_users_id_fk') THEN
    ALTER TABLE "client_users" ADD CONSTRAINT "client_users_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reimbursement_requests_employee_id_team_members_id_fk') THEN
    ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "team_members"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reimbursement_requests_requested_by_users_id_fk') THEN
    ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reimbursement_requests_approved_by_users_id_fk') THEN
    ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'shift_breaks_shift_id_shifts_id_fk') THEN
    ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'shift_schedules_employee_id_team_members_id_fk') THEN
    ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "team_members"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'shifts_employee_id_team_members_id_fk') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "team_members"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'shifts_schedule_id_shift_schedules_id_fk') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "shift_schedules"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'shifts_service_id_client_services_id_fk') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_service_id_client_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "client_services"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_service_team_members_client_service_id_client_services_id_fk') THEN
    ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "client_services"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_service_team_members_team_member_id_team_members_id_fk') THEN
    ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invoice_developers_client_service_team_member_id_client_service_team_members_id_fk') THEN
    ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_client_service_team_member_id_client_service_team_members_id_fk" FOREIGN KEY ("client_service_team_member_id") REFERENCES "client_service_team_members"("id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add unique constraint on google_id if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_google_id_unique') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop old users.client_id column if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_client_id_clients_id_fk";
    ALTER TABLE "users" DROP COLUMN "client_id";
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
