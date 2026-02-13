CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" varchar(50) NOT NULL,
  "credentials" text NOT NULL DEFAULT '',
  "is_active" boolean DEFAULT false,
  "last_sync_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "integration_settings_provider_unique" UNIQUE("provider")
);
