// Native fetch is available in Node 18+

const BASE_URL = 'http://localhost:3000/api/v1';

// Helpers
async function login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return res.json();
}

async function run() {
    console.log('--- Starting Payout Verification ---');

    console.log('\nPlease ensure the server is running on port 3000!');

    // 1. Login/Create User
    console.log('1. Logging in as User...');
    // Assuming a test user exists, otherwise we might need to register. 
    // Using a common test credential if available, or just fail if not.
    // Changing to a known user or registration would be safer, but let's try login first.
    let userToken;
    let loginData = await login('test@example.com', 'password123'); // Adjust as needed

    if (!loginData.success) {
        console.log('User login failed, trying to register...');
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `test_payout_${Date.now()}@example.com`,
                password: 'password123',
                firstName: 'Test',
                lastName: 'Payout'
            })
        });
        const regData = await regRes.json();
        if (!regData.success) {
            console.error('Registration failed:', regData);
            return;
        }
        userToken = regData.token;
        console.log('Registered new user.');
    } else {
        userToken = loginData.token;
        console.log('Logged in.');
    }

    // 2. Deposit Money
    console.log('\n2. Depositing 1000 THB...');
    const depRes = await fetch(`${BASE_URL}/users/wallet/deposit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ amount: 1000, reference: 'Test Deposit' })
    });
    const depData = await depRes.json();
    console.log('Deposit result:', depData.success ? 'Success' : 'Failed');

    // 3. Request Withdrawal
    console.log('\n3. Requesting Withdrawal of 500 THB...');
    const withRes = await fetch(`${BASE_URL}/users/wallet/withdraw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ amount: 500, bankAccount: '123-456-7890 KBANK' })
    });
    const withData = await withRes.json();
    console.log('Withdrawal result:', withData.success ? 'Success' : 'Failed');
    if (!withData.success) return;

    const txId = withData.data.transaction.id;
    console.log(`Transaction ID: ${txId}`);

    // 4. Login as Admin
    // WARNING: You must have an admin user in your DB. 
    // If not, this step will fail. I'll assume an admin exists or I need to seed one.
    // Let's try a standard admin.
    console.log('\n4. Logging in as Admin...');
    let adminToken;
    const adminLogin = await login('admin@elixopay.com', 'admin123');

    if (!adminLogin.success) {
        console.log('Admin login failed. Please ensure an admin user exists (email: admin@elixopay.com).');
        console.log('Skipping admin approval step.');
        return;
    }
    adminToken = adminLogin.token;

    // 5. Check Pending Withdrawals
    console.log('\n5. Checking Pending List...');
    const listRes = await fetch(`${BASE_URL}/admin/withdrawals/pending`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listData = await listRes.json();
    const found = listData.data.withdrawals.find(w => w.id === txId);

    if (found) {
        console.log(`Found pending withdrawal ID ${txId} in the list.`);
    } else {
        console.error(`Withdrawal ID ${txId} NOT found in pending list!`);
        return;
    }

    // 6. Approve
    console.log('\n6. Approving Withdrawal...');
    const appRes = await fetch(`${BASE_URL}/admin/withdrawals/${txId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const appData = await appRes.json();
    console.log('Approval result:', appData.success ? 'Success' : JSON.stringify(appData));

    console.log('\n--- Verification Complete ---');
}

run().catch(console.error);
