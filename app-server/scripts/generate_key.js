const crypto = require('crypto');
const { pool } = require('../config/database');

async function main() {
  try {
    const email = 'admin@elixopay.com';
    const res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      console.log("USER_NOT_FOUND");
      process.exit(1);
    }
    const userId = res.rows[0].id;
    
    const publicKey = 'pk_live_' + crypto.randomBytes(16).toString('hex');
    const secretKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
    const secretKeyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

    await pool.query(
      `INSERT INTO api_keys (user_id, name, public_key, secret_key_hash, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'Carat Store Key', publicKey, secretKeyHash, 'active']
    );
    console.log("SECRET_KEY=" + secretKey);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
