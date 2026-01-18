-- Add hierarchy columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(50) UNIQUE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
