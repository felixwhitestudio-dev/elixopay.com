// Native fetch in Node 18+
// Actually, using native fetch since Node 18+

const API_BASE = 'http://localhost:5001/api/v1';

async function run() {
    try {
        // 1. Login as Merchant
        const loginRes = await fetch(`${API_BASE}/auth/dev-login`, { method: 'POST' });
        const loginData = await loginRes.json();
        if (!loginData.success) throw new Error('Login failed');
        const userToken = loginData.data.token;

        // 2. Generate API Key
        const keyRes = await fetch(`${API_BASE}/api-keys`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Browser Test Key ' + Date.now() })
        });
        const keyData = await keyRes.json();
        const secretKey = keyData.data.apiKey.secret_key;

        // 3. Create Payment Session
        const paymentRes = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 500.00,
                currency: 'THB',
                description: 'Premium Elixir Package',
                return_url: 'http://localhost:8080/dashboard.html?payment=success',
                cancel_url: 'http://localhost:8080/dashboard.html?payment=cancel'
            })
        });
        const paymentData = await paymentRes.json();

        console.log('CHECKOUT_URL=' + paymentData.data.checkout_url);
        console.log('SECRET_KEY=' + secretKey);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
