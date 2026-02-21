const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

const BASE_URL = `http://localhost:${process.env.PORT || 5001}/api/v1`;

async function runTest() {
    try {
        console.log('--- Starting Admin Actions Verification ---');

        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'demo@elixopay.com',
            password: 'Elixopay2026!'
        });
        const token = loginRes.data.data.token;
        console.log('   Logged in.');

        // 2. Test Cancel (Pending -> Cancelled)
        console.log('\n2. Testing CANCEL (Pending -> Cancelled)...');
        const payRes1 = await axios.post(`${BASE_URL}/payments`, {
            amount: 150.00,
            currency: 'THB',
            payment_method_type: 'kbank_qr',
            return_url: 'http://example.com/success'
        }, { headers: { Authorization: `Bearer ${token}` } });

        console.log('Create Payment Response:', JSON.stringify(payRes1.data, null, 2));

        const payId1 = payRes1.data.data.payment?.id || payRes1.data.data.id; // Try both structures
        console.log(`   Created Pending Payment: ${payId1}`);

        const cancelRes = await axios.post(`${BASE_URL}/payments/${payId1}/cancel`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`   Cancel Result: Success=${cancelRes.data.success}, Status=${cancelRes.data.data.status}`);

        // 3. Test Refund (Completed -> Refunded)
        console.log('\n3. Testing REFUND (Completed -> Refunded)...');
        const payRes2 = await axios.post(`${BASE_URL}/payments`, {
            amount: 200.00,
            currency: 'THB',
            payment_method_type: 'kbank_qr',
            return_url: 'http://example.com/success'
        }, { headers: { Authorization: `Bearer ${token}` } });

        const payId2 = payRes2.data.data.payment?.id || payRes2.data.data.id;
        const piId2 = payRes2.data.data.paymentIntentId;
        console.log(`   Created Payment to Refund: ${payId2} (Intent: ${piId2})`);

        // Manually force status to completed
        await pool.query("UPDATE payments SET status = 'completed' WHERE id = $1", [payId2]);
        console.log('   (Manually updated status to COMPLETED)');

        const refundRes = await axios.post(`${BASE_URL}/payments/${payId2}/refund`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`   Refund Result: Success=${refundRes.data.success}, Status=${refundRes.data.data.status}`);


    } catch (error) {
        console.error('TEST FAILED:', error.message);
        if (error.response) console.error('API Response:', error.response.data);
    } finally {
        await pool.end();
    }
}

runTest();
