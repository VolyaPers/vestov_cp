ALTER TABLE "service_types" ADD COLUMN "base_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_types" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;