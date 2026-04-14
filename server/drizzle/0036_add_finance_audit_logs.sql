CREATE TABLE IF NOT EXISTS "finance_activity_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "action" varchar(50) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" integer NOT NULL,
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "invoice_id" integer REFERENCES "invoices"("id"),
  "transaction_id" integer REFERENCES "financial_transactions"("id"),
  "actor_id" integer NOT NULL REFERENCES "users"("id"),
  "summary" text NOT NULL,
  "before_data" jsonb,
  "after_data" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_entity"
  ON "finance_activity_logs" ("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_team_member"
  ON "finance_activity_logs" ("team_member_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_finance_activity_logs_actor"
  ON "finance_activity_logs" ("actor_id", "created_at" DESC);
