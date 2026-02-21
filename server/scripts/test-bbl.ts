import { BBLService } from '../src/services/bbl.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env but we might override them for testing
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testBBLInfo() {
    console.log('--- Testing Bangkok Bank (BBL) Integration Utils ---');

    console.log('1. Generating Test RSA Keypair...');
    const merchantKeys = BBLService.generateKeyPair();
    const bankKeys = BBLService.generateKeyPair(); // Simulating the bank having its own pair

    console.log('✅ Keys Generated.');

    let allPassed = true;
    // console.log('Merchant Private Key Preview:', merchantKeys.privateKey.substring(0, 50) + '...');
    // console.log('Bank Public Key Preview:', bankKeys.publicKey.substring(0, 50) + '...');

    // Mock Process Env for the service to use these keys
    process.env.BBL_MERCHANT_PRIVATE_KEY = merchantKeys.privateKey;
    process.env.BBL_BANK_PUBLIC_KEY = bankKeys.publicKey; // We verify using Bank's Public Key

    // NOTE: For verification test, if we sign as "Bank", we need Bank's Private Key, 
    // but the Service only stores Bank's Public Key. 
    // So to test `verifyJWT`, we must manually sign with `bankKeys.privateKey`.

    console.log('\n2. Testing JWT Generation (Merchant sending to Bank)...');
    const payloadStart = {
        txnId: 'TXN_' + Date.now(),
        amount: '1000.00',
        currency: 'THB'
    };

    try {
        const token = BBLService.generateJWT(payloadStart);
        console.log('✅ JWT Generated successfully.');
        console.log('Token:', token);

        // Allow decoding to see payload
        // Note: We cannot use BBLService.verifyJWT(token) here because that function uses the Bank's Public Key.
        // But this token was signed with the Merchant's Private Key.
        // So we skip using the service method and verify manually with the Merchant Public Key below.


        console.log('Validating crypto signature structure...');
        // We can't verify OUR OWN signature with the BANK'S public key.
        // We verify our own signature with OUR public key just to check validity.
        const jwt = require('jsonwebtoken');
        const selfVerify = jwt.verify(token, merchantKeys.publicKey, { algorithms: ['RS256'] });
        console.log('✅ Self-Verification successful (Merchant Public Key verifies Merchant Private Key signature).');
        console.log('Decoded Payload:', selfVerify);

    } catch (e: any) {
        console.error('❌ JWT Generation Test Failed:', e.message);
        allPassed = false;
    }

    console.log('\n3. Testing JWT Verification (Bank sending to Merchant)...');
    // Simulate Bank Request with REAL Payload provided by User
    const bankPayload = {
        "paymentRequestId": "234ABB58CC00",
        "serviceCode": "BBLTEST",
        "providerId": "BBLTEST",
        "billerId": "123456789012345",
        "reference1": "1124579998112",
        "reference2": "22555347AB",
        "reference3": "20171106151550",
        "totalAmount": 999999999.99,
        "currencyCode": "THB",
        "paymentStatus": "success",
        "paymentAccount": "xxx-x-x0055-x",
        "paymentDateTime": "2017-02-15T15:23:11.001+07:00",
        "paymentReferenceID": "123456",
        "slipImage": "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
        "payeeId": "1234567890123",
        "transDate": "2017-11-16",
        "transTime": "17:50:50",
        "transRef": "100999123456789",
        "channel": "C",
        "termType": "80",
        "termId": "010125",
        "amount": 999999999.99,
        "fromBank": "002",
        "fromBranch": "0147",
        "fromName": "ABCD",
        "bankRef": "BBL",
        "approvalCode": "EXAMPL",
        "txnType": "C",
        "retryFlag": "Y"
    };

    // Sign with BANK PRIVATE KEY
    const jwt = require('jsonwebtoken');
    const bankToken = jwt.sign(bankPayload, bankKeys.privateKey, { algorithm: 'RS256' });
    console.log('Generated Mock Bank Token (Preview):', bankToken.substring(0, 50) + '...');

    try {
        // Verify with Service (which uses BANK PUBLIC KEY from env)
        const verifiedData = BBLService.verifyJWT(bankToken);
        console.log('✅ BBLService.verifyJWT successful.');
        console.log('Verified Data:', verifiedData);
    } catch (e: any) {
        console.error('❌ JWT Verification Test Failed:', e.message);
        allPassed = false;
    }

    console.log('\n4. Testing Basic Auth Validation...');
    process.env.BBL_USERNAME = 'testuser';
    process.env.BBL_PASSWORD = 'testpassword';

    const validAuth = 'Basic ' + Buffer.from('testuser:testpassword').toString('base64');
    const invalidAuth = 'Basic ' + Buffer.from('wrong:wrong').toString('base64');

    if (BBLService.validateBasicAuth(validAuth)) {
        console.log('✅ Valid Auth passed.');
    } else {
        console.error('❌ Valid Auth failed.');
        allPassed = false;
    }

    if (!BBLService.validateBasicAuth(invalidAuth)) {
        console.log('✅ Invalid Auth rejected.');
    } else {
        console.error('❌ Invalid Auth passed (Security Risk!).');
        allPassed = false;
    }

    console.log('\n---------------------------------------------------');
    if (allPassed) {
        console.log('✅✅✅  ALL BBL INTEGRATION TESTS PASSED  ✅✅✅');
        console.log('---------------------------------------------------');
    } else {
        console.error('❌❌❌  SOME TESTS FAILED  ❌❌❌');
        console.error('---------------------------------------------------');
        process.exit(1);
    }
}

testBBLInfo();
