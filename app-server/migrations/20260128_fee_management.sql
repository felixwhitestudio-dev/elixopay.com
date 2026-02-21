-- Create fee_configs table
CREATE TABLE IF NOT EXISTS fee_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id), -- The user being charged (Merchant/Agent)
    set_by_id UUID NOT NULL REFERENCES users(id), -- The upline setting the fee
    rate_percent DECIMAL(5, 4) NOT NULL, -- e.g., 0.0250 for 2.5%
    fixed_fee DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, set_by_id) -- Prevent duplicate rules from same upline
);

-- Index for fast lookup during payment processing
CREATE INDEX IF NOT EXISTS idx_fee_configs_user_id ON fee_configs(user_id);
