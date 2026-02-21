const { pool } = require('./backend/config/database');

async function debugUser() {
    try {
        const res = await pool.query("SELECT * FROM users WHERE email = 'partner@test.com'");
        console.log('User Row:', res.rows[0]);
        console.log('Account Type:', res.rows[0]?.account_type);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugUser();
