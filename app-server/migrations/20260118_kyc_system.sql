-- Add verification columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low';

-- Drop existing constraints if they exist (to avoid errors on rerun) or just add new ones
-- Since we are using raw SQL in psql, we can try safe adds.
-- Note: 'check' constraints naming convention should be unique.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_verification_status_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_verification_status_check
        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'suspended'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_risk_level_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_risk_level_check
        CHECK (risk_level IN ('low', 'medium', 'high'));
    END IF;
END $$;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- id_card, passport, business_reg, bank_book, selfie
    file_path TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster routing
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
