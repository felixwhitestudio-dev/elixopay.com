const { pool } = require('../config/database');

// System USDT Wallet ID
const SYSTEM_WALLET_USDT = '84404d85-9272-4c9f-b010-17c127efe157';

async function drainLiquidity() {
    const client = await pool.connect();
    try {
        console.log('Draining System Liquidity (Simulating Out of Stock)...');
        // Set balance to 0.5 USDT (too low for most buys)
        await client.query('UPDATE wallets SET balance = 0.5 WHERE id = $1', [SYSTEM_WALLET_USDT]);
        console.log('System Wallet set to 0.5 USDT');
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        process.exit();
    }
}

drainLiquidity();
