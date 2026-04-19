const { pool } = require('./config/database');

async function check() {
  const result = await pool.query("SELECT * FROM users WHERE email = 'felixwhite.studio@gmail.com'");
  if (result.rows.length > 0) {
    console.log(result.rows[0]);
    await pool.query("UPDATE users SET account_type = 'admin', kyc_status = 'verified' WHERE email = 'felixwhite.studio@gmail.com'");
    console.log("Updated!");
  } else {
    console.log("Not found!");
  }
  process.exit(0);
}

check();
