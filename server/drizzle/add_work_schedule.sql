-- Add work_schedule column to client_service_developers table
ALTER TABLE client_service_developers
ADD COLUMN IF NOT EXISTS work_schedule jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN client_service_developers.work_schedule IS 'Work schedule for developer: {"monday": "full", "tuesday": "full", "wednesday": "half", "thursday": "off", "friday": "full", "saturday": "off", "sunday": "off"}';
