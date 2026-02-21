const { pool } = require('../config/database');
const argon2 = require('argon2');

async function createAdmin() {
    try {
        const email = 'admin@elixopay.com';
        const password = 'Password123!';
        const name = 'Admin User';

        console.log(`Hashing password for ${email}...`);
        const hashedPassword = await argon2.hash(password);

        // Check if user exists
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length > 0) {
            console.log('User exists. Updating password...');
            await pool.query('UPDATE users SET password_hash = $1, status = $2 WHERE email = $3', [hashedPassword, 'active', email]);
        } else {
            console.log('User does not exist. Creating...');
            await pool.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [email, hashedPassword, 'Admin', 'User', 'admin', 'active', true]
            );
        }

        console.log('✅ Admin user ready.');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        // If error is about column "password" vs "password_hash", let's know
        if (err.message.includes('column "password" does not exist')) {
            console.log('💡 Tip: Column "password" missing. Try "password_hash"?');
        }
        process.exit(1);
    }
}

createAdmin();
