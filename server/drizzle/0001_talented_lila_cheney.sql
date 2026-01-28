ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "base_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();