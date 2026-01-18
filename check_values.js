const db = require('./backend/config/database');
async function run() {
    try {
        const res = await db.query("SELECT DISTINCT status FROM users");
        console.log('Statuses:', res.rows.map(r => r.status));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
