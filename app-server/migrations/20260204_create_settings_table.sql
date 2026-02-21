CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial values if not exists
INSERT INTO system_settings (key, value) VALUES ('exchange_rate_usdt_thb', '34.50') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('withdrawal_fee_thb', '20.00') ON CONFLICT (key) DO NOTHING;
