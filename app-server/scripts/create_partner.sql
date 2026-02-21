-- Create a Partner User for testing
INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified)
VALUES (
    'partner@test.com', 
    '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash', -- This won't work with Argon verification unless hash is real.
    -- Wait, I can use the same hash as the demo user if I know the password, or just update it via script.
    -- Actually, simpler: Use the dev-login logic or just rely on 'demo@elixopay.com' being updated to partner?
    -- No, 'demo@elixopay.com' is a merchant usually.
    -- Let's create a new one and use the server's hashing function via a temporary script.
    'Partner', 'Demo', 'partner', 'active', true
) ON CONFLICT (email) DO NOTHING;
