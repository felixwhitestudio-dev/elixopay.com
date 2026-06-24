import Stripe from 'stripe';
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
 * Extended ChargeParams for Stripe Connect destination charges.
 * When stripeAccountId is provided, funds go to platform first,
 * then Elixopay transfers to the connected merchant account.
 */
export interface StripeChargeParams extends ChargeParams {
    stripeAccountId?: string;
}

/**
 * Stripe Connect Provider (Custom Accounts)
 *
 * Implements Destination Charges:
 *   Customer pays → Platform receives → Platform transfers to Connected Account
 *
 * Key design decisions:
 * - Destination charges: money lands on Platform first (Elixopay controls everything)
 * - Platform fee calculated from STRIPE_PLATFORM_FEE_PERCENT env var
 * - Platform-controlled payouts (Stripe auto-payout disabled on connected accounts)
 * - Merchants never see Stripe directly — Elixopay is the interface
 *
 * Flow:
 * 1. Frontend creates PaymentIntent via Elixopay API
 * 2. We create a Stripe PaymentIntent with transfer_data.destination
 * 3. Frontend confirms with Stripe.js (card Element or PromptPay)
 * 4. On success, Stripe auto-transfers (minus platform fee) to connected account
 */
export class StripeConnectProvider implements PaymentProvider {
    readonly name = 'stripe';
    readonly supportedMethods: PaymentMethod[] = ['card', 'bank_transfer'];

    private stripeClient: InstanceType<typeof Stripe> | null = null;

    private get secretKey(): string {
        return process.env.STRIPE_SECRET_KEY || '';
    }

    private getStripeClient(): InstanceType<typeof Stripe> | null {
        if (!this.secretKey) {
            return null;
        }
        if (!this.stripeClient) {
            this.stripeClient = new Stripe(this.secretKey);
        }
        return this.stripeClient;
    }

    /**
     * Calculate platform fee in smallest currency unit (satang for THB, cents for USD).
     * Reads STRIPE_PLATFORM_FEE_PERCENT from env, defaults to 2.5%.
     */
    private calculatePlatformFee(amount: number): number {
        const feePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '2.5');
        return Math.round(amount * 100 * (feePercent / 100));
    }

    async createCharge(params: StripeChargeParams): Promise<ChargeResult> {
        const stripeAccountId = params.stripeAccountId;

        logger.info(`[StripeProvider] Creating charge: ฿${params.amount} (${params.method})${stripeAccountId ? ` → destination: ${stripeAccountId}` : ' → direct platform charge'}`);

        const client = this.getStripeClient();

        if (!client) {
            // No API key — return mock response (matches OmiseProvider pattern)
            if (process.env.NODE_ENV !== 'production') {
                logger.warn('[StripeProvider] No STRIPE_SECRET_KEY set — returning mock charge');
                return this.mockCharge(params);
            }
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }

        try {
            const paymentMethodTypes = params.method === 'card' ? ['card'] : ['promptpay'];

            const intentParams: Record<string, any> = {
                amount: Math.round(params.amount * 100), // Convert to smallest unit
                currency: params.currency.toLowerCase(),
                description: params.description || 'Elixopay Payment',
                metadata: {
                    orderId: params.orderId || '',
                    ...(params.metadata || {}),
                },
                payment_method_types: paymentMethodTypes,
            };

            // Destination charge: money goes to platform, then transferred to connected account
            if (stripeAccountId) {
                intentParams.transfer_data = {
                    destination: stripeAccountId,
                };
                intentParams.application_fee_amount = this.calculatePlatformFee(params.amount);
            }

            const paymentIntent = await client.paymentIntents.create(intentParams as any);

            logger.info(`[StripeProvider] PaymentIntent created: ${paymentIntent.id} (status: ${paymentIntent.status})`);

            return {
                providerChargeId: paymentIntent.id,
                status: this.mapStripeStatus(paymentIntent.status),
                redirectUrl: (paymentIntent as any).next_action?.redirect_to_url?.url,
                rawResponse: {
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id,
                    status: paymentIntent.status,
                },
            };
        } catch (error: any) {
            logger.error('[StripeProvider] createCharge failed:', error.message);
            throw new Error(`Stripe charge failed: ${error.message}`);
        }
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        logger.info(`[StripeProvider] getChargeStatus: ${providerChargeId}`);

        const client = this.getStripeClient();

        if (!client) {
            return {
                providerChargeId,
                status: 'pending',
                amount: 0,
                rawResponse: { message: 'Mock status — STRIPE_SECRET_KEY not set' },
            };
        }

        try {
            const paymentIntent = await client.paymentIntents.retrieve(providerChargeId);

            return {
                providerChargeId: paymentIntent.id,
                status: this.mapStripeStatus(paymentIntent.status),
                amount: paymentIntent.amount / 100, // Convert back from smallest unit
                paidAt: paymentIntent.status === 'succeeded'
                    ? new Date((paymentIntent.created) * 1000)
                    : undefined,
                rawResponse: paymentIntent,
            };
        } catch (error: any) {
            logger.error('[StripeProvider] getChargeStatus failed:', error.message);
            throw new Error(`Stripe status check failed: ${error.message}`);
        }
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        logger.info(`[StripeProvider] Refund ฿${amount} for PaymentIntent: ${providerChargeId}`);

        const client = this.getStripeClient();

        if (!client) {
            return {
                providerRefundId: `MOCK-RFND-${Date.now()}`,
                status: 'completed',
                amount,
                rawResponse: { message: 'Mock refund — STRIPE_SECRET_KEY not set' },
            };
        }

        try {
            const refund = await client.refunds.create({
                payment_intent: providerChargeId,
                amount: Math.round(amount * 100), // smallest unit
            });

            return {
                providerRefundId: refund.id,
                status: refund.status === 'succeeded' ? 'completed' : 'pending',
                amount: (refund.amount ?? 0) / 100,
                rawResponse: refund,
            };
        } catch (error: any) {
            logger.error('[StripeProvider] refund failed:', error.message);
            throw new Error(`Stripe refund failed: ${error.message}`);
        }
    }

    /**
     * Map Stripe PaymentIntent status to our ChargeStatus
     */
    private mapStripeStatus(stripeStatus: string): ChargeResult['status'] {
        switch (stripeStatus) {
            case 'succeeded':
                return 'completed';
            case 'canceled':
                return 'failed';
            case 'requires_payment_method':
            case 'requires_confirmation':
            case 'requires_action':
            case 'processing':
            default:
                return 'pending';
        }
    }

    /**
     * Mock charge for development/testing when STRIPE_SECRET_KEY is not set
     */
    private mockCharge(params: ChargeParams): ChargeResult {
        const mockId = `pi_mock_${Date.now()}`;
        return {
            providerChargeId: mockId,
            status: 'pending',
            rawResponse: {
                clientSecret: `${mockId}_secret_mock`,
                paymentIntentId: mockId,
                status: 'requires_payment_method',
                mock: true,
                amount: params.amount * 100,
                currency: params.currency,
            },
        };
    }
}
