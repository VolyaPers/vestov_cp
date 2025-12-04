DROP TABLE "developer_price_history";--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "is_billable" boolean DEFAULT true NOT NULL;