CREATE TABLE "clickup_daily_rollups" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" varchar(50) NOT NULL,
	"rollup_date" date NOT NULL,
	"clickup_user_id" varchar(50) NOT NULL,
	"clickup_user_name" text NOT NULL,
	"team_member_id" integer,
	"client_id" integer,
	"client_service_id" integer,
	"attribution_status" varchar(20) DEFAULT 'unassigned' NOT NULL,
	"total_duration_ms" numeric(16, 0) NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clickup_member_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" varchar(50) NOT NULL,
	"team_member_id" integer NOT NULL,
	"clickup_user_id" varchar(50) NOT NULL,
	"clickup_user_name" text NOT NULL,
	"clickup_user_email" varchar(255),
	"last_seen_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clickup_member_mappings_team_member_id_unique" UNIQUE("team_member_id"),
	CONSTRAINT "clickup_member_mappings_clickup_user_id_unique" UNIQUE("clickup_user_id")
);
--> statement-breakpoint
CREATE TABLE "clickup_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
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
	"triggered_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clickup_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" varchar(50) NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"clickup_user_id" varchar(50) NOT NULL,
	"clickup_user_name" text NOT NULL,
	"clickup_user_email" varchar(255),
	"team_member_id" integer,
	"client_id" integer,
	"client_service_id" integer,
	"attribution_status" varchar(20) DEFAULT 'unassigned' NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"position" text,
	"email" varchar(255),
	"phone" varchar(20),
	"avatar_url" text,
	"notes" text,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_service_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
	"team_member_id" integer NOT NULL,
	"employment_type" varchar(20) NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"work_schedule" jsonb,
	"is_active" boolean DEFAULT true,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"service_type_id" integer NOT NULL,
	"rate" numeric(10, 2),
	"service_level_price" numeric(10, 2),
	"service_title" text,
	"slack_channel_id" varchar(255),
	"clickup_list_id" varchar(100),
	"clickup_list_name" text,
	"project_bot_enabled" boolean DEFAULT false NOT NULL,
	"project_bot_daily_update_enabled" boolean DEFAULT true NOT NULL,
	"project_bot_daily_update_time" varchar(5) DEFAULT '09:00' NOT NULL,
	"project_bot_timezone" varchar(100) DEFAULT 'Europe/Kyiv' NOT NULL,
	"project_bot_authorized_slack_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_bot_last_daily_update_at" timestamp,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_users" (
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
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"contact_person" text,
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"contract_type" varchar(20),
	"contract_start" date,
	"contract_end" date,
	"billing_rate" numeric(10, 2),
	"billing_cycle" varchar(20),
	"active_services" jsonb,
	"team_size" integer DEFAULT 0,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document_title" text,
	"type" varchar(50),
	"file_size" integer,
	"url" text NOT NULL,
	"user_id" integer,
	"client_id" integer,
	"client_service_id" integer,
	"folder_id" integer,
	"visible_to_client" boolean DEFAULT false NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"cycle_start" date NOT NULL,
	"cycle_end" date NOT NULL,
	"cycle_midpoint" date NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" integer,
	"client_service_id" integer,
	"team_member_id" integer,
	"rating" integer,
	"comments" text,
	"feedback_type" varchar(50),
	"status" varchar(20) DEFAULT 'pending',
	"admin_response" text,
	"admin_responded_by" integer,
	"admin_responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"team_member_id" integer,
	"client_id" integer,
	"invoice_id" integer,
	"transaction_id" integer,
	"actor_id" integer NOT NULL,
	"summary" text NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" varchar(50) NOT NULL,
	"category" text,
	"user_id" integer,
	"client_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"category" text,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"transaction_date" date NOT NULL,
	"team_member_id" integer,
	"client_id" integer,
	"invoice_id" integer,
	"is_recurring" boolean DEFAULT false,
	"voided_at" timestamp,
	"void_reason" text,
	"payroll_period_id" integer,
	"payroll_data" jsonb,
	"idempotency_key" varchar(100),
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "financial_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"credentials" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "invoice_developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_service_id" integer NOT NULL,
	"client_service_team_member_id" integer NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"hours_worked" numeric(8, 2),
	"calculated_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"client_service_id" integer NOT NULL,
	"service_level_price" numeric(10, 2),
	"calculated_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"invoice_date" date NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"due_date" date,
	"paid_at" timestamp,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "leave_allocation_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"allocated_days" numeric(5, 1) NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"employment_cycle_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"total_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"adjustment_days" numeric(5, 1) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"actor_id" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"half_day_start" boolean DEFAULT false,
	"half_day_end" boolean DEFAULT false,
	"days_count" numeric(5, 1) NOT NULL,
	"reason" text,
	"requested_by" integer NOT NULL,
	"decision_by" integer,
	"decision_at" timestamp,
	"decision_reason" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_deductible" boolean DEFAULT true,
	"half_day_supported" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_member_id" integer NOT NULL,
	"salary_month" varchar(7) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"default_extras" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"calculation_note" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_bot_slack_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "project_bot_task_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "reimbursement_requests" (
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
	"paid_at" timestamp,
	"payment_transaction_id" integer,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursement_requests_payment_transaction_id_unique" UNIQUE("payment_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "salary_rate_history" (
	"monthly_extras" jsonb,
	"id" serial PRIMARY KEY NOT NULL,
	"team_member_id" integer NOT NULL,
	"monthly_rate" numeric(10, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"note" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"request_date" timestamp DEFAULT now() NOT NULL,
	"user_id" integer NOT NULL,
	"response_date" timestamp,
	"response_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" varchar(20) NOT NULL,
	"billing_model" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"break_type" varchar(20) DEFAULT 'regular',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_schedule_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"override_date" date NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_day_off" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
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
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"skills" jsonb,
	"bio" text,
	"hourly_rate" numeric(10, 2),
	"monthly_rate" numeric(10, 2),
	"monthly_salary_extras" jsonb,
	"employment_type" varchar(20) DEFAULT 'fulltime' NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"client_id" integer,
	"start_date" date NOT NULL,
	"location" text,
	"timezone" text,
	"avatar_url" text,
	"position" text NOT NULL,
	"show_on_calendar" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_name" text NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"date" date NOT NULL,
	"user_id" integer NOT NULL,
	"team_member_id" integer,
	"billable" boolean DEFAULT true,
	"approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" text,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'client' NOT NULL,
	"position" text,
	"avatar_url" text,
	"timezone" text,
	"team_member_id" integer,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"google_id" varchar(255),
	"clerk_user_id" varchar(255),
	"auth_provider" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "clickup_daily_rollups" ADD CONSTRAINT "clickup_daily_rollups_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_daily_rollups" ADD CONSTRAINT "clickup_daily_rollups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_daily_rollups" ADD CONSTRAINT "clickup_daily_rollups_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_member_mappings" ADD CONSTRAINT "clickup_member_mappings_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_member_mappings" ADD CONSTRAINT "clickup_member_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_sync_runs" ADD CONSTRAINT "clickup_sync_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_time_entries" ADD CONSTRAINT "clickup_time_entries_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_time_entries" ADD CONSTRAINT "clickup_time_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clickup_time_entries" ADD CONSTRAINT "clickup_time_entries_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_cycles" ADD CONSTRAINT "employment_cycles_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_admin_responded_by_users_id_fk" FOREIGN KEY ("admin_responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_activity_logs" ADD CONSTRAINT "finance_activity_logs_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_activity_logs" ADD CONSTRAINT "finance_activity_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_activity_logs" ADD CONSTRAINT "finance_activity_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_activity_logs" ADD CONSTRAINT "finance_activity_logs_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_activity_logs" ADD CONSTRAINT "finance_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_invoice_service_id_invoice_services_id_fk" FOREIGN KEY ("invoice_service_id") REFERENCES "public"."invoice_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_client_service_team_member_id_client_service_team_members_id_fk" FOREIGN KEY ("client_service_team_member_id") REFERENCES "public"."client_service_team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_services" ADD CONSTRAINT "invoice_services_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_services" ADD CONSTRAINT "invoice_services_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allocation_settings" ADD CONSTRAINT "leave_allocation_settings_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employment_cycle_id_employment_cycles_id_fk" FOREIGN KEY ("employment_cycle_id") REFERENCES "public"."employment_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_events" ADD CONSTRAINT "leave_request_events_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_events" ADD CONSTRAINT "leave_request_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decision_by_users_id_fk" FOREIGN KEY ("decision_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_bot_slack_requests" ADD CONSTRAINT "project_bot_slack_requests_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_bot_task_snapshots" ADD CONSTRAINT "project_bot_task_snapshots_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_payment_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_rate_history" ADD CONSTRAINT "salary_rate_history_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_rate_history" ADD CONSTRAINT "salary_rate_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_overrides" ADD CONSTRAINT "shift_schedule_overrides_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."shift_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_service_id_client_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employment_cycles_employee_start_unique" ON "employment_cycles" USING btree ("employee_id","cycle_start");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_balances_cycle_type_unique" ON "leave_balances" USING btree ("employee_id","employment_cycle_id","leave_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_employee_month_unique" ON "payroll_periods" USING btree ("team_member_id","salary_month");--> statement-breakpoint
CREATE UNIQUE INDEX "project_bot_slack_requests_channel_message_unique" ON "project_bot_slack_requests" USING btree ("slack_channel_id","slack_message_ts");--> statement-breakpoint
CREATE UNIQUE INDEX "project_bot_task_snapshots_service_task_unique" ON "project_bot_task_snapshots" USING btree ("client_service_id","clickup_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_breaks_one_open_per_shift" ON "shift_breaks" USING btree ("shift_id") WHERE "shift_breaks"."end_time" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_schedules_active_day_unique" ON "shift_schedules" USING btree ("employee_id","day_of_week") WHERE "shift_schedules"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_open_per_employee" ON "shifts" USING btree ("employee_id") WHERE "shifts"."end_time" IS NULL;