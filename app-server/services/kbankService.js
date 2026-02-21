const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class KBankService {
    constructor() {
        this.baseURL = process.env.KBANK_URL || 'https://openapi-sandbox.kasikornbank.com';
        this.clientId = process.env.KBANK_CLIENT_ID;
        this.clientSecret = process.env.KBANK_CLIENT_SECRET;
        this.merchantId = process.env.KBANK_MERCHANT_ID || 'KB102057149704';
        this.partnerId = process.env.KBANK_PARTNER_ID || 'PTR1051673';
        this.partnerSecret = process.env.KBANK_PARTNER_SECRET || 'd4bded59200547bc85903574a293831b';

        this.accessToken = null;
        this.tokenExpiresAt = 0;
    }

    async getAccessToken() {
        // Reuse token if valid (buffer 60s)
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios.post(
                `${this.baseURL}/v2/oauth/token`,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${auth}`,
                        'env-id': 'OAUTH2',
                        'x-test-mode': 'true'
                    }
                }
            );

            const data = response.data;
            this.accessToken = data.access_token;
            // Expires in seconds, convert to ms, remove buffer (60s)
            this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

            return this.accessToken;
        } catch (error) {
            console.error('KBank OAuth Error:', error.response?.data || error.message);

            // Sandbox fallback if API fails (e.g. Rate Limit)
            if (process.env.NODE_ENV !== 'production' && !this.accessToken) {
                console.warn('⚠️ KBank Sandbox Error: Using Mock Access Token');
                return 'mock_access_token_' + Date.now();
            }
            throw new Error('Failed to authenticate with KBank');
        }
    }

    async generateQR(amount, orderId, description = 'Payment') {
        const token = await this.getAccessToken();

        // Ensure amount is string with 2 decimals
        const txnAmount = parseFloat(amount).toFixed(2);

        // Generate unique partnerTxnUid
        const partnerTxnUid = uuidv4().replace(/-/g, '').substring(0, 15); // limit length if needed
        const requestDt = new Date().toISOString().split('.')[0] + 'Z'; // ISO8601 without ms

        const payload = {
            partnerTxnUid: partnerTxnUid,
            partnerId: this.partnerId,
            partnerSecret: this.partnerSecret,
            requestDt: requestDt,
            merchantId: this.merchantId,
            qrType: "3", // Thai QR
            txnAmount: parseFloat(txnAmount),
            txnCurrencyCode: "THB",
            reference1: orderId.substring(0, 20), // Max 20 chars
            reference2: "ELIXOPAY",
            reference3: description.substring(0, 20),
            reference4: "INV",
            metadata: ""
        };

        try {
            const response = await axios.post(
                `${this.baseURL}/v1/qrpayment/request`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-test-mode': 'true',
                        'env-id': 'QR002' // Exercise 2 (Thai QR) env-id
                    }
                }
            );

            const data = response.data;
            return {
                qrCode: data.qrCode,
                txnId: data.partnerTxnUid, // In KBank Sandbox this mirrors what we sent or they send back
                data: data
            };

        } catch (error) {
            console.error('KBank QR Error:', error.response?.data || error.message);

            // Mock for dev/sandbox if API Error (e.g. rate limit, or just testing UI)
            if (process.env.NODE_ENV !== 'production') {
                console.log("Mocking KBank QR due to API failure/Sandbox environment");
                // Return a usable mock TLV from previous successful tests or generic
                return {
                    qrCode: "00020101021129370016A000000677010111011300660000000005802TH53037646304" + txnAmount.replace('.', '') + "5802TH6304", // This is invalid TLV but frontend just displays it
                    txnId: partnerTxnUid,
                    isMock: true
                };
            }
            throw new Error('Failed to generate KBank QR');
        }
    }
    async cancelQR(partnerTxnUid) {
        const token = await this.getAccessToken();
        const requestDt = new Date().toISOString().split('.')[0] + '+07:00'; // Adjust for timezone if needed

        try {
            const payload = {
                partnerTxnUid: uuidv4().replace(/-/g, '').substring(0, 15), // New txn ID for the cancel request
                partnerId: this.partnerId,
                partnerSecret: this.partnerSecret,
                requestDt: requestDt,
                merchantId: this.merchantId,
                origPartnerTxnUid: partnerTxnUid, // The ID of the txn to cancel
            };

            const response = await axios.post(
                `${this.baseURL}/v1/qrpayment/cancel`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-test-mode': 'true'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('KBank Cancel Error:', error.response?.data || error.message);
            // Fallback for demo/sandbox if needed
            if (process.env.NODE_ENV !== 'production') {
                return { statusCode: '00', status: 'CANCELLED_MOCK' };
            }
            throw error;
        }
    }

    async voidPayment(origPartnerTxnUid, partnerTxnUid = null) {
        const token = await this.getAccessToken();
        const requestDt = new Date().toISOString().split('.')[0] + '+07:00';

        // If not provided, generate a new ID for the void transaction itself
        const currentPartnerTxnUid = partnerTxnUid || uuidv4().replace(/-/g, '').substring(0, 15);

        try {
            const payload = {
                partnerTxnUid: currentPartnerTxnUid,
                partnerId: this.partnerId,
                partnerSecret: this.partnerSecret,
                requestDt: requestDt,
                merchantId: this.merchantId,
                origPartnerTxnUid: origPartnerTxnUid,
            };

            const response = await axios.post(
                `${this.baseURL}/v1/qrpayment/void`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-test-mode': 'true'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('KBank Void Error:', error.response?.data || error.message);
            // Fallback for demo/sandbox if needed
            if (process.env.NODE_ENV !== 'production') {
                return { statusCode: '00', status: 'VOIDED_MOCK' };
            }
            throw error;
        }
    }
}

module.exports = new KBankService();
