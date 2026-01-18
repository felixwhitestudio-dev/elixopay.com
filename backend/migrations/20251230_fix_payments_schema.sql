-- Add user_id column
ALTER TABLE payments ADD COLUMN user_id UUID REFERENCES users(id);

-- Make merchant_id nullable since wallet operations don't have a merchant
ALTER TABLE payments ALTER COLUMN merchant_id DROP NOT NULL;
