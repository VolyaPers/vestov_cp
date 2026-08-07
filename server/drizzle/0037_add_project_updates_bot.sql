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
