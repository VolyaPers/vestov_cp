-- Migration: Add service tracking to shifts
-- This allows tracking which service a shift is associated with for proper Slack notifications

ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES client_services(id);

COMMENT ON COLUMN shifts.service_id IS 'The service this shift is associated with (determines Slack notification channel)';

CREATE INDEX IF NOT EXISTS idx_shifts_service_id ON shifts(service_id);
