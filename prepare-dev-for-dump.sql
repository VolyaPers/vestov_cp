
-- ============================================
-- SQL to prepare DEV environment before importing dump
-- Execute this file in Neon SQL console BEFORE importing vestov_portal_data.sql
-- ============================================

-- ============================================
-- PART 1: Create tables that don't exist in DEV
-- ============================================

-- 1.1. reimbursement_requests table
CREATE TABLE IF NOT EXISTS "reimbursement_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"year" integer NOT NULL,
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

-- Foreign keys for reimbursement_requests
DO $$ BEGIN
 ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 1.2. Shifts system tables
CREATE TABLE IF NOT EXISTS "shift_schedules" (
  "id" SERIAL PRIMARY KEY,
  "employee_id" INTEGER NOT NULL REFERENCES "team_members"("id"),
  "day_of_week" INTEGER NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shifts" (
  "id" SERIAL PRIMARY KEY,
  "employee_id" INTEGER NOT NULL REFERENCES "team_members"("id"),
  "schedule_id" INTEGER REFERENCES "shift_schedules"("id"),
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "is_late" BOOLEAN DEFAULT false,
  "late_minutes" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shift_breaks" (
  "id" SERIAL PRIMARY KEY,
  "shift_id" INTEGER NOT NULL REFERENCES "shifts"("id"),
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP,
  "break_type" VARCHAR(20) DEFAULT 'regular',
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for shifts
CREATE INDEX IF NOT EXISTS "shift_schedules_employee_id_idx" ON "shift_schedules"("employee_id");
CREATE INDEX IF NOT EXISTS "shifts_employee_id_idx" ON "shifts"("employee_id");
CREATE INDEX IF NOT EXISTS "shifts_status_idx" ON "shifts"("status");
CREATE INDEX IF NOT EXISTS "shifts_start_time_idx" ON "shifts"("start_time");
CREATE INDEX IF NOT EXISTS "shift_breaks_shift_id_idx" ON "shift_breaks"("shift_id");

-- 1.3. user_invites table
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

-- ============================================
-- PART 2: Add missing columns to existing tables
-- ============================================

-- 2.1. Add work_schedule to client_service_developers
ALTER TABLE client_service_developers
ADD COLUMN IF NOT EXISTS work_schedule jsonb;

COMMENT ON COLUMN client_service_developers.work_schedule IS 'Work schedule for developer: {"monday": "full", "tuesday": "full", "wednesday": "half", "thursday": "off", "friday": "full", "saturday": "off", "sunday": "off"}';

-- 2.2. Add logo_url to clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2.3. Add cycle_midpoint to employment_cycles
ALTER TABLE employment_cycles 
ADD COLUMN IF NOT EXISTS cycle_midpoint DATE;

-- Calculate and populate midpoint for existing cycles (if any)
UPDATE employment_cycles
SET cycle_midpoint = cycle_start + INTERVAL '6 months'
WHERE cycle_midpoint IS NULL AND cycle_start IS NOT NULL;

-- Make NOT NULL after populating (if no NULL values exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employment_cycles WHERE cycle_midpoint IS NULL
  ) THEN
    ALTER TABLE employment_cycles ALTER COLUMN cycle_midpoint SET NOT NULL;
  END IF;
END $$;

-- ============================================
-- END
-- ============================================
-- After executing this file, you can import the dump:
-- 1. Copy the content of vestov_portal_data.sql
-- 2. Paste it in Neon SQL console
-- 3. Execute
-- ============================================

