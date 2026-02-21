const { pool } = require('../config/database');

const SYSTEM_WALLET_USDT = '84404d85-9272-4c9f-b010-17c127efe157';
const SYSTEM_WALLET_THB = 'd7776b71-7c1e-4e47-919b-3b5b45b9d7e9';
const SYSTEM_USER_ID = 'eb1c3772-8f0c-4dd4-a0c0-3494e83bf9d7'; // User ID for the system account

async function initWallets() {
    const client = await pool.connect();
    try {
        console.log('🚀 Initializing System Wallets...');

        // 1. Ensure System User Exists
        const userRes = await client.query('SELECT * FROM users WHERE id = $1', [SYSTEM_USER_ID]);
        if (userRes.rowCount === 0) {
            console.log('Creating System User...');
            await client.query(`
                INSERT INTO users (id, email, password_hash, first_name, last_name, account_type, role, email_verified, status)
                VALUES ($1, 'system@elixopay.com', 'SYSTEM_ACCOUNT', 'System', 'Reserve', 'admin', 'admin', true, 'active')
            `, [SYSTEM_USER_ID]);
        }

        // 2. Upsert USDT System Wallet
        const usdtRes = await client.query('SELECT * FROM wallets WHERE id = $1', [SYSTEM_WALLET_USDT]);
        if (usdtRes.rowCount === 0) {
            console.log('Creating System USDT User Wallet...');
            await client.query(`
                INSERT INTO wallets (id, user_id, currency, balance, wallet_address, created_at, updated_at)
                VALUES ($1, $2, 'USDT', 1000000.00, 'SYSTEM_RESERVE_USDT', NOW(), NOW())
            `, [SYSTEM_WALLET_USDT, SYSTEM_USER_ID]);
            console.log('✅ Added 1,000,000 USDT to System Reserve');
        } else {
            console.log('ℹ️ System USDT Wallet already exists. Balance:', usdtRes.rows[0].balance);
        }

        // 3. Upsert THB System Wallet
        const thbRes = await client.query('SELECT * FROM wallets WHERE id = $1', [SYSTEM_WALLET_THB]);
        if (thbRes.rowCount === 0) {
            console.log('Creating System THB User Wallet...');
            await client.query(`
                INSERT INTO wallets (id, user_id, currency, balance, wallet_address, created_at, updated_at)
                VALUES ($1, $2, 'THB', 10000000.00, 'SYSTEM_RESERVE_THB', NOW(), NOW())
            `, [SYSTEM_WALLET_THB, SYSTEM_USER_ID]);
            console.log('✅ Added 10,000,000 THB to System Reserve');
        } else {
            console.log('ℹ️ System THB Wallet already exists. Balance:', thbRes.rows[0].balance);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        client.release();
        process.exit();
    }
}

initWallets();
