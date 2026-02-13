CREATE TABLE IF NOT EXISTS "financial_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" varchar(20) NOT NULL,
  "category" text,
  "amount" decimal(12, 2) NOT NULL,
  "description" text,
  "transaction_date" date NOT NULL,
  "team_member_id" integer REFERENCES "team_members"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "invoice_id" integer REFERENCES "invoices"("id"),
  "is_recurring" boolean DEFAULT false,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ft_type" ON "financial_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_ft_transaction_date" ON "financial_transactions" ("transaction_date");
CREATE INDEX IF NOT EXISTS "idx_ft_team_member_id" ON "financial_transactions" ("team_member_id");
