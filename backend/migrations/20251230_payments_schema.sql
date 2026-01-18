-- Drop if exists to ensure clean state for this major feature update
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES users(id),
    payer_id UUID REFERENCES users(id),
    amount DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'THB',
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    token VARCHAR(255) UNIQUE NOT NULL, -- Checkout Token
    payment_intent_id VARCHAR(255) UNIQUE,
    client_secret VARCHAR(255),
    payment_method_type VARCHAR(50) DEFAULT 'stripe', -- stripe, wallet
    return_url TEXT,
    cancel_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX idx_payments_token ON payments(token);
CREATE INDEX idx_payments_merchant ON payments(merchant_id);
CREATE INDEX idx_payments_intent ON payments(payment_intent_id);
