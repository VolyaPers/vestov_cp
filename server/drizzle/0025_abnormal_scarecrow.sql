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
	"confirmed_at" timestamp,
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
ALTER TABLE "developers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "developers" CASCADE;--> statement-breakpoint
ALTER TABLE "client_service_developers" RENAME TO "client_service_team_members";--> statement-breakpoint
ALTER TABLE "client_service_team_members" RENAME COLUMN "developer_id" TO "team_member_id";--> statement-breakpoint
ALTER TABLE "invoice_developers" RENAME COLUMN "client_service_developer_id" TO "client_service_team_member_id";--> statement-breakpoint
ALTER TABLE "client_service_team_members" DROP CONSTRAINT "client_service_developers_client_service_id_client_services_id_fk";
--> statement-breakpoint
ALTER TABLE "client_service_team_members" DROP CONSTRAINT "client_service_developers_developer_id_developers_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_developers" DROP CONSTRAINT "invoice_developers_client_service_developer_id_client_service_developers_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "contract_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_service_team_members" ADD COLUMN "work_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "client_services" ADD COLUMN "service_title" text;--> statement-breakpoint
ALTER TABLE "client_services" ADD COLUMN "slack_channel_id" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "employment_cycles" ADD COLUMN "cycle_midpoint" date NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "is_developer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "team_member_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursement_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_team_members_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."shift_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_service_id_client_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_team_members" ADD CONSTRAINT "client_service_team_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_client_service_team_member_id_client_service_team_members_id_fk" FOREIGN KEY ("client_service_team_member_id") REFERENCES "public"."client_service_team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");