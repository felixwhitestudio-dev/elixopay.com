#!/usr/bin/env node
/**
 * Fix KYC: Set felixwhite.studio@gmail.com to kyc_status='verified' and account_type='admin'
 * Runs inside Cloud Run using the same DB config as the main app
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: false })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'elixopay',
      user: process.env.DB_USER || 'elixouser',
      password: process.env.DB_PASSWORD || 'yourpassword',
      ssl: false
    });

async function main() {
  const email = 'felixwhite.studio@gmail.com';
  console.log(`Updating user: ${email}`);

  const before = await pool.query('SELECT email, account_type, kyc_status FROM users WHERE email = $1', [email]);
  if (before.rows.length === 0) {
    console.error('User not found!');
    process.exit(1);
  }
  console.log('BEFORE:', before.rows[0]);

  await pool.query(
    `UPDATE users SET account_type = 'admin', kyc_status = 'verified', two_factor_enabled = true WHERE email = $1`,
    [email]
  );

  const after = await pool.query('SELECT email, account_type, kyc_status, two_factor_enabled FROM users WHERE email = $1', [email]);
  console.log('AFTER:', after.rows[0]);

  await pool.end();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
