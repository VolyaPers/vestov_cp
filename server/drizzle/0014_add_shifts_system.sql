-- Shift Schedules table (expected work schedules for employees)
CREATE TABLE IF NOT EXISTS "shift_schedules" (
  "id" SERIAL PRIMARY KEY,
  "employee_id" INTEGER NOT NULL REFERENCES "team_members"("id"),
  "day_of_week" INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
  "start_time" VARCHAR(5) NOT NULL, -- Format: "HH:MM" (e.g., "09:00")
  "end_time" VARCHAR(5) NOT NULL, -- Format: "HH:MM" (e.g., "18:00")
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Shifts table (actual work shifts logged by employees)
CREATE TABLE IF NOT EXISTS "shifts" (
  "id" SERIAL PRIMARY KEY,
  "employee_id" INTEGER NOT NULL REFERENCES "team_members"("id"),
  "schedule_id" INTEGER REFERENCES "shift_schedules"("id"), -- Optional reference to expected schedule
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP, -- Null if shift is still active
  "status" VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'on_break' | 'completed'
  "is_late" BOOLEAN DEFAULT false, -- True if started late according to schedule
  "late_minutes" INTEGER DEFAULT 0, -- How many minutes late
  "notes" TEXT, -- Optional notes about the shift
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Shift Breaks table (breaks during a shift)
CREATE TABLE IF NOT EXISTS "shift_breaks" (
  "id" SERIAL PRIMARY KEY,
  "shift_id" INTEGER NOT NULL REFERENCES "shifts"("id"),
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP, -- Null if break is still active
  "break_type" VARCHAR(20) DEFAULT 'regular', -- 'regular' | 'lunch' | 'other'
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "shift_schedules_employee_id_idx" ON "shift_schedules"("employee_id");
CREATE INDEX IF NOT EXISTS "shifts_employee_id_idx" ON "shifts"("employee_id");
CREATE INDEX IF NOT EXISTS "shifts_status_idx" ON "shifts"("status");
CREATE INDEX IF NOT EXISTS "shifts_start_time_idx" ON "shifts"("start_time");
CREATE INDEX IF NOT EXISTS "shift_breaks_shift_id_idx" ON "shift_breaks"("shift_id");
