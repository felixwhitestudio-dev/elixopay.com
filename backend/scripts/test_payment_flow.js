// Native fetch is available in Node 18+
const { pool } = require('../config/database');

const API_BASE = 'http://localhost:5001/api/v1';
let userToken, merchantToken, apiKey;

async function run() {
    try {
        console.log('🚀 Starting Payment Flow Test...');

        // 1. Login as Merchant (Demo User)
        console.log('1️⃣ Logging in as Merchant (demo@elixopay.com)...');
        const loginRes = await fetch(`${API_BASE}/auth/dev-login`, { method: 'POST' });
        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error('Login Error:', JSON.stringify(loginData, null, 2));
            throw new Error('Login failed');
        }
        userToken = loginData.data.token;
        console.log('✅ Logged in.');

        // 2. Generate API Key
        console.log('2️⃣ Generating API Key...');
        const keyRes = await fetch(`${API_BASE}/api-keys`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Flow Key' })
        });
        const keyData = await keyRes.json();
        if (!keyData.success) {
            console.error(keyData);
            throw new Error('Key generation failed');
        }
        const secretKey = keyData.data.apiKey.secret_key;
        console.log('✅ API Key generated:', secretKey.substring(0, 10) + '...');

        // 3. Create Payment Session using API Key
        console.log('3️⃣ Creating Payment Session using API Key...');
        const paymentRes = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 100,
                currency: 'THB',
                description: 'Test Payment Flow',
                return_url: 'http://localhost:8080/success.html',
                cancel_url: 'http://localhost:8080/cancel.html'
            })
        });
        const paymentData = await paymentRes.json();
        if (!paymentData.success) {
            console.error(paymentData);
            throw new Error('Payment creation failed');
        }
        const { token, checkout_url } = paymentData.data;
        console.log('✅ Payment Session Created:', checkout_url);

        // 4. Verify Payment Details (Public Endpoint)
        console.log('4️⃣ Verify Payment Details (Public Endpoint)...');
        const detailsRes = await fetch(`${API_BASE}/payments/session/${token}`);
        const detailsData = await detailsRes.json();
        if (!detailsData.success) {
            console.error('Fetch Details Error:', JSON.stringify(detailsData, null, 2));
            throw new Error('Fetch details failed');
        }
        console.log('✅ Details Fetched:', detailsData.data.amount, detailsData.data.currency);

        // 5. Simulate Payment (User paying) using original User Token for simplicity
        // In real life, this would be a user session cookie.
        // But wait, the merchant cannot pay themselves! 
        // We need a DIFFERENT user to pay.

        console.log('5️⃣ Creating a BUYER account to pay...');
        const buyerEmail = `buyer_${Date.now()}@test.com`;
        const regRes = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Buyer',
                email: buyerEmail,
                password: 'Password123!@#',
                account_type: 'user'
            })
        });
        const regData = await regRes.json();
        let buyerToken = regData.token || (regData.data && regData.data.token);
        console.log('DEBUG: Buyer Token:', buyerToken ? 'Found' : 'Missing');
        if (!buyerToken) {
            console.log('DEBUG: Register Response:', JSON.stringify(regData, null, 2));
            // If registration failed due to existing user, try login
            if (regData.error && regData.error.message && regData.error.message.includes('already registered')) {
                const buyerLogin = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: buyerEmail, password: 'Password123!@#' })
                });
                const buyerLoginData = await buyerLogin.json();
                buyerToken = buyerLoginData.token || (buyerLoginData.data && buyerLoginData.data.token);
            }
        }

        let validBuyerToken = buyerToken;
        if (!validBuyerToken) {
            // Login as buyer
            const buyerLogin = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: buyerEmail, password: 'password123' })
            });
            const buyerLoginData = await buyerLogin.json();
            validBuyerToken = buyerLoginData.token;
        }

        console.log('✅ Buyer created & logged in.');

        // Deposit money to buyer
        // Cheat: Direct DB update for speed
        // Actually, let's use the deposit endpoint if available or just SQL.
        // Checking for user id...
        // Let's just use SQL.
        // Wait, I cannot easily get ID without decoding token or query.
        // Let's use SQL via pool directly to update wallet of 'buyerEmail'.
        await pool.query(
            `UPDATE wallets SET balance = 5000 WHERE user_id = (SELECT id FROM users WHERE email = $1) AND currency = 'THB'`,
            [buyerEmail]
        );
        console.log('✅ Buyer wallet funded (5000 THB).');

        // 6. Process Payment
        console.log('6️⃣ Processing Payment...');
        const processRes = await fetch(`${API_BASE}/payments/session/${token}/pay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validBuyerToken}`,
                'Content-Type': 'application/json'
            }
        });
        const processData = await processRes.json();

        if (!processData.success) {
            console.error(processData);
            throw new Error('Payment processing failed');
        }
        console.log('✅ Payment Successful!');
        console.log('Redirect URL:', processData.data.redirect_url);

        console.log('🎉 TEST COMPLETE: Checkout Flow Verified.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

run();
