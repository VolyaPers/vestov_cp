CREATE TABLE IF NOT EXISTS "client_service_developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_id" integer NOT NULL,
	"developer_id" integer NOT NULL,
	"employment_type" varchar(20) NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"skills" jsonb,
	"hourly_rate" numeric(10, 2),
	"experience_level" varchar(20),
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"bio" text,
	"location" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "developers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "client_services" ADD COLUMN IF NOT EXISTS "service_level_price" numeric(10, 2);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_service_developers" ADD CONSTRAINT "client_service_developers_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "client_services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_service_developers" ADD CONSTRAINT "client_service_developers_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
