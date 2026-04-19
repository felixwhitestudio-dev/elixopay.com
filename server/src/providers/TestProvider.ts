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
 * Test Payment Provider
 * 
 * Used for test mode API keys (ep_test_xxx) — simulates all payment methods
 * without calling any real gateway. This is a standard feature for merchants
 * to test their integration before going live, similar to Stripe's test mode.
 * 
 * Usage:
 *   - Merchant uses ep_test_xxx API key → routes to TestProvider
 *   - Merchant uses ep_live_xxx API key → routes to real provider (KBank, BBL, etc.)
 */
export class TestProvider implements PaymentProvider {
    readonly name = 'test';
    readonly supportedMethods: PaymentMethod[] = ['qr', 'card', 'bank_transfer', 'wallet'];

    /** In-memory store for test charges */
    private charges = new Map<string, { status: string; amount: number; method: PaymentMethod }>();

    async createCharge(params: ChargeParams): Promise<ChargeResult> {
        const chargeId = `test_chrg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        logger.info(`[TestProvider] Creating test charge: ${chargeId} — ฿${params.amount} via ${params.method}`);

        this.charges.set(chargeId, {
            status: 'pending',
            amount: params.amount,
            method: params.method,
        });

        const result: ChargeResult = {
            providerChargeId: chargeId,
            status: 'pending',
            rawResponse: {
                test: true,
                message: 'This is a test mode charge. Use POST /checkout/:id/simulate-pay to simulate payment completion.',
            },
        };

        // Add method-specific test data
        if (params.method === 'qr') {
            result.qrCode = `00020101021129370016A000000677010111011300660000000005802TH530376463041${params.amount.toFixed(2)}`;
        } else if (params.method === 'card') {
            const baseUrl = process.env.APP_URL || 'https://app.elixopay.com';
            result.redirectUrl = `${baseUrl}/checkout.html?ref=${chargeId}&test=true`;
            result.authorizeUri = result.redirectUrl;
        }

        return result;
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        logger.info(`[TestProvider] getChargeStatus: ${providerChargeId}`);

        const charge = this.charges.get(providerChargeId);

        return {
            providerChargeId,
            status: (charge?.status as any) || 'pending',
            amount: charge?.amount || 0,
            rawResponse: { test: true },
        };
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        logger.info(`[TestProvider] Test refund ฿${amount} for: ${providerChargeId}`);

        return {
            providerRefundId: `test_rfnd_${Date.now()}`,
            status: 'completed',
            amount,
            rawResponse: { test: true, message: 'Test refund processed instantly' },
        };
    }

    /**
     * Helper to simulate a payment completion (used by simulate-pay endpoint)
     */
    completeCharge(providerChargeId: string): void {
        const charge = this.charges.get(providerChargeId);
        if (charge) {
            charge.status = 'completed';
        }
    }
}
