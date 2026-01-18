const { pool } = require('../config/database');

async function checkWallets() {
    try {
        const res = await pool.query(`
            SELECT u.email, w.id, w.currency, w.balance, w.wallet_address 
            FROM wallets w 
            JOIN users u ON w.user_id = u.id 
            ORDER BY u.email, w.currency
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkWallets();
