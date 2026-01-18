
const { pool } = require('../config/database');

async function main() {
    try {
        const res = await pool.query("SELECT id, email, account_type FROM users WHERE (account_type = 'user' OR account_type = 'merchant') AND status = 'active' ORDER BY email = 'demo@elixopay.com' DESC LIMIT 1");
        console.log('Query Result:', res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
