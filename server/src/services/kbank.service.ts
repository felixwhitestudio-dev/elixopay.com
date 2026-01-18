import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class KBankService {
    private static accessToken: string | null = null;
    private static tokenExpiresAt: number = 0;

    private static get baseURL() { return process.env.KBANK_URL || 'https://openapi-sandbox.kasikornbank.com'; }
    private static get clientId() { return process.env.KBANK_CLIENT_ID; }
    private static get clientSecret() { return process.env.KBANK_CLIENT_SECRET; }

    private static async getAccessToken(): Promise<string> {
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
                        // 'env-id': 'OAUTH2', // Not always needed depending on environment
                    },
                }
            );

            const data = response.data as any;
            this.accessToken = data.access_token;
            // Expires in seconds, convert to ms, remove buffer (60s)
            this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

            return this.accessToken!;
        } catch (error: any) {
            console.error('KBank OAuth Error:', error.response?.data || error.message);

            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ KBank Sandbox Error: Using Mock Access Token');
                this.accessToken = 'mock_access_token_' + Date.now();
                this.tokenExpiresAt = Date.now() + 3600000;
                return this.accessToken;
            }

            throw new Error('Failed to authenticate with KBank');
        }
    }

    static async generateQR(amount: number, orderId: string, description: string = 'Payment') {
        const token = await this.getAccessToken();
        const partnerId = process.env.KBANK_MERCHANT_ID || '0001';
        const partnerPaymentId = uuidv4().replace(/-/g, '').substring(0, 20); // KBank limit

        const payload = {
            partnerTxnUid: partnerPaymentId,
            partnerId: partnerId,
            amount: amount.toFixed(2),
            currency: 'THB',
            reference1: orderId.substring(0, 20), // Max 20 chars
            reference2: 'Elixopay',
            reference3: description.substring(0, 20),
            reference4: '',
            shopId: 'SHOP001', // Should be dynamic based on merchant config?
            terminalId: 'TERM001'
        };

        try {
            const response = await axios.post(
                `${this.baseURL}/v1/qr/payment`, // Verify endpoint
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'env-id': 'QR001'
                    }
                }
            );

            const data = response.data as any;
            return {
                qrCode: data.qrCode,
                txnId: data.txnId,
                refId: partnerPaymentId
            };
        } catch (error: any) {
            console.error('KBank QR Error:', error.response?.data || error.message);
            // For sandbox/demo purposes if API fails (common in sandbox), mock a response
            if (process.env.NODE_ENV !== 'production') {
                console.log("Mocking KBank QR response due to error/sandbox limitation");
                return {
                    qrCode: "00020101021129370016A000000677010111011300660000000005802TH53037646304100.5406100.00",
                    txnId: `MOCK_KBANK_${Date.now()}`,
                    refId: partnerPaymentId
                }
            }
            throw new Error('Failed to generate KBank QR');
        }
    }
}
