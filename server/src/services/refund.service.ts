import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import { sendRefundNotificationEmail } from '../utils/mailer';

/**
 * Refund Service
 * 
 * Handles refund logic: validation, creation, and processing.
 */
export class RefundService {

    /**
     * Create a refund for a transaction.
     * Validates: amount, time window (30 days), and original transaction status.
     */
    static async createRefund(userId: number, transactionId: number, amount: number, reason?: string) {
        // 1. Find the original transaction
        const original = await prisma.transaction.findFirst({
            where: { id: transactionId, userId },
            include: { user: true },
        });

        if (!original) {
            throw new AppError('ไม่พบรายการที่ต้องการคืนเงิน', 404);
        }

        if (original.status !== 'COMPLETED') {
            throw new AppError('สามารถคืนเงินได้เฉพาะรายการที่สำเร็จแล้วเท่านั้น', 400);
        }

        if (original.type !== 'DEPOSIT') {
            throw new AppError('สามารถคืนเงินได้เฉพาะรายการรับชำระเท่านั้น', 400);
        }

        // 2. Check 30-day window
        const daysSince = (Date.now() - original.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) {
            throw new AppError('ไม่สามารถคืนเงินได้ เนื่องจากเกิน 30 วันนับจากวันที่ชำระ', 400);
        }

        // 3. Check refundable amount
        const originalAmount = Number(original.amount);
        const alreadyRefunded = Number(original.refundedAmount);
        const maxRefundable = originalAmount - alreadyRefunded;

        if (amount <= 0) {
            throw new AppError('จำนวนเงินคืนต้องมากกว่า 0', 400);
        }

        if (amount > maxRefundable) {
            throw new AppError(`จำนวนเงินคืนเกินยอดที่คืนได้ (สูงสุด ฿${maxRefundable.toFixed(2)})`, 400);
        }

        // 4. Create refund transaction + update original
        const [refundTx] = await prisma.$transaction([
            prisma.transaction.create({
                data: {
                    userId,
                    amount: -amount, // Negative = refund
                    type: 'REFUND',
                    status: 'COMPLETED',
                    reference: `REFUND-${original.id}-${Date.now()}`,
                    parentId: original.id,
                    provider: original.provider,
                    paymentMethod: original.paymentMethod,
                    metadata: JSON.stringify({
                        reason: reason || 'ร้านค้าขอคืนเงิน',
                        originalTransactionId: original.id,
                        originalAmount: originalAmount,
                    }),
                },
            }),
            prisma.transaction.update({
                where: { id: original.id },
                data: {
                    refundedAmount: alreadyRefunded + amount,
                },
            }),
        ]);

        logger.info(`[RefundService] ✅ Refund created: ฿${amount} for TX#${transactionId} by user#${userId}`);

        // 5. Send email notification (non-fatal)
        try {
            if (original.user?.email) {
                await sendRefundNotificationEmail(
                    original.user.email,
                    original.user.firstName || 'ลูกค้า',
                    amount,
                    original.reference || `TX-${original.id}`
                );
            }
        } catch (emailErr) {
            logger.error('[RefundService] Email notification failed:', emailErr);
        }

        return refundTx;
    }

    /**
     * Get refund details by ID
     */
    static async getRefundById(userId: number, refundId: number) {
        const refund = await prisma.transaction.findFirst({
            where: { id: refundId, userId, type: 'REFUND' },
            include: {
                parent: { select: { id: true, amount: true, reference: true, createdAt: true } },
            },
        });

        if (!refund) {
            throw new AppError('ไม่พบรายการคืนเงินนี้', 404);
        }

        return refund;
    }

    /**
     * List all refunds for a user
     */
    static async listRefunds(userId: number, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [refunds, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { userId, type: 'REFUND' },
                include: {
                    parent: { select: { id: true, amount: true, reference: true, createdAt: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.transaction.count({ where: { userId, type: 'REFUND' } }),
        ]);

        return {
            refunds,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
