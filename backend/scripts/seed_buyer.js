const { pool } = require('../config/database');
const argon2 = require('argon2');

async function run() {
    try {
        const email = 'buyer_browser@test.com';
        const password = 'Password123!@#';

        console.log(`Checking user ${email}...`);
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        let userId;

        if (res.rows.length === 0) {
            console.log('Creating new user...');
            const hash = await argon2.hash(password);
            const insert = await pool.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, created_at)
                  VALUES ($1, $2, 'Buyer', 'Browser', 'merchant', 'active', true, NOW()) RETURNING id`,
                [email, hash]
            );
            userId = insert.rows[0].id;
            // Create wallet
            const walletAddress = 'wallet_' + userId;
            await pool.query(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                  VALUES ($1, $2, 10000, 'THB', true, NOW())`,
                [userId, walletAddress]
            );
        } else {
            console.log('User exists.');
            userId = res.rows[0].id;
        }

        console.log('Funding wallet...');
        // Ensure wallet exists (if user existed but no wallet)
        const walletRes = await pool.query('SELECT id FROM wallets WHERE user_id = $1 AND currency = \'THB\'', [userId]);
        if (walletRes.rows.length === 0) {
            const walletAddress = 'wallet_' + userId;
            await pool.query(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                  VALUES ($1, $2, 10000, 'THB', true, NOW())`,
                [userId, walletAddress]
            );
        } else {
            await pool.query('UPDATE wallets SET balance = 10000 WHERE id = $1', [walletRes.rows[0].id]);
        }

        console.log('✅ User seeded and funded.');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
