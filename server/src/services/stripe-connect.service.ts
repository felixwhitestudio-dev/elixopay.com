import Stripe from 'stripe';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export class StripeConnectService {
    /**
     * Create a Custom connected account for a merchant.
     * Called when merchant clicks "Connect" in dashboard.
     */
    static async createConnectedAccount(userId: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError('User not found', 404);
        if (user.stripeAccountId) throw new AppError('Stripe account already connected', 400);

        // Create Custom connected account (Elixopay controls everything)
        const account = await stripe.accounts.create({
            type: 'custom',
            country: 'TH', // Thailand
            email: user.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
            settings: {
                payouts: {
                    schedule: { interval: 'manual' }, // Elixopay controls payouts
                },
            },
            metadata: {
                elixopay_user_id: String(userId),
                elixopay_merchant_id: user.merchantId,
            },
        });

        // Save to DB
        await prisma.user.update({
            where: { id: userId },
            data: {
                stripeAccountId: account.id,
                stripeAccountStatus: 'onboarding',
            },
        });

        logger.info(`[StripeConnect] Created account ${account.id} for user ${userId}`);
        return account;
    }

    /**
     * Create an Account Link for the merchant to complete onboarding.
     * This is Stripe's hosted onboarding UI for Custom accounts.
     */
    static async createOnboardingLink(userId: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.stripeAccountId) throw new AppError('No Stripe account found', 404);

        const baseUrl = process.env.APP_URL || 'http://localhost:8080';

        const accountLink = await stripe.accountLinks.create({
            account: user.stripeAccountId,
            refresh_url: `${baseUrl}/dashboard.html#settings/stripe?refresh=true`,
            return_url: `${baseUrl}/dashboard.html#settings/stripe?onboarding=complete`,
            type: 'account_onboarding',
        });

        logger.info(`[StripeConnect] Created onboarding link for user ${userId}`);
        return accountLink;
    }

    /**
     * Get the current status of a merchant's Stripe account.
     */
    static async getAccountStatus(userId: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError('User not found', 404);

        if (!user.stripeAccountId) {
            return {
                connected: false,
                status: 'none',
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false,
            };
        }

        // Fetch latest from Stripe
        try {
            const account = await stripe.accounts.retrieve(user.stripeAccountId);

            // Sync to our DB
            const status = account.charges_enabled ? 'enabled' :
                          account.details_submitted ? 'restricted' : 'onboarding';

            await prisma.user.update({
                where: { id: userId },
                data: {
                    stripeAccountStatus: status,
                    stripeDetailsSubmitted: account.details_submitted || false,
                    stripePayoutsEnabled: account.payouts_enabled || false,
                    stripeChargesEnabled: account.charges_enabled || false,
                },
            });

            return {
                connected: true,
                accountId: account.id,
                status,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirements: account.requirements,
            };
        } catch (err: any) {
            logger.error(`[StripeConnect] Failed to retrieve account for user ${userId}:`, err.message);
            return {
                connected: true,
                accountId: user.stripeAccountId,
                status: user.stripeAccountStatus || 'unknown',
                chargesEnabled: user.stripeChargesEnabled,
                payoutsEnabled: user.stripePayoutsEnabled,
                detailsSubmitted: user.stripeDetailsSubmitted,
                error: 'Could not fetch latest status from Stripe',
            };
        }
    }

    /**
     * Handle account.updated webhook from Stripe
     */
    static async handleAccountUpdate(account: any) {
        const userId = account.metadata?.elixopay_user_id;
        if (!userId) {
            logger.warn(`[StripeConnect] account.updated for ${account.id} but no elixopay_user_id in metadata`);
            return;
        }

        const status = account.charges_enabled ? 'enabled' :
                      account.details_submitted ? 'restricted' : 'onboarding';

        await prisma.user.update({
            where: { id: Number(userId) },
            data: {
                stripeAccountStatus: status,
                stripeDetailsSubmitted: account.details_submitted || false,
                stripePayoutsEnabled: account.payouts_enabled || false,
                stripeChargesEnabled: account.charges_enabled || false,
                stripeConnectedAt: account.charges_enabled ? new Date() : undefined,
            },
        });

        logger.info(`[StripeConnect] Updated account ${account.id} → status: ${status}`);
    }

    /**
     * Create a payout/transfer to a merchant's connected account.
     * Elixopay controls when to pay merchants.
     */
    static async createTransferToMerchant(userId: number, amount: number, description?: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.stripeAccountId) throw new AppError('Merchant has no Stripe account', 400);
        if (!user.stripeChargesEnabled) throw new AppError('Merchant Stripe account is not fully enabled', 400);

        // Create transfer from platform to connected account
        const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100), // Stripe expects smallest currency unit (satang)
            currency: 'thb',
            destination: user.stripeAccountId,
            description: description || `Elixopay payout to merchant ${user.merchantId}`,
            metadata: {
                elixopay_user_id: String(userId),
                elixopay_merchant_id: user.merchantId,
            },
        });

        // Record in our DB
        const payout = await prisma.stripePayout.create({
            data: {
                userId,
                stripeTransferId: transfer.id,
                amount,
                currency: 'THB',
                status: 'pending',
                method: 'stripe_transfer',
                description: description || 'Platform payout',
            },
        });

        logger.info(`[StripeConnect] Transfer ${transfer.id} created: ฿${amount} → ${user.stripeAccountId}`);
        return { transfer, payout };
    }

    /**
     * Disconnect a merchant's Stripe account
     */
    static async disconnectAccount(userId: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.stripeAccountId) throw new AppError('No Stripe account to disconnect', 400);

        // Delete the connected account on Stripe
        try {
            await stripe.accounts.del(user.stripeAccountId);
        } catch (err: any) {
            logger.warn(`[StripeConnect] Could not delete Stripe account ${user.stripeAccountId}: ${err.message}`);
        }

        // Clear from our DB
        await prisma.user.update({
            where: { id: userId },
            data: {
                stripeAccountId: null,
                stripeAccountStatus: 'none',
                stripeDetailsSubmitted: false,
                stripePayoutsEnabled: false,
                stripeChargesEnabled: false,
                stripeConnectedAt: null,
            },
        });

        logger.info(`[StripeConnect] Disconnected Stripe account for user ${userId}`);
        return true;
    }

    /**
     * Get payout history for a merchant
     */
    static async getPayoutHistory(userId: number) {
        return prisma.stripePayout.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
}
