const { Pool } = require('pg');
const argon2 = require('argon2');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

async function resetPassword() {
    try {
        const password = 'Elixopay2026!';
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1
        });

        console.log('Generated Hash:', hash);

        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'demo@elixopay.com' RETURNING email",
            [hash]
        );

        console.log('Updated user:', res.rows[0]);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

resetPassword();
