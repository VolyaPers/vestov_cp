-- Add cycle_midpoint column to employment_cycles table
ALTER TABLE employment_cycles ADD COLUMN cycle_midpoint DATE;

-- Calculate and populate midpoint for existing cycles
UPDATE employment_cycles
SET cycle_midpoint = cycle_start + INTERVAL '6 months'
WHERE cycle_midpoint IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE employment_cycles ALTER COLUMN cycle_midpoint SET NOT NULL;
