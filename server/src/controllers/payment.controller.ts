import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import prisma from '../utils/prisma';

export const getPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const payments = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
    });

    res.status(200).json({ success: true, data: { payments } });
});

export const getPaymentStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    // Simple mockup of stats needed for the dashboard
    const completedTxns = await prisma.transaction.count({
        where: { userId, status: 'COMPLETED' }
    });

    const totalTxns = await prisma.transaction.count({
        where: { userId }
    });

    const successRate = totalTxns > 0 ? ((completedTxns / totalTxns) * 100).toFixed(1) : '0.0';

    // Sum of revenue
    const revenueObj = await prisma.transaction.aggregate({
        where: { userId, status: 'COMPLETED', type: 'DEPOSIT' },
        _sum: { amount: true }
    });
    const totalRevenue = revenueObj._sum.amount || 0;

    // We can return mocked chart data or actual array of daily sums
    // For simplicity matching the frontend array expectations:
    res.status(200).json({
        success: true,
        data: {
            stats: {
                total_transactions: totalTxns,
                success_rate: successRate,
                total_revenue: totalRevenue
            },
            chart: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                data: [0, 0, 0, 0, 0, 0, totalRevenue] // Simplified
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
        // A. Verify Merchant Wallet has enough balance to cover the refund
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new AppError('Wallet not found', 404);

        if (Number(wallet.balance) < requestRefundAmount) {
            throw new AppError('Insufficient wallet balance to process refund', 400, 'insufficient_balance');
        }

        // B. Deduct Merchant Wallet
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
