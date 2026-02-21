-- Fix webhook_logs to support incoming webhooks (Stripe/KBank)
ALTER TABLE webhook_logs ALTER COLUMN webhook_id DROP NOT NULL;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS event_id VARCHAR(255);
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
