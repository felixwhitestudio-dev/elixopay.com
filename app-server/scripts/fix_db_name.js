const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB');

        // Check if column exists
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='name';
    `);

        if (res.rows.length === 0) {
            console.log('Adding name column to users table...');
            await client.query('ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT \'User\';');
            console.log('Column added.');
        } else {
            console.log('Column name already exists.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
