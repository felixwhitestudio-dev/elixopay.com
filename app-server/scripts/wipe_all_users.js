const { Pool } = require('pg');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function wipeAllUsers() {
    try {
        console.log('⚠️  WARNING: THIS WILL DELETE ALL USERS AND RELATED DATA (Wallets, Logs, etc.) ⚠️');
        console.log('Database:', process.env.DB_NAME);
        console.log('Host:', process.env.DB_HOST);

        // Count users before wipe
        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        const count = countRes.rows[0].count;
        console.log(`Current user count: ${count}`);

        if (count === '0') {
            console.log('Database is already empty.');
            return;
        }

        // Just proceed, user already approved in chat. 
        // In a real CLI interactions we might ask for confirmation, but here I am running it on behalf of the user who already approved.

        // Explicitly delete dependent tables first due to FK constraints
        console.log('Deleting dependent data...');

        const tablesToDelete = [
            'audit_logs',
            'webhook_logs',
            'webhook_deliveries',
            'transaction_logs',
            'transactions',
            'ledger_entries',
            'commission_logs',
            'partner_payouts',
            'refunds',
            'payments',
            'user_bank_accounts',
            'payout_accounts',
            'withdrawal_requests',
            'merchant_sites',
            'documents',
            'commission_overrides',
            'commission_rules',
            'commission_settings',
            'partners',
            'partner_customers',
            'agency_members',
            'agency_balances',
            'agencies',
            'webhooks',
            'webhook_endpoints',
            'api_keys',
            'fee_configs',
            'system_settings',
            'sessions',
            'wallets'
        ];

        for (const table of tablesToDelete) {
            try {
                process.stdout.write(`Deleting from ${table}... `);
                await pool.query(`DELETE FROM ${table}`);
                console.log('Done');
            } catch (e) {
                console.log(`Error/Skipped (might be empty or missing permission): ${e.message.split('\n')[0]}`);
            }
        }

        console.log('Dependent data cleared. Deleting users...');
        const res = await pool.query('DELETE FROM users');
        console.log(`Successfully deleted ${res.rowCount} users.`);

        // Verify
        const finalCount = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`Final user count: ${finalCount.rows[0].count}`);

    } catch (error) {
        console.error('Error wiping users:', error);
    } finally {
        await pool.end();
        rl.close();
    }
}

wipeAllUsers();
