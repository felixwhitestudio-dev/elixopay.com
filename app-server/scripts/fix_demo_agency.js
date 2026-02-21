const { pool } = require('../config/database');

async function fixDemoAgency() {
    try {
        console.log('Fixing demo user agency membership...');

        // 1. Get Demo User
        const userRes = await pool.query("SELECT id FROM users WHERE email = 'demo@elixopay.com'");
        if (userRes.rows.length === 0) {
            console.error('Demo user not found!');
            process.exit(1);
        }
        const userId = userRes.rows[0].id;
        console.log(`Found demo user: ${userId}`);

        // 2. Check if agency exists
        const agencyRes = await pool.query("SELECT id FROM agencies WHERE name = 'Demo Agency'");
        let agencyId;

        if (agencyRes.rows.length === 0) {
            console.log('Creating Demo Agency...');
            const newAgency = await pool.query(
                "INSERT INTO agencies (name, code, status, created_at) VALUES ($1, $2, 'active', NOW()) RETURNING id",
                ['Demo Agency', 'DEMO001']
            );
            agencyId = newAgency.rows[0].id;
        } else {
            agencyId = agencyRes.rows[0].id;
        }
        console.log(`Using Agency ID: ${agencyId}`);

        // 3. Check membership
        const memberRes = await pool.query(
            "SELECT * FROM agency_members WHERE user_id = $1 AND agency_id = $2",
            [userId, agencyId]
        );

        if (memberRes.rows.length === 0) {
            console.log('Adding user to agency...');
            await pool.query(
                "INSERT INTO agency_members (agency_id, user_id, role_in_agency, is_active) VALUES ($1, $2, 'owner', true)",
                [agencyId, userId]
            );
        } else {
            console.log('User already in agency.');
        }

        // 4. Ensure agency balance exists
        const balanceRes = await pool.query(
            "SELECT * FROM agency_balances WHERE agency_id = $1 AND currency = 'THB'",
            [agencyId]
        );

        if (balanceRes.rows.length === 0) {
            console.log('Creating initial balance...');
            await pool.query(
                "INSERT INTO agency_balances (agency_id, currency, available_amount, pending_amount, reserved_amount) VALUES ($1, 'THB', 50000.00, 0, 0)",
                [agencyId]
            );
        }

        console.log('✅ Demo agency setup complete.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixDemoAgency();
