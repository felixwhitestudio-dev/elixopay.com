const { Pool } = require('pg');
const argon2 = require('argon2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function resetAllPasswords() {
    try {
        console.log('Starting global password reset...');
        const password = 'Elixopay2026!';

        // Generate Argon2 hash
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1
        });

        console.log('Generated new hash for password:', password);

        // Update ALL users
        // Updating both password_hash (standard) and password (legacy/fallback if exists)
        // We use COALESCE to avoid errors if one column doesn't exist, but we know they do from check_columns.js
        // Actually, check_columns.js showed 'password' and 'password_hash' both exist.

        const res = await pool.query(
            `UPDATE users 
             SET password_hash = $1, 
                 password = $1
             RETURNING email`,
            [hash]
        );

        console.log(`Successfully reset passwords for ${res.rowCount} users.`);

        if (res.rowCount > 0) {
            console.log('Sample updated emails:', res.rows.slice(0, 3).map(r => r.email));
        }

    } catch (error) {
        console.error('Error executing reset:', error);
    } finally {
        await pool.end();
    }
}

resetAllPasswords();
