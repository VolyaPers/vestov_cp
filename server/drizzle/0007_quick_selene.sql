DROP TABLE IF EXISTS "developer_price_history";--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "is_billable" boolean DEFAULT true;