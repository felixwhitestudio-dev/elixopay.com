-- Drop existing constraint
ALTER TABLE transaction_logs DROP CONSTRAINT IF EXISTS transaction_logs_type_check;

-- Add new constraint with 'commission' allowed
ALTER TABLE transaction_logs ADD CONSTRAINT transaction_logs_type_check 
CHECK (type IN ('deposit', 'withdraw', 'transfer_in', 'transfer_out', 'exchange', 'commission'));
