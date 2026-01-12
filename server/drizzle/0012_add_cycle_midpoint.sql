-- Add cycle_midpoint column to employment_cycles table
ALTER TABLE employment_cycles ADD COLUMN IF NOT EXISTS cycle_midpoint DATE;

-- Calculate and populate midpoint for existing cycles
UPDATE employment_cycles
SET cycle_midpoint = cycle_start + INTERVAL '6 months'
WHERE cycle_midpoint IS NULL;

-- Make it NOT NULL after populating (only if not already NOT NULL)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employment_cycles' 
    AND column_name = 'cycle_midpoint' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE employment_cycles ALTER COLUMN cycle_midpoint SET NOT NULL;
  END IF;
END $$;
