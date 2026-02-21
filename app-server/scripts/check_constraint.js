const { pool } = require('../config/database');

async function run() {
    try {
        const res = await pool.query(`
            SELECT pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conname = 'payments_status_check';
        `);
        if (res.rows.length > 0) {
            console.log('Constraint Definition:', res.rows[0].definition);
        } else {
            console.log('Constraint not found.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
