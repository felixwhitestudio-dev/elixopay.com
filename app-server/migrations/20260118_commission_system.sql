-- Create commission_rules table
CREATE TABLE IF NOT EXISTS commission_rules (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL UNIQUE, -- agent, organizer, partner
    commission_percent DECIMAL(5, 4) NOT NULL, -- 0.0050 for 0.5%
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default rules
INSERT INTO commission_rules (role, commission_percent) VALUES 
('partner', 0.0020),
('organizer', 0.0030),
('agent', 0.0050)
ON CONFLICT (role) DO NOTHING;

-- Create commission_logs table
CREATE TABLE IF NOT EXISTS commission_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_id UUID NOT NULL REFERENCES users(id),
    source_payment_id UUID NOT NULL, -- References payments(id) but might be in different microservice logic, keeping as UUID. Actually we have payments table in same DB.
    source_user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'THB',
    rate_snapshot DECIMAL(5, 4) NOT NULL,
    status VARCHAR(20) DEFAULT 'PAID', -- PAID, PENDING, REVERSED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for dashboards
CREATE INDEX IF NOT EXISTS idx_commission_beneficiary ON commission_logs(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_commission_created_at ON commission_logs(created_at);
