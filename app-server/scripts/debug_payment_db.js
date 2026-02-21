const { pool } = require('../config/database');

async function run() {
    try {
        console.log('--- Debugging Payments Table ---');
        const res = await pool.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 5');
        console.log(`Found ${res.rows.length} payments.`);
        res.rows.forEach(p => {
            console.log(`ID: ${p.id}, Token: ${p.token}, MerchantID: ${p.merchant_id}, Amount: ${p.amount}`);
        });

        const users = await pool.query('SELECT id, email, first_name FROM users LIMIT 5');
        console.log('\n--- Debugging Users Table ---');
        users.rows.forEach(u => {
            console.log(`ID: ${u.id}, Email: ${u.email}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
