
const { pool } = require('../config/database');

async function main() {
    try {
        const res = await pool.query("SELECT users.id, email, account_type, status, users.created_at, balance FROM users LEFT JOIN wallets ON users.id = wallets.user_id ORDER BY users.created_at DESC");
        console.table(res.rows.map(r => ({
            id: r.id,
            email: r.email,
            type: r.account_type,
            status: r.status,
            balance: r.balance,
            created: r.created_at
        })));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
