const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'server/.env' });

async function test() {
    // Generate a valid JWT token for a user
    const token = jwt.sign({ id: 1, email: 'admin@elixopay.com', role: 'admin', kycStatus: 'verified' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log("Token:", token);
    try {
        console.time("GET /api-keys");
        const res = await axios.get('https://api.elixopay.com/api/v1/api-keys', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.timeEnd("GET /api-keys");
        console.log("Success:", res.data);
    } catch(e) {
        console.timeEnd("GET /api-keys");
        console.log("Error:", e.response?.data || e.message);
    }
}
test();
