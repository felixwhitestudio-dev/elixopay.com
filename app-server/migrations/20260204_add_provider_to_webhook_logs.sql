-- Add provider column to webhook_logs
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'stripe';
