const { pool } = require('../config/database');
const argon2 = require('argon2');
const { v4: uuidv4 } = require('uuid');

async function run() {
    try {
        const hash = await argon2.hash('Partner2026!');

        const res = await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, invite_code)
            VALUES ('partner@test.com', $1, 'Partner', 'Demo', 'partner', 'active', true, 'PARTNER_DEMO_CODE')
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = $1, account_type = 'partner', status = 'active'
            RETURNING id
        `, [hash]);

        const userId = res.rows[0].id;

        // Ensure wallet
        await pool.query(`
            INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active)
            VALUES ($1, $2, 100000.00, 'THB', true)
            ON CONFLICT DO NOTHING
        `, [userId, uuidv4()]);

        console.log('✅ Created Partner: partner@test.com / Partner2026!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
