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
