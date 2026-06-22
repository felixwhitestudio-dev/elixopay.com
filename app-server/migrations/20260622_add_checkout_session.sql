-- Add checkout_session_id column to support Stripe Checkout Sessions
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_session ON payments(checkout_session_id);

-- Add settled_at if it doesn't exist (used by webhook handlers)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(20, 2);
