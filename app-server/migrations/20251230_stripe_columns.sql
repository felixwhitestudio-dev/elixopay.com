ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255) UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_secret VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method_type VARCHAR(50) DEFAULT 'stripe';
CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(payment_intent_id);
