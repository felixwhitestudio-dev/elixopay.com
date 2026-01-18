-- Add payment_method and metadata columns to payments table
ALTER TABLE payments ADD COLUMN payment_method VARCHAR(50);
ALTER TABLE payments ADD COLUMN metadata JSONB;
