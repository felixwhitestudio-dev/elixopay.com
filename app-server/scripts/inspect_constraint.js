
const { pool } = require('../config/database');

async function main() {
    try {
        const res = await pool.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_account_type_check'");
        console.log('Constraint Definition:');
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
