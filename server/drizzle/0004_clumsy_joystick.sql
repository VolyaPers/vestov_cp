CREATE TABLE IF NOT EXISTS "developer_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_service_developer_id" integer NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"effective_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"created_by" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "developer_price_history" ADD CONSTRAINT "developer_price_history_client_service_developer_id_client_service_developers_id_fk" FOREIGN KEY ("client_service_developer_id") REFERENCES "client_service_developers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "developer_price_history" ADD CONSTRAINT "developer_price_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
