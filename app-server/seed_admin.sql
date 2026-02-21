INSERT INTO users (email, password, name, role, is_verified, is_active, created_at)
VALUES (
  'admin@elixopay.com',
  '$2b$10$KIXQw1Qw1Qw1Qw1Qw1Qw1OQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw', -- bcrypt hash for 'admin1234'
  'Admin',
  'admin',
  true,
  true,
  CURRENT_TIMESTAMP
);
