require('dotenv').config({ path: '../.env' }); // Adjust path to .env
const kbankService = require('../services/kbankService');

async function testService() {
    console.log('Testing KBank Service (JS)...');
    try {
        const amount = 120.50;
        const orderId = 'TEST-ORDER-JS-01';
        const description = 'Integration Test';

        console.log(`Generating QR for ${amount} THB...`);
        const result = await kbankService.generateQR(amount, orderId, description);

        console.log('Success!');
        console.log('Txn ID:', result.txnId);
        console.log('QR Code Length:', result.qrCode.length);
        console.log('QR Code Preview:', result.qrCode.substring(0, 50) + '...');

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
}

testService();
