INSERT INTO system_settings (key, value) VALUES ('exchange_rate_mode', 'manual') ON CONFLICT (key) DO NOTHING;
