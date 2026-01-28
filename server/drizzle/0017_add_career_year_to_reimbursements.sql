-- Add career_year column to reimbursement_requests table
ALTER TABLE "reimbursement_requests" ADD COLUMN IF NOT EXISTS "career_year" integer;

-- For existing records, calculate the career_year based on the employee's start date and request date
-- Career year is calculated as: floor((request_date - start_date) / 365) + 1
UPDATE "reimbursement_requests" rr
SET "career_year" = (
  SELECT 
    CASE 
      WHEN tm.start_date IS NOT NULL THEN
        GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (rr.requested_at - tm.start_date)) / 86400 / 365)::integer + 1)
      ELSE 1
    END
  FROM "team_members" tm
  WHERE tm.id = rr.employee_id
)
WHERE "career_year" IS NULL;

-- Set default to 1 for any remaining NULL values (shouldn't happen, but safety check)
UPDATE "reimbursement_requests" 
SET "career_year" = 1 
WHERE "career_year" IS NULL;

-- Make the column NOT NULL after setting defaults (safe to run multiple times)
DO $$ BEGIN
  ALTER TABLE "reimbursement_requests" ALTER COLUMN "career_year" SET NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

