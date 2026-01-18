import { KBankService } from '../src/services/kbank.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testKBank() {
    console.log('--- Testing KBank Integration ---');

    try {
        console.log('KBANK_CLIENT_ID:', process.env.KBANK_CLIENT_ID ? 'Loaded' : 'Missing');
        console.log('Current Directory:', process.cwd());

        // 1. Generate QR
        const amount = 100.50;
        const orderId = 'TEST_ORDER_' + Date.now();
        console.log(`Generating QR for amount: ${amount}, orderId: ${orderId}`);

        const qrResult = await KBankService.generateQR(amount, orderId, 'Integration Test');
        console.log('QR Generation Result:', qrResult);

        if (qrResult && qrResult.qrCode) {
            console.log('✅ QR Code generated successfully.');
        } else {
            console.error('❌ Failed to generate QR Code.');
        }

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
    }
}

testKBank();
