import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { orchestrator } from '../services/orchestrator.service';
import { PaymentMethod } from '../providers/PaymentProvider';

export const createPaymentLink = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError('Invalid amount', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return next(new AppError('User not found', 404));
    }

    const method: PaymentMethod = 'qr';
    const referenceId = `LINK-${Date.now()}`;

    let chargeResult;
    try {
        chargeResult = await orchestrator.createCharge(
            {
                amount,
                currency: 'THB',
                method,
                description: description || 'Payment Link',
                orderId: referenceId,
                metadata: { isPaymentLink: true },
                stripeAccountId: user.stripeAccountId || undefined,
            },
            {
                isTestMode: false,
            }
        );
    } catch (err: any) {
        logger.error('[PaymentLink] Orchestrator charge failed:', err.message);
        return next(new AppError(`Payment creation failed: ${err.message}`, 502));
    }

    const transaction = await prisma.transaction.create({
        data: {
            userId: user.id,
            amount: amount,
            type: 'PAYMENT_LINK',
            status: chargeResult.result.status === 'completed' ? 'COMPLETED' : 'PENDING',
            reference: referenceId,
            provider: chargeResult.provider,
            providerChargeId: chargeResult.result.providerChargeId,
            paymentMethod: method,
            metadata: JSON.stringify({
                description: description || 'Payment Link',
                mode: 'live',
                clientSecret: chargeResult.result.rawResponse?.clientSecret,
                qrCodeBase64: chargeResult.result.qrCode,
                stripeAccountId: user.stripeAccountId || undefined
            }),
        }
    });

    const checkoutUrl = `${process.env.CHECKOUT_URL || 'http://localhost:3000'}/pay.html?ref=${transaction.id}`;

    res.status(201).json({
        success: true,
        data: {
            id: transaction.id,
            amount,
            checkoutUrl,
            reference: referenceId,
            description: description || 'Payment Link'
        }
    });
});

export const getPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const sort = req.query.sort as string || 'createdAt';
    const order = req.query.order as string || 'desc';

    const where: any = { userId };
    if (status) {
        where.status = status.toUpperCase();
    }

    const orderBy: any = {};
    if (sort === 'created_at') orderBy['createdAt'] = order.toLowerCase() === 'asc' ? 'asc' : 'desc';
    else if (sort === 'amount') orderBy['amount'] = order.toLowerCase() === 'asc' ? 'asc' : 'desc';
    else if (sort === 'status') orderBy['status'] = order.toLowerCase() === 'asc' ? 'asc' : 'desc';
    else orderBy['createdAt'] = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [payments, total] = await Promise.all([
        prisma.transaction.findMany({
            where,
            orderBy,
            take: limit,
            skip: offset
        }),
        prisma.transaction.count({ where })
    ]);

    res.status(200).json({ 
        success: true, 
        data: { 
            payments,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        } 
    });
});

export const getPaymentStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    const completedTxns = await prisma.transaction.count({
        where: { userId, status: 'COMPLETED' }
    });

    const pendingTxns = await prisma.transaction.count({
        where: { userId, status: 'PENDING' }
    });

    const totalTxns = await prisma.transaction.count({
        where: { userId }
    });

    const successRate = totalTxns > 0 ? ((completedTxns / totalTxns) * 100).toFixed(1) : '0.0';

    // Sum of all completed revenue
    const revenueObj = await prisma.transaction.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true }
    });
    const totalRevenue = Number(revenueObj._sum.amount || 0);

    // Sum of all transaction amounts (regardless of status)
    const totalAmountObj = await prisma.transaction.aggregate({
        where: { userId },
        _sum: { amount: true }
    });
    const totalAmount = Number(totalAmountObj._sum.amount || 0);

    // Return both naming conventions so dashboard.html AND transactions.html both work
    res.status(200).json({
        success: true,
        data: {
            stats: {
                // For transactions.html
                totalPayments: totalTxns,
                completedPayments: completedTxns,
                pendingPayments: pendingTxns,
                totalAmount: totalAmount,
                // For dashboard.html
                total_transactions: totalTxns,
                success_rate: successRate,
                total_revenue: totalRevenue
            },
            chart: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                data: [0, 0, 0, 0, 0, 0, totalRevenue]
            }
        }
    });
});

export const refundPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { id } = req.params;
    const { amount } = req.body;

    // Parse the transaction ID (backend uses Int for ids)
    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
        return next(new AppError('Invalid transaction ID', 400));
    }

    // 1. Find original transaction
    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
    });

    if (!transaction) return next(new AppError('Transaction not found', 404));
    if (transaction.userId !== userId) return next(new AppError('Forbidden: This transaction belongs to another merchant', 403));
    if (transaction.type !== 'DEPOSIT' && transaction.type !== 'PAYMENT') return next(new AppError('Can only refund direct deposits/payments', 400));
    if (transaction.status !== 'COMPLETED') return next(new AppError('Can only refund completed transactions', 400));

    // 2. Validate refund amount
    const requestRefundAmount = amount ? Number(amount) : Number(transaction.amount);
    if (!requestRefundAmount || requestRefundAmount <= 0) return next(new AppError('Invalid refund amount', 400));

    const maxRefundable = Number(transaction.amount) - Number(transaction.refundedAmount);
    if (maxRefundable <= 0) {
        return next(new AppError('Transaction has already been fully refunded', 400, 'fully_refunded'));
    }
    if (requestRefundAmount > maxRefundable) {
        return next(new AppError(`Refund amount exceeds remaining captured amount. Maximum refundable: ฿${maxRefundable}`, 400, 'amount_exceeds_capture'));
    }

    // 3. Process the refund within a safe transaction
    await prisma.$transaction(async (tx) => {
        // A. Verify Merchant Account has enough balance to cover the refund
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new AppError('Merchant account not found', 404);

        if (Number(wallet.balance) < requestRefundAmount) {
            throw new AppError('Insufficient merchant account balance to process refund', 400, 'insufficient_balance');
        }

        // B. Deduct from Merchant Account
        await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: requestRefundAmount } }
        });

        // C. Track the refund on the parent transaction
        await tx.transaction.update({
            where: { id: transactionId },
            data: { refundedAmount: { increment: requestRefundAmount } }
        });

        // D. Create the explicit REFUND ledger entry
        await tx.transaction.create({
            data: {
                userId,
                amount: requestRefundAmount,
                type: 'REFUND',
                status: 'COMPLETED',
                parentId: transactionId,
                reference: `RFD-TXN-${transactionId}-${Date.now()}`,
                metadata: JSON.stringify({ reason: 'Refund initiated via Dashboard' })
            }
        });
    });

    res.status(200).json({
        success: true,
        message: `Refund of ฿${requestRefundAmount} processed successfully.`
    });
});

// ── CSV Export ────────────────────────────────────────
export const exportPaymentsCSV = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { from, to, status, type } = req.query;

    const where: any = { userId };
    if (status) where.status = status as string;
    if (type) where.type = type as string;
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) where.createdAt.lte = new Date(to as string);
    }

    const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5000,
    });

    // Build CSV
    const header = 'ID,Reference,Type,Status,Amount(THB),Payment Method,Provider,Created At\n';
    const rows = transactions.map(t => {
        const date = t.createdAt.toISOString().replace('T', ' ').substring(0, 19);
        return `${t.id},"${t.reference || ''}",${t.type},${t.status},${t.amount},${t.paymentMethod || 'N/A'},${t.provider || 'N/A'},"${date}"`;
    }).join('\n');

    const csv = '\uFEFF' + header + rows; // BOM for Excel
    const filename = `elixopay_transactions_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
});
