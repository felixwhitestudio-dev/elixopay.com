
const _fetch = global.fetch || require('node-fetch'); // Fallback if needed, but we are on Node 18+ likely

const API_URL = 'http://localhost:5001/api/v1';

async function devLogin() {
    const res = await _fetch(`${API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:8080'
        }
    });
    if (!res.ok) {
        console.error('Login failed', res.status, await res.text());
        return null;
    }
    const data = await res.json();
    return data.data.user;
}

async function main() {
    console.log('--- Checking Persistence ---');
    console.log('1. Logging in first time...');
    const user1 = await devLogin();
    if (user1) console.log(`   User 1 ID: ${user1.id} (${user1.email})`);

    console.log('2. Logging in second time...');
    const user2 = await devLogin();
    if (user2) console.log(`   User 2 ID: ${user2.id} (${user2.email})`);

    if (user1 && user2) {
        if (user1.id === user2.id) {
            console.log('✅ PASS: User ID persisted.');
        } else {
            console.log('❌ FAIL: User ID changed! (New user created)');
        }
    }
}

main();
