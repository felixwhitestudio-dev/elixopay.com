-- Migration: Add user_bank_accounts table
-- Date: 2025-12-27

CREATE TABLE IF NOT EXISTS user_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON user_bank_accounts(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_bank_accounts_updated_at BEFORE UPDATE ON user_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
