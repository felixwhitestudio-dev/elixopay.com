
const db = require('./backend/config/database');
async function check() {
    try {
        const res = await db.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_account_type_check'");
        console.log('Constraint:', res.rows[0]);
    } catch (e) {
        console.error(e);
    }
}
check();
