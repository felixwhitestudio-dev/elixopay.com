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
 * Mock Payment Provider
 * 
 * Used for test mode API keys — simulates all payment methods
 * without calling any real gateway. Perfect for merchant integration testing.
 */
export class MockProvider implements PaymentProvider {
    readonly name = 'mock';
    readonly supportedMethods: PaymentMethod[] = ['qr', 'card', 'bank_transfer', 'wallet'];

    /** In-memory store for mock charges */
    private charges = new Map<string, { status: string; amount: number; method: PaymentMethod }>();

    async createCharge(params: ChargeParams): Promise<ChargeResult> {
        const chargeId = `mock_chrg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        logger.info(`[MockProvider] Creating mock charge: ${chargeId} — ฿${params.amount} via ${params.method}`);

        this.charges.set(chargeId, {
            status: 'pending',
            amount: params.amount,
            method: params.method,
        });

        const result: ChargeResult = {
            providerChargeId: chargeId,
            status: 'pending',
            rawResponse: {
                mock: true,
                message: 'This is a test mode charge. Use POST /checkout/:id/mock-pay to simulate completion.',
            },
        };

        // Add method-specific mock data
        if (params.method === 'qr') {
            result.qrCode = `00020101021129370016A000000677010111011300660000000005802TH530376463041${params.amount.toFixed(2)}`;
        } else if (params.method === 'card') {
            result.redirectUrl = `http://localhost:8080/checkout.html?ref=${chargeId}&mock=true`;
            result.authorizeUri = result.redirectUrl;
        }

        return result;
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        logger.info(`[MockProvider] getChargeStatus: ${providerChargeId}`);

        const charge = this.charges.get(providerChargeId);

        return {
            providerChargeId,
            status: (charge?.status as any) || 'pending',
            amount: charge?.amount || 0,
            rawResponse: { mock: true },
        };
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        logger.info(`[MockProvider] Mock refund ฿${amount} for: ${providerChargeId}`);

        return {
            providerRefundId: `mock_rfnd_${Date.now()}`,
            status: 'completed',
            amount,
            rawResponse: { mock: true, message: 'Mock refund processed instantly' },
        };
    }

    /**
     * Helper to simulate a payment completion (used by mock-pay endpoint)
     */
    completeCharge(providerChargeId: string): void {
        const charge = this.charges.get(providerChargeId);
        if (charge) {
            charge.status = 'completed';
        }
    }
}
