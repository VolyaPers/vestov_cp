-- Create leave allocation settings table
CREATE TABLE IF NOT EXISTS "leave_allocation_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "cycle_number" integer NOT NULL,
    "leave_type_id" integer NOT NULL,
    "allocated_days" numeric(5, 1) NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "leave_allocation_settings" ADD CONSTRAINT "leave_allocation_settings_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Insert some sample data for testing
INSERT INTO "leave_allocation_settings" ("cycle_number", "leave_type_id", "allocated_days", "is_default") VALUES
(1, 1, 25.0, false),
(1, 2, 10.0, false),
(2, 1, 27.0, false),
(2, 2, 10.0, false),
(3, 1, 30.0, true),
(3, 2, 10.0, true)
ON CONFLICT DO NOTHING;