-- Migration: Add Slack channel support to client services
-- This allows each service to have its own Slack channel for shift notifications

ALTER TABLE client_services 
ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255);

COMMENT ON COLUMN client_services.slack_channel_id IS 'Slack channel ID (format: C1234567890) where shift notifications for this service are sent. Falls back to SLACK_CHANNEL_ID env var if null.';
