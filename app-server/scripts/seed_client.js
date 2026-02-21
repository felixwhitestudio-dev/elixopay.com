const { pool } = require('../config/database');
const argon2 = require('argon2');

async function run() {
    try {
        const email = 'demo@elixopay.com';
        const password = 'Elixopay2026!';

        console.log(`Checking user ${email}...`);
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        let userId;

        if (res.rows.length === 0) {
            console.log('Creating new client demo user...');
            const hash = await argon2.hash(password);
            const insert = await pool.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, created_at)
                  VALUES ($1, $2, 'Client', 'Demo', 'merchant', 'active', true, NOW()) RETURNING id`,
                [email, hash]
            );
            userId = insert.rows[0].id;

            // Create wallet
            const walletAddress = 'wallet_' + userId;
            await pool.query(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                  VALUES ($1, $2, 50000, 'THB', true, NOW())`,
                [userId, walletAddress]
            );
            console.log('✅ Created user and initial wallet.');
        } else {
            console.log('User exists. Resetting password...');
            const hash = await argon2.hash(password);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, res.rows[0].id]);
            console.log('✅ Password reset.');
        }

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
