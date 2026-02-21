const db = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function createHierarchy() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🏗️  Setting up User Hierarchy Demo...');

        // Helper to generate wallet address
        const genWallet = () => '0x' + crypto.randomBytes(20).toString('hex');

        // 1. Create or Get Partner (Top Level)
        const partnerEmail = 'manual_partner@elixopay.com';
        const partnerCode = 'PARTNER_001';
        let partnerId;

        console.log(`\n1️⃣  Checking/Creating Partner: ${partnerEmail}`);
        const pRes = await client.query('SELECT id FROM users WHERE email = $1', [partnerEmail]);

        if (pRes.rows.length > 0) {
            partnerId = pRes.rows[0].id;
            console.log('   ✅ Partner already exists.');
        } else {
            const hash = await bcrypt.hash('Password123!', 10);
            const newP = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, invite_code)
                VALUES ($1, $2, 'Manual', 'Partner', 'partner', 'active', true, $3)
                RETURNING id
            `, [partnerEmail, hash, partnerCode]);
            partnerId = newP.rows[0].id;
            // Create wallet
            await client.query("INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, 0, 'THB', $2)", [partnerId, genWallet()]);
            console.log('   ✨ Created new Partner.');
        }

        // 2. Create Organizer (Child of Partner)
        const organizerEmail = 'manual_organizer@elixopay.com';
        const organizerCode = 'ORG_001';
        let organizerId;

        console.log(`\n2️⃣  Checking/Creating Organizer: ${organizerEmail}`);
        const oRes = await client.query('SELECT id FROM users WHERE email = $1', [organizerEmail]);

        if (oRes.rows.length > 0) {
            organizerId = oRes.rows[0].id;
            console.log('   ✅ Organizer already exists.');
        } else {
            const hash = await bcrypt.hash('Password123!', 10);
            const newO = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, invite_code, parent_id)
                VALUES ($1, $2, 'Manual', 'Organizer', 'organizer', 'active', true, $3, $4)
                RETURNING id
            `, [organizerEmail, hash, organizerCode, partnerId]);
            organizerId = newO.rows[0].id;
            // Create wallet
            await client.query("INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, 0, 'THB', $2)", [organizerId, genWallet()]);
            console.log('   ✨ Created new Organizer (linked to Partner).');
        }

        // 3. Create Agent (Child of Organizer)
        const agentEmail = 'manual_agent@elixopay.com';
        const agentCode = 'AGENT_001';
        let agentId;

        console.log(`\n3️⃣  Checking/Creating Agent: ${agentEmail}`);
        const aRes = await client.query('SELECT id FROM users WHERE email = $1', [agentEmail]);

        if (aRes.rows.length > 0) {
            agentId = aRes.rows[0].id;
            console.log('   ✅ Agent already exists.');
        } else {
            const hash = await bcrypt.hash('Password123!', 10);
            const newA = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, invite_code, parent_id)
                VALUES ($1, $2, 'Manual', 'Agent', 'agent', 'active', true, $3, $4)
                RETURNING id
            `, [agentEmail, hash, agentCode, organizerId]);
            agentId = newA.rows[0].id;
            // Create wallet
            await client.query("INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, 0, 'THB', $2)", [agentId, genWallet()]);
            console.log('   ✨ Created new Agent (linked to Organizer).');
        }

        // 4. Create Final Merchant (Child of Agent)
        const merchantEmail = 'manual_merchant@elixopay.com';
        let merchantId;

        console.log(`\n4️⃣  Checking/Creating Merchant: ${merchantEmail}`);
        const mRes = await client.query('SELECT id FROM users WHERE email = $1', [merchantEmail]);

        if (mRes.rows.length > 0) {
            merchantId = mRes.rows[0].id;
            console.log('   ✅ Merchant already exists.');
        } else {
            const hash = await bcrypt.hash('Password123!', 10);
            const newM = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id)
                VALUES ($1, $2, 'Manual', 'Merchant', 'merchant', 'active', true, $3)
                RETURNING id
            `, [merchantEmail, hash, agentId]);
            merchantId = newM.rows[0].id;
            // Create wallet
            await client.query("INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, 0, 'THB', $2)", [merchantId, genWallet()]);
            console.log('   ✨ Created new Merchant (linked to Agent).');
        }

        await client.query('COMMIT');

        console.log('\n🎉 Hierarchy Setup Complete!');
        console.log('---------------------------------------------------');
        console.log(`Partner:   ${partnerEmail}  (Code: ${partnerCode})`);
        console.log(`Organizer: ${organizerEmail} (Code: ${organizerCode})`);
        console.log(`Agent:     ${agentEmail}     (Code: ${agentCode})`);
        console.log(`Merchant:  ${merchantEmail}`);
        console.log('---------------------------------------------------');
        console.log('You can now log in with these accounts using password: Password123!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error creating hierarchy:', e);
    } finally {
        client.release();
        process.exit();
    }
}

createHierarchy();
