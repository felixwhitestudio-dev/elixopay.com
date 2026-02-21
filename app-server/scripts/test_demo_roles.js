
const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/api/v1';
const DEMO_EMAIL = 'demo@elixopay.com';

async function runTest() {
    try {
        console.log('--- Starting Demo Role Verification ---');

        // 1. Dev Login
        console.log(`\n1. Login as ${DEMO_EMAIL}...`);
        const loginRes = await axios.post(`${BASE_URL}/auth/dev-login`, {});
        const token = loginRes.data.data.token;
        console.log('   Login successful. Token acquired.');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Helper to create user
        const createUser = async (role) => {
            const email = `test_${role}_${Date.now()}@example.com`;
            console.log(`\n   Creating ${role} account (${email})...`);
            try {
                const res = await axios.post(`${BASE_URL}/hierarchy/create`, {
                    email,
                    password: 'password123',
                    firstName: `Test`,
                    lastName: role,
                    role: role
                }, { headers });
                console.log(`   ✅ Success: Created ${role} (ID: ${res.data.data.user.id})`);

                // 2.1 Verify Login for new user
                console.log(`   🔄 Verifying login for ${role}...`);
                try {
                    const loginNew = await axios.post(`${BASE_URL}/auth/login`, {
                        email,
                        password: 'password123'
                    });
                    const userData = loginNew.data.data.user;
                    if (userData.role === role) {
                        console.log(`   ✅ Login Verified: User is ${userData.role}`);
                    } else {
                        console.error(`   ❌ Login Error: Expected ${role} but got ${userData.role}`);
                        return false;
                    }
                } catch (loginErr) {
                    console.error(`   ❌ Login Failed: ${loginErr.response?.data?.error?.message || loginErr.message}`);
                    return false;
                }

                return true;
            } catch (err) {
                console.error(`   ❌ Failed: ${err.response?.data?.error?.message || err.message}`);
                return false;
            }
        };

        // 2. Create Partner
        await createUser('partner');

        // 3. Create Organizer
        await createUser('organizer');

        // 4. Create Merchant
        await createUser('merchant');

        console.log('\n--- Verification Complete ---');

    } catch (error) {
        console.error('CRITICAL ERROR:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

runTest();
