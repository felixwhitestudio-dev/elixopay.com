
// Wrapper for fetch in Node (if global fetch exists, use it)
const _fetch = global.fetch;

if (!_fetch) {
    console.error('Error: Global fetch is not available. Please prompt the assistant to update the script for your Node version.');
    process.exit(1);
}

const API_URL = 'http://localhost:5001/api/v1';

async function request(method, path, body = null, token = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8080',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = {
        method,
        headers,
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await _fetch(`${API_URL}${path}`, opts);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error(`❌ Failed to parse JSON for ${path}. Status: ${res.status}`);
        console.error('Raw Body:', text);
        return { status: res.status, data: null };
    }
    return { status: res.status, data };
}

async function main() {
    try {
        console.log('\n🔵 --- 1. STARTING SIMULATION ---');

        // 0. Probe
        console.log('📡 Probing Server...');
        // Correct the usage of request which now expects method, path, body, token
        // Wait, API_URL includes /api/v1. The root / is at http://localhost:5000/
        // My request function prepends API_URL.
        // I need to hit the root using fetch directly or adjust path.
        // Let's just try to hit /api/v1/auth/register first with the new User-Agent.
        // But let's checking a simple GET endpoint from API first if exists?
        // server.js has app.get('/', ...) at root, NOT under /api/v1.

        const rootRes = await _fetch('http://localhost:5001/');
        console.log(`Probe result: ${rootRes.status}`);
        if (rootRes.status !== 200) console.log(await rootRes.text());


        // 1. Register
        const email = `demo_${Date.now()}@example.com`;
        const password = 'Password@123';
        const name = 'Demo User';

        console.log(`\n👤 Creating User: ${email}`);
        const reg = await request('POST', '/auth/register', { name, email, password });

        if (reg.status !== 200 && reg.status !== 201) {
            // If already exists (rare due to timestamp), try login
            console.log('User might result in error or already exist:', reg.data);
        }

        // 2. Login
        console.log(`\n🔑 Logging in...`);
        const login = await request('POST', '/auth/login', { email, password });

        if (!login.data.success) {
            console.error('Login failed:', login.data);
            return;
        }

        const token = login.data.data.token;
        console.log('✅ Login Successful. Token obtained.');

        // 3. Check Initial Balance
        console.log(`\n💰 Checking Initial Balance...`);
        const meInitial = await request('GET', '/auth/me', null, token);
        // Assuming user.wallets is populated or we need another call
        // Let's print what we get
        // console.log('User Data:', JSON.stringify(meInitial.data.data, null, 2));

        // 4. Deposit
        const depositAmount = 10000;
        console.log(`\n💵 Depositing ${depositAmount.toLocaleString()} THB...`);
        const deposit = await request('POST', '/wallet/deposit', {
            amount: depositAmount,
            channel: 'bank' // or promptpay
        }, token);

        if (deposit.data.success) {
            console.log(`✅ Deposit Successful! New Balance: ${deposit.data.data.balance}`);
        } else {
            console.error('❌ Deposit Failed:', deposit.data);
        }

        // 5. Exchange
        const exchangeAmount = 5000;
        console.log(`\n💱 Exchanging ${exchangeAmount.toLocaleString()} THB to USDT...`);
        console.log(`   (Assuming Rate ~35.00)`);

        const exchange = await request('POST', '/wallet/exchange', {
            amount: exchangeAmount,
            fromCurrency: 'THB',
            toCurrency: 'USDT'
        }, token);

        if (exchange.data.success) {
            console.log(`✅ Exchange Successful!`);
            console.log(`   Sent: ${exchange.data.data.exchangedAmount} THB`);
            console.log(`   Received: ${exchange.data.data.receivedAmount} USDT`);
            console.log(`   Rate Used: ${exchange.data.data.rate}`);
        } else {
            console.error('❌ Exchange Failed:', exchange.data);
        }

        // 6. Final Balance Check
        console.log(`\n📊 Final Wallet State:`);
        // We might need to refresh user to get updated wallets if they are not returned in exchange
        const meFinal = await request('GET', '/auth/me', null, token);

        // Use a clearer display if possible
        if (meFinal.data.success) {
            const user = meFinal.data.data;
            // Sometimes wallets are attached differently, handle both arrays or map
            // Wait, if backend implementation of /me doesn't include wallets, we won't see them.
            // But let's assume it does or we rely on the previous response data.

            // If wallets key exists:
            if (user.wallets && Array.isArray(user.wallets)) {
                user.wallets.forEach(w => {
                    console.log(`   - ${w.currency}: ${parseFloat(w.balance).toLocaleString()}`);
                });
            } else {
                console.log('   (Wallets not found in /me response, relying on action outputs)');
            }
        }

        console.log('\n🔵 --- SIMULATION COMPLETE ---');

    } catch (error) {
        console.error('Runtime Error:', error);
    }
}

main();
