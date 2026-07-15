import Stripe from 'stripe';
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { StripeConnectService } from '../services/stripe-connect.service';
import { WebhookService } from '../services/webhook.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummyKeyToPreventCrashOnStartup');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/v1/stripe-connect/webhook
 * Handles incoming Stripe webhook events.
 *
 * CRITICAL: This route must receive the raw body (Buffer), NOT parsed JSON.
 * It is mounted with express.raw({ type: 'application/json' }) BEFORE express.json().
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const rawBody = req.body; // Buffer (because of express.raw)

    // 1. Guard: reject empty or non-buffer requests
    if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0 || !sig) {
        logger.warn('[StripeWebhook] Rejected: missing body or signature');
        return res.status(400).json({ error: 'Missing request body or stripe-signature header' });
    }

    // 2. Verify webhook signature
    let event: any;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        logger.error(`[StripeWebhook] ❌ Signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // 3. Deduplicate — check if we've already processed this event
    const existingEvent = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (existingEvent?.processed) {
        logger.info(`[StripeWebhook] Skipping duplicate event ${event.id} (${event.type})`);
        return res.status(200).json({ received: true, duplicate: true });
    }

    // 4. Record the event (mark as not yet processed)
    if (!existingEvent) {
        await prisma.stripeEvent.create({
            data: {
                id: event.id,
                type: event.type,
                processed: false,
                data: JSON.stringify(event.data),
            },
        });
    }

    // 5. Route event to the appropriate handler
    try {
        const eventType = event.type as string;
        switch (eventType) {
            case 'account.updated':
                await handleAccountUpdated(event);
                break;

            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event);
                break;

            case 'transfer.paid':
                await handleTransferPaid(event);
                break;

            default:
                logger.info(`[StripeWebhook] Unhandled event type: ${event.type}`);
        }

        // 6. Mark event as processed
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: { processed: true },
        });
    } catch (err: any) {
        logger.error(`[StripeWebhook] Error processing ${event.type} (${event.id}): ${err.message}`);
        // Still return 200 so Stripe doesn't retry — we've recorded the event for manual replay
    }

    return res.status(200).json({ received: true });
};

// ─── Event Handlers ────────────────────────────────────────────────────────────

/**
 * checkout.session.completed — A Checkout Session (card payment) was successful.
 * Update the transaction to COMPLETED, credit the merchant wallet, and dispatch webhook.
 * Crucially, we update providerChargeId to the underlying PaymentIntent ID so that refunds work later.
 */
async function handleCheckoutSessionCompleted(event: any) {
    const session = event.data.object;
    logger.info(`[StripeWebhook] checkout.session.completed: ${session.id}`);

    const transaction = await prisma.transaction.findFirst({
        where: { providerChargeId: session.id },
    });

    if (!transaction) {
        logger.warn(`[StripeWebhook] No transaction found for Checkout Session ${session.id}`);
        return;
    }

    if (transaction.status === 'COMPLETED') {
        logger.info(`[StripeWebhook] Transaction ${transaction.id} already COMPLETED, skipping`);
        return;
    }

    // Determine if test mode and extract currency from metadata
    let isTestMode = false;
    let currency = 'THB';
    try {
        if (transaction.metadata) {
            const meta = JSON.parse(transaction.metadata);
            isTestMode = meta.mode === 'test';
            if (meta.currency) {
                currency = meta.currency;
            }
        }
    } catch (e) { /* ignore parse errors */ }

    // Convert amount to THB for the wallet balance
    let walletIncrementAmount = Number(transaction.amount);
    if (currency.toLowerCase() === 'usd') {
        walletIncrementAmount = walletIncrementAmount * 34.5;
    }

    // Update transaction + credit wallet atomically
    await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
            where: { id: transaction.id },
            data: { 
                status: 'COMPLETED',
                // Map the providerChargeId to the payment_intent so refunds work!
                providerChargeId: (session.payment_intent as string) || session.id
            },
        });

        const updateData = isTestMode
            ? { testBalance: { increment: walletIncrementAmount } }
            : { balance: { increment: walletIncrementAmount } };

        await tx.wallet.update({
            where: { userId: transaction.userId },
            data: updateData,
        });
    });

    // Dispatch webhook to merchant
    WebhookService.dispatchEvent(transaction.userId, 'payment.success', {
        id: transaction.id,
        amount: transaction.amount,
        status: 'COMPLETED',
        reference: transaction.reference,
        provider: 'stripe',
        providerChargeId: (session.payment_intent as string) || session.id,
        completedAt: new Date().toISOString(),
    }).catch(err => logger.error('[StripeWebhook] Dispatch failed for payment.success:', err));
}

/**
 * account.updated — Stripe notifies us when a connected account's status changes
 * (e.g., onboarding complete, charges enabled, requirements due).
 */
async function handleAccountUpdated(event: any) {
    const account = event.data.object;
    logger.info(`[StripeWebhook] account.updated: ${account.id}`);
    await StripeConnectService.handleAccountUpdate(account);
}

/**
 * payment_intent.succeeded — A payment through the platform was successful.
 * Update the transaction to COMPLETED, credit the merchant wallet, and dispatch webhook.
 */
async function handlePaymentIntentSucceeded(event: any) {
    const paymentIntent = event.data.object;
    logger.info(`[StripeWebhook] payment_intent.succeeded: ${paymentIntent.id}`);

    const transaction = await prisma.transaction.findFirst({
        where: { providerChargeId: paymentIntent.id },
    });

    if (!transaction) {
        logger.warn(`[StripeWebhook] No transaction found for PaymentIntent ${paymentIntent.id}`);
        return;
    }

    if (transaction.status === 'COMPLETED') {
        logger.info(`[StripeWebhook] Transaction ${transaction.id} already COMPLETED, skipping`);
        return;
    }

    // Determine if test mode and extract currency from metadata
    let isTestMode = false;
    let currency = 'THB';
    try {
        if (transaction.metadata) {
            const meta = JSON.parse(transaction.metadata);
            isTestMode = meta.mode === 'test';
            if (meta.currency) {
                currency = meta.currency;
            }
        }
    } catch (e) { /* ignore parse errors */ }

    // Convert amount to THB for the wallet balance
    let walletIncrementAmount = Number(transaction.amount);
    if (currency.toLowerCase() === 'usd') {
        walletIncrementAmount = walletIncrementAmount * 34.5;
    }

    // Update transaction + credit wallet atomically
    await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' },
        });

        const updateData = isTestMode
            ? { testBalance: { increment: walletIncrementAmount } }
            : { balance: { increment: walletIncrementAmount } };

        await tx.wallet.update({
            where: { userId: transaction.userId },
            data: updateData,
        });
    });

    // Dispatch webhook to merchant
    WebhookService.dispatchEvent(transaction.userId, 'payment.success', {
        id: transaction.id,
        amount: transaction.amount,
        status: 'COMPLETED',
        reference: transaction.reference,
        provider: 'stripe',
        providerChargeId: paymentIntent.id,
        completedAt: new Date().toISOString(),
    }).catch(err => logger.error('[StripeWebhook] Dispatch failed for payment.success:', err));
}

/**
 * payment_intent.payment_failed — A payment attempt failed.
 * Update transaction to FAILED and dispatch webhook.
 */
async function handlePaymentIntentFailed(event: any) {
    const paymentIntent = event.data.object;
    logger.info(`[StripeWebhook] payment_intent.payment_failed: ${paymentIntent.id}`);

    const transaction = await prisma.transaction.findFirst({
        where: { providerChargeId: paymentIntent.id },
    });

    if (!transaction) {
        logger.warn(`[StripeWebhook] No transaction found for failed PaymentIntent ${paymentIntent.id}`);
        return;
    }

    await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
    });

    // Dispatch webhook to merchant
    WebhookService.dispatchEvent(transaction.userId, 'payment.failed', {
        id: transaction.id,
        amount: transaction.amount,
        status: 'FAILED',
        reference: transaction.reference,
        provider: 'stripe',
        providerChargeId: paymentIntent.id,
        failureMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
        failedAt: new Date().toISOString(),
    }).catch(err => logger.error('[StripeWebhook] Dispatch failed for payment.failed:', err));
}

/**
 * charge.refunded — A charge was refunded (fully or partially).
 * Find the transaction, update refunded amount, and dispatch webhook.
 */
async function handleChargeRefunded(event: any) {
    const charge = event.data.object;
    logger.info(`[StripeWebhook] charge.refunded: ${charge.id}`);

    // Try to find by charge ID or payment intent
    const providerChargeId = charge.payment_intent || charge.id;
    const transaction = await prisma.transaction.findFirst({
        where: { providerChargeId },
    });

    if (!transaction) {
        logger.warn(`[StripeWebhook] No transaction found for refunded charge ${charge.id}`);
        return;
    }

    // Calculate total refunded (Stripe amounts are in smallest currency unit)
    const refundedAmount = (charge.amount_refunded || 0) / 100;

    await prisma.transaction.update({
        where: { id: transaction.id },
        data: { refundedAmount },
    });

    // Dispatch webhook to merchant
    WebhookService.dispatchEvent(transaction.userId, 'payment.refunded', {
        id: transaction.id,
        amount: transaction.amount,
        refundedAmount,
        status: charge.refunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        reference: transaction.reference,
        provider: 'stripe',
        refundedAt: new Date().toISOString(),
    }).catch(err => logger.error('[StripeWebhook] Dispatch failed for payment.refunded:', err));
}

/**
 * transfer.paid — A transfer to a connected account was paid.
 * Update StripePayout status to 'paid'.
 */
async function handleTransferPaid(event: any) {
    const transfer = event.data.object;
    logger.info(`[StripeWebhook] transfer.paid: ${transfer.id}`);

    const payout = await prisma.stripePayout.findUnique({
        where: { stripeTransferId: transfer.id },
    });

    if (!payout) {
        logger.warn(`[StripeWebhook] No StripePayout found for transfer ${transfer.id}`);
        return;
    }

    await prisma.stripePayout.update({
        where: { id: payout.id },
        data: { status: 'paid' },
    });

    logger.info(`[StripeWebhook] StripePayout ${payout.id} marked as paid`);
}
