const argon2 = require('argon2');
const path = require('path');
// Load .env from backend/.env
// Since this script is in backend/scripts/, ../.env is correct.
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/database');

async function resetPassword() {
    const email = 'demo@elixopay.com';
    const password = 'demo1234';

    console.log('Using Database URL:', process.env.DATABASE_URL ? 'Set' : 'Unset');
    console.log('DB Config:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
    });

    try {
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1
        });

        console.log('Generated Hash Start:', hash.substring(0, 20));

        const userRes = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);

        if (userRes.rows.length === 0) {
            console.log('User not found. Creating user...');
            await pool.query(
                'INSERT INTO users (email, password_hash, first_name, last_name, account_type, is_verified, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
                [email, hash, 'Demo', 'User', 'merchant', true, 'active']
            );
        } else {
            console.log('User found. Updating password...');
            console.log('Old Hash Start:', userRes.rows[0].password_hash ? userRes.rows[0].password_hash.substring(0, 20) : 'None');
            await pool.query(
                'UPDATE users SET password_hash = $1, status = $2 WHERE email = $3',
                [hash, 'active', email]
            );
        }

        console.log('Password reset successfully for:', email);
    } catch (err) {
        console.error('Error resetting password:', err);
    } finally {
        await pool.end();
    }
}

resetPassword();
