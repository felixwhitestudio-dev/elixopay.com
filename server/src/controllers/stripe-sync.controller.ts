import Stripe from 'stripe';
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { WebhookService } from '../services/webhook.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * POST /api/v1/admin/sync-pending-payments
 * Admin-only endpoint to sync PENDING Stripe transactions with actual Stripe status.
 * This fixes transactions that were missed because checkout.session.completed
 * was not subscribed on the Elixopay webhook endpoint.
 */
export const syncPendingPayments = async (req: Request, res: Response) => {
    try {
        // Find all PENDING transactions with Stripe provider
        const pendingTxns = await prisma.transaction.findMany({
            where: {
                status: 'PENDING',
                provider: 'stripe',
                providerChargeId: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: 50  // Safety limit
        });

        logger.info(`[SyncPending] Found ${pendingTxns.length} pending Stripe transactions`);

        const results: any[] = [];

        for (const tx of pendingTxns) {
            const chargeId = tx.providerChargeId;
            if (!chargeId) continue;

            try {
                let isPaid = false;
                let paymentIntentId: string | null = null;

                // Check if it's a Checkout Session ID (cs_*) or PaymentIntent ID (pi_*)
                if (chargeId.startsWith('cs_')) {
                    const session = await stripe.checkout.sessions.retrieve(chargeId);
                    isPaid = session.payment_status === 'paid';
                    paymentIntentId = session.payment_intent as string;
                } else if (chargeId.startsWith('pi_')) {
                    const pi = await stripe.paymentIntents.retrieve(chargeId);
                    isPaid = pi.status === 'succeeded';
                    paymentIntentId = pi.id;
                }

                if (isPaid) {
                    // Determine if test mode and extract currency from metadata
                    let isTestMode = false;
                    let currency = 'THB';
                    try {
                        if (tx.metadata) {
                            const meta = JSON.parse(tx.metadata);
                            isTestMode = meta.mode === 'test';
                            if (meta.currency) {
                                currency = meta.currency;
                            }
                        }
                    } catch (e) { /* ignore */ }

                    // Convert amount to THB for the wallet balance
                    let walletIncrementAmount = Number(tx.amount);
                    if (currency.toLowerCase() === 'usd') {
                        walletIncrementAmount = walletIncrementAmount * 34.5;
                    }

                    // Update transaction and wallet atomically
                    await prisma.$transaction(async (txn) => {
                        await txn.transaction.update({
                            where: { id: tx.id },
                            data: {
                                status: 'COMPLETED',
                                providerChargeId: paymentIntentId || chargeId
                            }
                        });

                        const updateData = isTestMode
                            ? { testBalance: { increment: walletIncrementAmount } }
                            : { balance: { increment: walletIncrementAmount } };

                        await txn.wallet.update({
                            where: { userId: tx.userId },
                            data: updateData
                        });
                    });

                    // Dispatch webhook to merchant
                    WebhookService.dispatchEvent(tx.userId, 'payment.success', {
                        id: tx.id,
                        amount: tx.amount,
                        status: 'COMPLETED',
                        reference: tx.reference,
                        provider: 'stripe',
                        providerChargeId: paymentIntentId || chargeId,
                        completedAt: new Date().toISOString(),
                    }).catch(err => logger.error('[SyncPending] Dispatch failed:', err));

                    results.push({
                        id: tx.id,
                        amount: Number(tx.amount),
                        oldStatus: 'PENDING',
                        newStatus: 'COMPLETED',
                        synced: true
                    });

                    logger.info(`[SyncPending] ✅ Updated transaction ${tx.id} (฿${tx.amount}) → COMPLETED`);
                } else {
                    results.push({
                        id: tx.id,
                        amount: Number(tx.amount),
                        oldStatus: 'PENDING',
                        newStatus: 'PENDING',
                        synced: false,
                        reason: 'Not paid on Stripe'
                    });
                }
            } catch (err: any) {
                logger.error(`[SyncPending] Error checking tx ${tx.id}: ${err.message}`);
                results.push({
                    id: tx.id,
                    amount: Number(tx.amount),
                    synced: false,
                    error: err.message
                });
            }
        }

        const syncedCount = results.filter(r => r.synced).length;
        logger.info(`[SyncPending] Done. Synced ${syncedCount}/${pendingTxns.length} transactions.`);

        res.status(200).json({
            success: true,
            message: `Synced ${syncedCount} of ${pendingTxns.length} pending transactions`,
            data: { results }
        });
    } catch (err: any) {
        logger.error('[SyncPending] Fatal error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
