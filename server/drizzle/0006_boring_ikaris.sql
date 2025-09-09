CREATE TABLE IF NOT EXISTS "invoice_developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_service_id" integer NOT NULL,
	"client_service_developer_id" integer NOT NULL,
	"hourly_rate" numeric(10, 2),
	"fixed_price" numeric(10, 2),
	"hours_worked" numeric(8, 2),
	"calculated_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"client_service_id" integer NOT NULL,
	"service_level_price" numeric(10, 2),
	"calculated_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_invoice_service_id_invoice_services_id_fk" FOREIGN KEY ("invoice_service_id") REFERENCES "invoice_services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_developers" ADD CONSTRAINT "invoice_developers_client_service_developer_id_client_service_developers_id_fk" FOREIGN KEY ("client_service_developer_id") REFERENCES "client_service_developers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_services" ADD CONSTRAINT "invoice_services_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_services" ADD CONSTRAINT "invoice_services_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "client_services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
