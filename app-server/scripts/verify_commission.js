const { pool } = require('../config/database');
const commissionService = require('../services/commissionService');
const { v4: uuidv4 } = require('uuid');

async function testCommission() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Commission Verify ---');

        // 1. Setup Hierarchy: Partner -> Merchant
        // Find or Create Partner
        let partnerRes = await client.query("SELECT id FROM users WHERE email = 'demo@elixopay.com'");
        if (partnerRes.rows.length === 0) {
            console.log('Creating demo partner...');
            // ... (skip complex create, assume demo exists from previous steps or create minimal)
            // Actually let's just create raw
            const pInsert = await client.query(`INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified) 
                VALUES ('demo@elixopay.com', 'hash', 'Demo', 'Partner', 'partner', 'active', true) RETURNING id`);
            partnerRes = { rows: [pInsert.rows[0]] };
        }
        const partnerId = partnerRes.rows[0].id;

        // Ensure partner has agency/wallet
        await client.query(`INSERT INTO agency_members (agency_id, user_id, role_in_agency) 
            VALUES ((SELECT id FROM agencies LIMIT 1), $1, 'owner') ON CONFLICT DO NOTHING`, [partnerId]);
        // Also ensure agency_balances exists for that agency
        const agencyIdRes = await client.query(`SELECT agency_id FROM agency_members WHERE user_id = $1 LIMIT 1`, [partnerId]);
        const agencyId = agencyIdRes.rows[0].agency_id;
        await client.query(`INSERT INTO agency_balances (agency_id, available_amount, currency) VALUES ($1, 0, 'THB') ON CONFLICT DO NOTHING`, [agencyId]);


        // Create/Find Merchant under Partner
        let merchantRes = await client.query("SELECT id FROM users WHERE email = 'merchant_downline@test.com'");
        let merchantId;
        if (merchantRes.rows.length === 0) {
            const mInsert = await client.query(`INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id) 
                VALUES ('merchant_downline@test.com', 'hash', 'Merchant', 'Downline', 'merchant', 'active', true, $1) RETURNING id`, [partnerId]);
            merchantId = mInsert.rows[0].id;
        } else {
            merchantId = merchantRes.rows[0].id;
            // Ensure parent is linked
            await client.query('UPDATE users SET parent_id = $1 WHERE id = $2', [partnerId, merchantId]);
        }

        console.log(`Hierarchy: Partner (${partnerId}) <- Merchant (${merchantId})`);

        // 2. Simulate Payment
        const amount = 1000.00;
        const paymentId = uuidv4();
        // We calculate commission manually or call service?
        // Let's call service directly to test logic isolated from Controller

        console.log(`Simulating Payment of ${amount} THB`);

        await commissionService.distributeCommissions(paymentId, merchantId, amount, 'THB');

        // 3. Verify Logs
        const logRes = await client.query('SELECT * FROM commission_logs WHERE source_payment_id = $1', [paymentId]); // Note: ID in logs is UUID, here string v4 is fine

        console.log('Commission Logs found:', logRes.rows.length);
        logRes.rows.forEach(r => {
            console.log(` - Paid to ${r.beneficiary_id}: ${r.amount} THB (Rate: ${r.rate_snapshot})`);
        });

        if (logRes.rows.length > 0 && parseFloat(logRes.rows[0].amount) === 2.00) { // 0.2% of 1000 = 2
            console.log('SUCCESS: Commission calculated correctly (0.2%)');
        } else {
            console.log('FAILURE: Commission amount incorrect or missing.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}

testCommission();
