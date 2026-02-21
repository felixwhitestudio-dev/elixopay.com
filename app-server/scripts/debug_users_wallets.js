const { pool } = require('../config/database');

async function run() {
    try {
        console.log('--- USERS ---');
        const users = await pool.query("SELECT id, email, account_type FROM users WHERE email IN ('demo@elixopay.com', 'buyer_browser@test.com')");
        console.table(users.rows);

        console.log('\n--- WALLETS ---');
        const wallets = await pool.query(
            "SELECT w.id, w.user_id, u.email, w.balance, w.currency FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.email IN ('demo@elixopay.com', 'buyer_browser@test.com')"
        );
        console.table(wallets.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
