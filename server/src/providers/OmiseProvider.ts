import {
    PaymentProvider,
    PaymentMethod,
    ChargeParams,
    ChargeResult,
    ChargeStatusResult,
    RefundResult,
} from './PaymentProvider';
import logger from '../utils/logger';

/**
 * Omise (Opn Payments) Provider
 * 
 * Supports credit/debit card payments via Omise Tokenization.
 * Card data never touches our server — Omise.js creates the token client-side.
 * 
 * Flow:
 * 1. Frontend uses Omise.js to tokenize card → gets `token`
 * 2. Frontend sends `token` to our API
 * 3. We call Omise API with `token` to create a charge
 * 4. If 3D Secure required → redirect customer to authorize_uri
 */
export class OmiseProvider implements PaymentProvider {
    readonly name = 'omise';
    readonly supportedMethods: PaymentMethod[] = ['card'];

    private get secretKey(): string {
        return process.env.OMISE_SECRET_KEY || '';
    }

    private get publicKey(): string {
        return process.env.OMISE_PUBLIC_KEY || '';
    }

    private get baseUrl(): string {
        return 'https://api.omise.co';
    }

    async createCharge(params: ChargeParams): Promise<ChargeResult> {
        logger.info(`[OmiseProvider] Creating card charge: ฿${params.amount}`);

        if (!params.token) {
            throw new Error('Card token is required for Omise payments. Use Omise.js to tokenize on client-side.');
        }

        if (!this.secretKey) {
            // In development/test, return mock response
            if (process.env.NODE_ENV !== 'production') {
                logger.warn('[OmiseProvider] No OMISE_SECRET_KEY set — returning mock charge');
                return this.mockCharge(params);
            }
            throw new Error('OMISE_SECRET_KEY is not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/charges`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: Math.round(params.amount * 100), // Omise uses satang (smallest unit)
                    currency: params.currency.toLowerCase(),
                    card: params.token,
                    description: params.description || 'Payment',
                    return_uri: params.returnUrl,
                    metadata: params.metadata || {},
                }),
            });

            const data = await response.json() as any;

            if (data.object === 'error') {
                throw new Error(data.message || 'Omise charge failed');
            }

            return {
                providerChargeId: data.id,
                status: data.status === 'successful' ? 'completed' : 'pending',
                authorizeUri: data.authorize_uri,
                redirectUrl: data.authorize_uri, // For 3D Secure
                rawResponse: data,
            };
        } catch (error: any) {
            logger.error('[OmiseProvider] createCharge failed:', error.message);
            throw new Error(`Omise charge failed: ${error.message}`);
        }
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        logger.info(`[OmiseProvider] getChargeStatus: ${providerChargeId}`);

        if (!this.secretKey) {
            return {
                providerChargeId,
                status: 'pending',
                amount: 0,
                rawResponse: { message: 'Mock status — OMISE_SECRET_KEY not set' },
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/charges/${providerChargeId}`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
                },
            });

            const data = await response.json() as any;

            let status: ChargeStatusResult['status'] = 'pending';
            if (data.status === 'successful') status = 'completed';
            else if (data.status === 'failed') status = 'failed';
            else if (data.status === 'expired') status = 'expired';

            return {
                providerChargeId: data.id,
                status,
                amount: data.amount / 100, // Convert from satang back to baht
                paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
                rawResponse: data,
            };
        } catch (error: any) {
            logger.error('[OmiseProvider] getChargeStatus failed:', error.message);
            throw new Error(`Omise status check failed: ${error.message}`);
        }
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        logger.info(`[OmiseProvider] Refund ฿${amount} for charge: ${providerChargeId}`);

        if (!this.secretKey) {
            return {
                providerRefundId: `MOCK-RFND-${Date.now()}`,
                status: 'completed',
                amount,
                rawResponse: { message: 'Mock refund — OMISE_SECRET_KEY not set' },
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/charges/${providerChargeId}/refunds`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: Math.round(amount * 100), // satang
                }),
            });

            const data = await response.json() as any;

            if (data.object === 'error') {
                throw new Error(data.message || 'Omise refund failed');
            }

            return {
                providerRefundId: data.id,
                status: data.voided ? 'completed' : 'pending',
                amount: data.amount / 100,
                rawResponse: data,
            };
        } catch (error: any) {
            logger.error('[OmiseProvider] refund failed:', error.message);
            throw new Error(`Omise refund failed: ${error.message}`);
        }
    }

    private mockCharge(params: ChargeParams): ChargeResult {
        const mockId = `chrg_mock_${Date.now()}`;
        return {
            providerChargeId: mockId,
            status: 'pending',
            authorizeUri: `https://pay.omise.co/mock/${mockId}`,
            redirectUrl: `https://pay.omise.co/mock/${mockId}`,
            rawResponse: {
                id: mockId,
                object: 'charge',
                amount: params.amount * 100,
                currency: params.currency,
                status: 'pending',
                mock: true,
            },
        };
    }
}
