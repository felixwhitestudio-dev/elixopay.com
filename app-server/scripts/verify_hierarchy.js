const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- Verifying Hierarchy & Commissions ---');

        // Helper to create user
        async function createUser(role, email, parentId = null) {
            const pass = await argon2.hash('password123');
            const res = await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'active', true, $6, NOW())
                 RETURNING id, email, account_type`,
                [email, pass, role, 'User', role, parentId]
            );
            const user = res.rows[0];

            // Create Wallet
            await client.query(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                 VALUES ($1, $2, 0.00, 'THB', true, NOW())`,
                [user.id, uuidv4()]
            );

            return user;
        }

        // 1. Create Hierarchy
        const prefix = 'verif_' + Date.now();
        console.log('Creating users...');

        const partner = await createUser('partner', `${prefix}_partner@test.com`);
        const organizer = await createUser('organizer', `${prefix}_org@test.com`, partner.id);
        const agent = await createUser('agent', `${prefix}_agent@test.com`, organizer.id);
        const merchant = await createUser('merchant', `${prefix}_merch@test.com`, agent.id);
        const payer = await createUser('merchant', `${prefix}_payer@test.com`); // Regular user

        // Top up Payer
        await client.query('UPDATE wallets SET balance = 10000 WHERE user_id = $1', [payer.id]);

        // 2. Set Custom Fee (Organizer -> Agent)
        console.log('Setting custom fee...');
        // Organizer takes 10% from Agent's volume (Standard is 0.3%)
        await client.query(
            `INSERT INTO fee_configs (user_id, set_by_id, rate_percent) VALUES ($1, $2, 0.10)`,
            [agent.id, organizer.id] // "Agent" is the downline generating volume? 
            // Wait, the logic in commissionService checks fee for 'currentUserId' set by 'parentId'.
            // When traversing up from Merchant -> Agent:
            //   - Parent is Agent. Logic checks fee for Merchant set by Agent.
            // When traversing up from Agent -> Organizer:
            //   - Parent is Organizer. Logic checks fee for Agent set by Organizer.
            // So if we want Organizer to earn MORE from Agent's tree, we set fee for Agent set by Organizer.
        );

        // 3. Create Payment
        console.log('Creating payment...');
        const token = uuidv4();
        const amount = 1000.00;
        const payRes = await client.query(
            `INSERT INTO payments (merchant_id, amount, currency, status, token, return_url, created_at)
             VALUES ($1, $2, 'THB', 'pending', $3, 'http://test', NOW()) RETURNING id`,
            [merchant.id, amount, token]
        );
        const paymentId = payRes.rows[0].id;

        // 4. Process Payment (Simulate Logic)
        console.log('Processing payment...');

        // Use the actual service? No, let's call the controller logic or service logic directly to simulate
        // But to be integrated, we should call the endpoint or duplicate logic.
        // Let's manually trigger the movement and commission service call.

        // Transfer money
        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [amount, payer.id]);
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [amount, merchant.id]);
        await client.query("UPDATE payments SET status = 'completed', payer_id = $1 WHERE id = $2", [payer.id, paymentId]);

        // Call Service
        const commissionService = require('../services/commissionService');
        await commissionService.distributeCommissions(paymentId, merchant.id, amount, 'THB');

        // 5. Verify Logs
        console.log('\n--- Verification Results ---');
        const logs = await client.query(
            `SELECT beneficiary_id, amount, rate_snapshot FROM commission_logs WHERE source_payment_id = $1`,
            [paymentId]
        );

        const check = (userId, role, expectedAmount) => {
            const log = logs.rows.find(l => l.beneficiary_id === userId);
            if (log) {
                console.log(`✅ ${role} received ${log.amount} (Rate: ${log.rate_snapshot}) - Expected: ${expectedAmount}`);
            } else {
                console.log(`❌ ${role} received NOTHING - Expected: ${expectedAmount}`);
            }
        };

        // Expected:
        // Agent: Global Rate (0.0050) = 5.00 (Parent of Merchant)
        // Organizer: Custom Rate (0.10) = 100.00 (Parent of Agent)
        // Partner: Global Rate (0.0020) = 2.00 (Parent of Organizer)

        check(agent.id, 'Agent', 5.00);
        check(organizer.id, 'Organizer', 100.00);
        check(partner.id, 'Partner', 2.00);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
