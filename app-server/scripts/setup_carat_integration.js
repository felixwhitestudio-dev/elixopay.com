const crypto = require('crypto');
const { pool } = require('../config/database');

async function main() {
  try {
    const email = 'felixwhite.studio@gmail.com';
    const res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (res.rows.length === 0) {
      console.log('User not found');
      process.exit(1);
    }
    
    const userId = res.rows[0].id;

    // Generate API Key
    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const publicKey = 'pk_test_' + crypto.randomBytes(12).toString('hex');
    const secretHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    
    // Check if api key already exists
    const existingKey = await pool.query('SELECT id FROM api_keys WHERE user_id = $1', [userId]);
    if (existingKey.rows.length === 0) {
        await pool.query(
            'INSERT INTO api_keys (user_id, name, public_key, secret_key_hash, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, 'Carat Integration Key', publicKey, secretHash, 'active']
        );
        console.log(`✅ API Key created.`);
    } else {
        await pool.query(
            'UPDATE api_keys SET public_key = $2, secret_key_hash = $3 WHERE user_id = $1',
            [userId, publicKey, secretHash]
        );
        console.log(`✅ API Key updated.`);
    }
    console.log(`   ELIXOPAY_API_KEY=${rawApiKey}`);
    console.log(`   ELIXOPAY_PUBLIC_KEY=${publicKey}`);

    // Generate Webhook Endpoint
    const webhookUrl = 'https://crowgemvault.com/api/webhook';
    const webhookSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    
    const existingWebhook = await pool.query('SELECT id FROM webhook_endpoints WHERE user_id = $1 AND url = $2', [userId, webhookUrl]);
    if (existingWebhook.rows.length === 0) {
        await pool.query(
            'INSERT INTO webhook_endpoints (user_id, url, enabled_events, is_active, secret) VALUES ($1, $2, $3, $4, $5)',
            [userId, webhookUrl, ['payment.succeeded', 'payment.failed'], true, webhookSecret]
        );
        console.log(`✅ Webhook created.`);
    } else {
        await pool.query(
            'UPDATE webhook_endpoints SET secret = $3 WHERE user_id = $1 AND url = $2',
            [userId, webhookUrl, webhookSecret]
        );
        console.log(`✅ Webhook updated.`);
    }
    console.log(`   ELIXOPAY_WEBHOOK_SECRET=${webhookSecret}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
