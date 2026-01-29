-- Create document_folders table for organizing documents by service
CREATE TABLE IF NOT EXISTS "document_folders" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_service_id" integer NOT NULL REFERENCES "client_services"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "parent_folder_id" integer REFERENCES "document_folders"("id") ON DELETE SET NULL,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add new columns to documents table for service-level organization
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "client_service_id" integer REFERENCES "client_services"("id") ON DELETE SET NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "folder_id" integer REFERENCES "document_folders"("id") ON DELETE SET NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "visible_to_client" boolean DEFAULT false NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_document_folders_client_service_id" ON "document_folders"("client_service_id");
CREATE INDEX IF NOT EXISTS "idx_document_folders_parent_folder_id" ON "document_folders"("parent_folder_id");
CREATE INDEX IF NOT EXISTS "idx_documents_client_service_id" ON "documents"("client_service_id");
CREATE INDEX IF NOT EXISTS "idx_documents_folder_id" ON "documents"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_documents_visible_to_client" ON "documents"("visible_to_client");
