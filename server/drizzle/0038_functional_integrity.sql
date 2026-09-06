-- Repair historical journal gaps additively. No legacy personnel or accounting rows are deleted.

-- Create document_folders table for organizing documents by service
CREATE TABLE IF NOT EXISTS "document_folders" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_service_id" integer NOT NULL REFERENCES "client_services"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "parent_folder_id" integer REFERENCES "document_folders"("id") ON DELETE SET NULL,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add new columns to documents table for service-level organization
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "client_service_id" integer REFERENCES "client_services"("id") ON DELETE SET NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "folder_id" integer REFERENCES "document_folders"("id") ON DELETE SET NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "visible_to_client" boolean DEFAULT false NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_document_folders_client_service_id" ON "document_folders"("client_service_id");
CREATE INDEX IF NOT EXISTS "idx_document_folders_parent_folder_id" ON "document_folders"("parent_folder_id");
CREATE INDEX IF NOT EXISTS "idx_documents_client_service_id" ON "documents"("client_service_id");
CREATE INDEX IF NOT EXISTS "idx_documents_folder_id" ON "documents"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_documents_visible_to_client" ON "documents"("visible_to_client");


CREATE TABLE IF NOT EXISTS "financial_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" varchar(20) NOT NULL,
  "category" text,
  "amount" decimal(12, 2) NOT NULL,
  "description" text,
  "transaction_date" date NOT NULL,
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "invoice_id" integer REFERENCES "invoices"("id"),
  "is_recurring" boolean DEFAULT false,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ft_type" ON "financial_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_ft_transaction_date" ON "financial_transactions" ("transaction_date");
CREATE INDEX IF NOT EXISTS "idx_ft_team_member_id" ON "financial_transactions" ("team_member_id");


CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" varchar(50) NOT NULL,
  "credentials" text NOT NULL DEFAULT '',
  "is_active" boolean DEFAULT false,
  "last_sync_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "integration_settings_provider_unique" UNIQUE("provider")
);


-- Add timezone support for preferred shifts feature
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;


CREATE TABLE IF NOT EXISTS shift_schedule_overrides (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES team_members(id),
  override_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(employee_id, override_date)
);


ALTER TABLE team_members ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN NOT NULL DEFAULT true;


CREATE TABLE IF NOT EXISTS "finance_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" varchar(20) NOT NULL,
  "name" text NOT NULL,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_finance_categories_kind" ON "finance_categories" ("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_categories_kind_name_lower" ON "finance_categories" ("kind", lower("name"));

INSERT INTO "finance_categories" ("kind", "name")
SELECT 'income', x.name
FROM (VALUES
  ('Client Payment'),
  ('Consulting'),
  ('Service Fee'),
  ('Other Income')
) AS x(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "finance_categories" fc
  WHERE fc."kind" = 'income'
    AND lower(fc."name") = lower(x.name)
);

INSERT INTO "finance_categories" ("kind", "name")
SELECT 'expense', x.name
FROM (VALUES
  ('Software'),
  ('Operations'),
  ('Marketing'),
  ('Office'),
  ('Tax'),
  ('Other Cost')
) AS x(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "finance_categories" fc
  WHERE fc."kind" = 'expense'
    AND lower(fc."name") = lower(x.name)
);


ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "clerk_user_id" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_clerk_user_id"
ON "users" ("clerk_user_id");


CREATE TABLE IF NOT EXISTS "clickup_member_mappings" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspace_id" varchar(50) NOT NULL,
  "team_member_id" integer NOT NULL REFERENCES "team_members"("id"),
  "clickup_user_id" varchar(50) NOT NULL,
  "clickup_user_name" text NOT NULL,
  "clickup_user_email" varchar(255),
  "last_seen_at" timestamp,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "clickup_member_mappings_team_member_id_unique" UNIQUE("team_member_id"),
  CONSTRAINT "clickup_member_mappings_clickup_user_id_unique" UNIQUE("clickup_user_id")
);

CREATE TABLE IF NOT EXISTS "clickup_sync_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspace_id" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'running',
  "trigger_type" varchar(20) NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "range_start" timestamp NOT NULL,
  "range_end" timestamp NOT NULL,
  "entries_fetched" integer DEFAULT 0 NOT NULL,
  "entries_upserted" integer DEFAULT 0 NOT NULL,
  "entries_skipped" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "details" jsonb,
  "triggered_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clickup_time_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspace_id" varchar(50) NOT NULL,
  "external_id" varchar(100) NOT NULL,
  "clickup_user_id" varchar(50) NOT NULL,
  "clickup_user_name" text NOT NULL,
  "clickup_user_email" varchar(255),
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "client_service_id" integer REFERENCES "client_services"("id"),
  "attribution_status" varchar(20) NOT NULL DEFAULT 'unassigned',
  "task_id" varchar(100),
  "task_name" text,
  "task_status" text,
  "list_id" varchar(100),
  "list_name" text,
  "folder_id" varchar(100),
  "folder_name" text,
  "space_id" varchar(100),
  "space_name" text,
  "duration_ms" numeric(16, 0) NOT NULL,
  "is_billable" boolean,
  "start_at" timestamp,
  "end_at" timestamp,
  "entry_date" date NOT NULL,
  "tags" jsonb,
  "source_data" jsonb,
  "source_updated_at" timestamp,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "clickup_time_entries_external_id_unique" UNIQUE("external_id")
);

CREATE TABLE IF NOT EXISTS "clickup_daily_rollups" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspace_id" varchar(50) NOT NULL,
  "rollup_date" date NOT NULL,
  "clickup_user_id" varchar(50) NOT NULL,
  "clickup_user_name" text NOT NULL,
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "client_service_id" integer REFERENCES "client_services"("id"),
  "attribution_status" varchar(20) NOT NULL DEFAULT 'unassigned',
  "total_duration_ms" numeric(16, 0) NOT NULL,
  "entry_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_clickup_sync_runs_workspace_started_at"
  ON "clickup_sync_runs" ("workspace_id", "started_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_clickup_time_entries_workspace_entry_date"
  ON "clickup_time_entries" ("workspace_id", "entry_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_clickup_time_entries_workspace_clickup_user"
  ON "clickup_time_entries" ("workspace_id", "clickup_user_id");

CREATE INDEX IF NOT EXISTS "idx_clickup_time_entries_team_member"
  ON "clickup_time_entries" ("team_member_id");

CREATE INDEX IF NOT EXISTS "idx_clickup_time_entries_client_service"
  ON "clickup_time_entries" ("client_service_id");

CREATE INDEX IF NOT EXISTS "idx_clickup_daily_rollups_workspace_date"
  ON "clickup_daily_rollups" ("workspace_id", "rollup_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_clickup_daily_rollups_team_member"
  ON "clickup_daily_rollups" ("team_member_id");


CREATE TABLE IF NOT EXISTS "finance_activity_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "action" varchar(50) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" integer NOT NULL,
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "invoice_id" integer REFERENCES "invoices"("id"),
  "transaction_id" integer REFERENCES "financial_transactions"("id"),
  "actor_id" integer NOT NULL REFERENCES "users"("id"),
  "summary" text NOT NULL,
  "before_data" jsonb,
  "after_data" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_entity"
  ON "finance_activity_logs" ("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_team_member"
  ON "finance_activity_logs" ("team_member_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_actor"
  ON "finance_activity_logs" ("actor_id", "created_at" DESC);


ALTER TABLE "client_services"
  ADD COLUMN IF NOT EXISTS "clickup_list_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "clickup_list_name" text,
  ADD COLUMN IF NOT EXISTS "project_bot_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "project_bot_daily_update_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "project_bot_daily_update_time" varchar(5) DEFAULT '09:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "project_bot_timezone" varchar(100) DEFAULT 'Europe/Kyiv' NOT NULL,
  ADD COLUMN IF NOT EXISTS "project_bot_authorized_slack_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "project_bot_last_daily_update_at" timestamp;

CREATE TABLE IF NOT EXISTS "project_bot_slack_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_service_id" integer NOT NULL REFERENCES "client_services"("id") ON DELETE CASCADE,
  "slack_channel_id" varchar(255) NOT NULL,
  "slack_message_ts" varchar(50) NOT NULL,
  "slack_thread_ts" varchar(50),
  "slack_user_id" varchar(50) NOT NULL,
  "request_text" text NOT NULL,
  "classification" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "matched_task_id" varchar(100),
  "matched_task_name" text,
  "matched_task_url" text,
  "similarity_score" numeric(5, 4),
  "clickup_task_id" varchar(100),
  "clickup_task_url" text,
  "regression_count" integer DEFAULT 0 NOT NULL,
  "resolved_by_slack_user_id" varchar(50),
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_bot_slack_requests_channel_message_unique"
  ON "project_bot_slack_requests" ("slack_channel_id", "slack_message_ts");
CREATE INDEX IF NOT EXISTS "project_bot_slack_requests_service_status_idx"
  ON "project_bot_slack_requests" ("client_service_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "project_bot_task_snapshots" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_service_id" integer NOT NULL REFERENCES "client_services"("id") ON DELETE CASCADE,
  "clickup_task_id" varchar(100) NOT NULL,
  "clickup_list_id" varchar(100) NOT NULL,
  "task_name" text NOT NULL,
  "current_status" varchar(50) NOT NULL,
  "previous_status" varchar(50),
  "last_reported_status" varchar(50),
  "owner_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "priority" varchar(30),
  "source_updated_at" timestamp,
  "source_done_at" timestamp,
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_status_changed_at" timestamp DEFAULT now() NOT NULL,
  "last_reported_at" timestamp,
  "carryover_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_bot_task_snapshots_service_task_unique"
  ON "project_bot_task_snapshots" ("client_service_id", "clickup_task_id");
CREATE INDEX IF NOT EXISTS "project_bot_task_snapshots_service_status_idx"
  ON "project_bot_task_snapshots" ("client_service_id", "current_status");


ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10, 2);

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS work_schedule JSONB;


      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'client_service_team_members'
          AND column_name = 'work_schedule'
          AND data_type = 'character varying'
        ) THEN
          ALTER TABLE client_service_team_members
          ALTER COLUMN work_schedule TYPE JSONB
          USING CASE WHEN work_schedule IS NOT NULL AND work_schedule != '' THEN work_schedule::jsonb ELSE NULL END;
        END IF;
      END $$;
    

ALTER TABLE client_service_team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_title TEXT;

ALTER TABLE client_services ADD COLUMN IF NOT EXISTS service_level_price NUMERIC(10, 2);

ALTER TABLE client_services ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255);

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS position TEXT;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT TRUE;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS monthly_salary_extras JSONB;

ALTER TABLE users ADD COLUMN IF NOT EXISTS team_member_id INTEGER;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50);

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS service_id INTEGER;

ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS career_year INTEGER DEFAULT 1;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;


      CREATE TABLE IF NOT EXISTS "document_folders" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_service_id" integer NOT NULL REFERENCES "client_services"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "parent_folder_id" integer REFERENCES "document_folders"("id") ON DELETE SET NULL,
        "created_by" integer NOT NULL REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    

ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_service_id INTEGER REFERENCES client_services(id) ON DELETE SET NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES document_folders(id) ON DELETE SET NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_title TEXT;

ALTER TABLE documents ALTER COLUMN type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_folders_client_service_id ON document_folders(client_service_id);

CREATE INDEX IF NOT EXISTS idx_document_folders_parent_folder_id ON document_folders(parent_folder_id);

CREATE INDEX IF NOT EXISTS idx_documents_client_service_id ON documents(client_service_id);

CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);

CREATE INDEX IF NOT EXISTS idx_documents_visible_to_client ON documents(visible_to_client);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS client_service_id INTEGER REFERENCES client_services(id);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_response TEXT;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_responded_by INTEGER REFERENCES users(id);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_responded_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_feedback_client_service_id ON feedback(client_service_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON feedback(client_id);


CREATE TABLE IF NOT EXISTS salary_rate_history (
 id serial PRIMARY KEY, team_member_id integer NOT NULL REFERENCES team_members(id),
 monthly_rate numeric(10,2) NOT NULL, effective_date date NOT NULL, note text,
 created_by integer NOT NULL REFERENCES users(id), created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE salary_rate_history ADD COLUMN IF NOT EXISTS monthly_extras jsonb;
CREATE TABLE IF NOT EXISTS payroll_periods (
 id serial PRIMARY KEY, team_member_id integer NOT NULL REFERENCES team_members(id),
 salary_month varchar(7) NOT NULL, currency varchar(3) NOT NULL DEFAULT 'USD',
 base_salary numeric(12,2) NOT NULL, default_extras jsonb NOT NULL DEFAULT '[]',
 status varchar(20) NOT NULL DEFAULT 'open', calculation_note text, created_by integer REFERENCES users(id),
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_employee_month_unique ON payroll_periods(team_member_id,salary_month);
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS payroll_period_id integer REFERENCES payroll_periods(id);
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS payroll_data jsonb;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS idempotency_key varchar(100);
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS voided_at timestamp;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS void_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_idempotency_key_unique ON financial_transactions(idempotency_key);
ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS payment_transaction_id integer REFERENCES financial_transactions(id);
ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS paid_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS reimbursement_requests_payment_transaction_id_unique ON reimbursement_requests(payment_transaction_id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS archived_at timestamp;
-- Existing conflicting active rows require explicit reconciliation; migration fails atomically.
CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_employee ON shifts(employee_id) WHERE end_time IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shift_breaks_one_open_per_shift ON shift_breaks(shift_id) WHERE end_time IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shift_schedules_active_day_unique ON shift_schedules(employee_id,day_of_week) WHERE is_active=true;
-- Repeated legacy balance reads created identical cycles. Consolidate only exact
-- duplicates, retaining complete originals in an immutable migration archive.
CREATE TABLE IF NOT EXISTS migration_reconciliation_archive (
 id serial PRIMARY KEY, migration text NOT NULL, entity_type text NOT NULL,
 original_id integer NOT NULL, canonical_id integer NOT NULL, original_data jsonb NOT NULL,
 archived_at timestamp NOT NULL DEFAULT now(), UNIQUE(migration,entity_type,original_id)
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM employment_cycles GROUP BY employee_id,cycle_start HAVING count(DISTINCT (cycle_end,cycle_midpoint))>1) THEN
  RAISE EXCEPTION 'Conflicting employment cycle definitions require review; no data changed';
 END IF;
 IF EXISTS(SELECT 1 FROM leave_balances b JOIN employment_cycles c ON c.id=b.employment_cycle_id GROUP BY b.employee_id,c.cycle_start,b.leave_type_id HAVING count(DISTINCT (b.total_days,COALESCE(b.adjustment_days,0)))>1) THEN
  RAISE EXCEPTION 'Conflicting leave allocations require review; no data changed';
 END IF;
END $$;
CREATE TEMP TABLE cycle_merge ON COMMIT DROP AS SELECT id, min(id) OVER(PARTITION BY employee_id,cycle_start) AS canonical_id FROM employment_cycles;
CREATE TEMP TABLE balance_merge ON COMMIT DROP AS SELECT b.id, min(b.id) OVER(PARTITION BY b.employee_id,c.canonical_id,b.leave_type_id) AS canonical_id FROM leave_balances b JOIN cycle_merge c ON c.id=b.employment_cycle_id;
INSERT INTO migration_reconciliation_archive(migration,entity_type,original_id,canonical_id,original_data)
 SELECT '0038','leave_balance',b.id,m.canonical_id,to_jsonb(b) FROM leave_balances b JOIN balance_merge m ON m.id=b.id WHERE m.id<>m.canonical_id ON CONFLICT DO NOTHING;
INSERT INTO migration_reconciliation_archive(migration,entity_type,original_id,canonical_id,original_data)
 SELECT '0038','employment_cycle',c.id,m.canonical_id,to_jsonb(c) FROM employment_cycles c JOIN cycle_merge m ON m.id=c.id WHERE m.id<>m.canonical_id ON CONFLICT DO NOTHING;
DELETE FROM leave_balances b USING balance_merge m WHERE b.id=m.id AND m.id<>m.canonical_id;
UPDATE leave_balances b SET employment_cycle_id=m.canonical_id FROM cycle_merge m WHERE b.employment_cycle_id=m.id AND m.id<>m.canonical_id;
UPDATE employment_cycles c SET is_active=true WHERE c.id IN (SELECT m.canonical_id FROM cycle_merge m JOIN employment_cycles x ON x.id=m.id WHERE x.is_active=true);
DELETE FROM employment_cycles c USING cycle_merge m WHERE c.id=m.id AND m.id<>m.canonical_id;
CREATE UNIQUE INDEX IF NOT EXISTS employment_cycles_employee_start_unique ON employment_cycles(employee_id,cycle_start);
CREATE UNIQUE INDEX IF NOT EXISTS leave_balances_cycle_type_unique ON leave_balances(employee_id,employment_cycle_id,leave_type_id);
-- Keep obsolete role column for data preservation while removing its insert requirement.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='role') THEN
  UPDATE team_members SET position=role WHERE position IS NULL OR position='';
  ALTER TABLE team_members ALTER COLUMN role DROP NOT NULL;
 END IF;
END $$;

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS work_date date;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS scheduled_start_at timestamp;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS scheduled_end_at timestamp;
ALTER TABLE reimbursement_requests ADD COLUMN IF NOT EXISTS idempotency_key varchar(100);
CREATE UNIQUE INDEX IF NOT EXISTS reimbursement_requests_idempotency_key_unique ON reimbursement_requests(idempotency_key);

CREATE TABLE IF NOT EXISTS leave_admin_events (
 id serial PRIMARY KEY, employee_id integer REFERENCES team_members(id), actor_id integer NOT NULL REFERENCES users(id),
 entity_type text NOT NULL, entity_id integer, action text NOT NULL, before_data jsonb, after_data jsonb,
 reason text, created_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO leave_types(name,is_deductible,half_day_supported) VALUES
 ('Vacation',true,true),('Sick Leave',true,true),('Personal Leave',true,true),('Maternity Leave',false,false),('Emergency Leave',true,true)
 ON CONFLICT(name) DO NOTHING;
