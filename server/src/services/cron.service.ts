import logger from '../utils/logger';
import cron from 'node-cron';
import prisma from '../utils/prisma';
import { KBankService } from '../services/kbank.service';

/**
 * Sweeps the database every day at Midnight (00:00) 
 * to find Subscriptions that need to generate a new Invoice.
 */
export const initCronJobs = () => {
    // Run at 00:00 every day: '0 0 * * *'
    // For testing/demo purposes, you could change this to '* * * * *' (every minute)
    cron.schedule('0 0 * * *', async () => {
        logger.info('[CRON] Sweeping for due subscriptions...');

        try {
            const now = new Date();

            // Find all active subscriptions where the current billing period has ended
            const dueSubscriptions = await prisma.subscription.findMany({
                where: {
                    status: 'active',
                    currentPeriodEnd: {
                        lte: now
                    },
                    // If cancelAtPeriodEnd is true, their status will be set to canceled instead
                },
                include: {
                    price: true,
                    customer: true
                }
            });

            if (dueSubscriptions.length === 0) {
                logger.info('[CRON] No due subscriptions found today.');
                return;
            }

            logger.info(`[CRON] Found ${dueSubscriptions.length} subscriptions due for billing. Processing...`);

            // Process each due subscription
            for (const sub of dueSubscriptions) {

                // 1. Check if they asked to cancel at period end
                if (sub.cancelAtPeriodEnd) {
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { status: 'canceled' }
                    });
                    logger.info(`[CRON] Subscription ${sub.id} canceled as requested.`);
                    continue; // Skip billing
                }

                // 2. Generate a Transaction (The physical payment request with QR code)
                // We mock the generation first to create the transaction ledger
                const amountDue = sub.price.amount;

                const transaction = await prisma.transaction.create({
                    data: {
                        userId: sub.customer.merchantId, // Money goes to the Merchant
                        amount: amountDue,
                        type: 'DEPOSIT',
                        status: 'PENDING',
                        reference: `SUB-${sub.id}-${Date.now()}`,
                        metadata: JSON.stringify({
                            description: `Subscription Invoice - Customer: ${sub.customer.name}`,
                            subscriptionId: sub.id
                        })
                    }
                });

                // 3. Generate the Invoice linking to the Transaction
                const invoice = await prisma.invoice.create({
                    data: {
                        subscriptionId: sub.id,
                        customerId: sub.customerId,
                        transactionId: transaction.id,
                        amountDue: amountDue,
                        status: 'open',
                        dueDate: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)) // Due in 7 days
                    }
                });

                // 4. Update the Subscription's billing period forward
                const nextPeriodEnd = new Date(sub.currentPeriodEnd);
                if (sub.price.interval === 'month') {
                    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + sub.price.intervalCount);
                } else if (sub.price.interval === 'year') {
                    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + sub.price.intervalCount);
                } else if (sub.price.interval === 'week') {
                    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + (7 * sub.price.intervalCount));
                }

                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        currentPeriodStart: sub.currentPeriodEnd,
                        currentPeriodEnd: nextPeriodEnd
                    }
                });

                // 5. Fire Webhook/Email to Merchant to tell them to send the QR.
                // In a production app, we would emit an event like 'invoice.created'
                // For now, log the action.
                logger.info(`[CRON] Invoice ${invoice.id} generated for Subscription ${sub.id}. Trans ID: ${transaction.id}`);
            }

        } catch (error) {
            logger.error('[CRON ERROR] Failed to process subscription sweep:', error);
        }
    });

    logger.info('[CRON] Subscription Billing sweep scheduled successfully.');
};
