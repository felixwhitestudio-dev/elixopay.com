
const db = require('./backend/config/database');
async function check() {
    try {
        const res = await db.query("SELECT email, account_type FROM users");
        console.log('Users:', res.rows);
    } catch (e) {
        console.error(e);
    }
}
check();
