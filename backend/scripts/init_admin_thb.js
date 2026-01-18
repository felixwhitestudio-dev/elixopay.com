const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const adminId = 'eb1c3772-8f0c-4dd4-a0c0-3494e83bf9d7';

async function createAdminTHB() {
    const client = await pool.connect();
    try {
        console.log('Creating THB Wallet for Admin...');

        // Check exists
        const resCheck = await client.query('SELECT * FROM wallets WHERE user_id = $1 AND currency = $2', [adminId, 'THB']);
        if (resCheck.rows.length > 0) {
            console.log('THB Wallet already exists:', resCheck.rows[0].id);
            return;
        }

        const walletAddr = '0x' + require('crypto').randomBytes(20).toString('hex');
        const res = await client.query(
            'INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, $2, $3, $4) RETURNING *',
            [adminId, 0.00, 'THB', walletAddr]
        );
        console.log('Created THB Wallet:', res.rows[0].id);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        process.exit();
    }
}

createAdminTHB();
