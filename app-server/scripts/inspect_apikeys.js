const { pool } = require('../config/database');

async function inspect() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'api_keys';
        `);
        console.log('Columns in api_keys:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

inspect();
