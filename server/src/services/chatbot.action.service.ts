import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { LINEService } from './line.service';

export class ChatbotActionService {
    /**
     * Finds a transaction by its reference ID or Order ID (providerChargeId)
     * This is the tool that the AI will use to answer customer inquiries.
     */
    static async getPaymentStatus(reference: string) {
        logger.info(`[ChatbotAction] Searching for transaction with reference: ${reference}`);

        // Search by internal reference, providerChargeId, or idempotencyKey
        const transaction = await prisma.transaction.findFirst({
            where: {
                OR: [
                    { reference: reference },
                    { providerChargeId: reference },
                    { idempotencyKey: reference }
                ]
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        if (!transaction) {
            logger.warn(`[ChatbotAction] No transaction found for reference: ${reference}`);
            return {
                success: false,
                message: "ไม่พบข้อมูลการชำระเงินที่ระบุ กรุณาตรวจสอบรหัสอ้างอิงอีกครั้งค่ะ"
            };
        }

        // Return a sanitized version of the transaction to the AI
        return {
            success: true,
            data: {
                id: transaction.id,
                amount: transaction.amount,
                currency: 'THB',
                status: transaction.status, // PENDING, COMPLETED, FAILED
                type: transaction.type,
                method: transaction.paymentMethod || 'N/A',
                createdAt: transaction.createdAt,
                merchantName: `${transaction.user.firstName || ''} ${transaction.user.lastName || ''}`.trim() || transaction.user.email
            }
        };
    }

    /**
     * Check wallet balance for a merchant by email or merchantId
     */
    static async getWalletBalance(identifier: string) {
        logger.info(`[ChatbotAction] Checking wallet balance for: ${identifier}`);

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { merchantId: identifier }
                ]
            },
            include: {
                wallet: true
            }
        });

        if (!user || !user.wallet) {
            return {
                success: false,
                message: "ไม่พบบัญชีที่ระบุค่ะ กรุณาตรวจสอบอีเมลหรือรหัสร้านค้าอีกครั้งนะคะ"
            };
        }

        return {
            success: true,
            data: {
                merchantName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                merchantId: user.merchantId,
                balance: user.wallet.balance,
                currency: user.wallet.currency,
                kycStatus: user.kycStatus,
                lastUpdated: user.wallet.updatedAt
            }
        };
    }

    /**
     * Get recent transactions for a merchant by email or merchantId
     */
    static async getRecentTransactions(identifier: string, limit: number = 5) {
        logger.info(`[ChatbotAction] Getting recent ${limit} transactions for: ${identifier}`);

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { merchantId: identifier }
                ]
            }
        });

        if (!user) {
            return {
                success: false,
                message: "ไม่พบบัญชีที่ระบุค่ะ กรุณาตรวจสอบอีเมลหรือรหัสร้านค้าอีกครั้งนะคะ"
            };
        }

        const transactions = await prisma.transaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 10), // Cap at 10 to prevent excessive data
            select: {
                id: true,
                amount: true,
                type: true,
                status: true,
                paymentMethod: true,
                reference: true,
                createdAt: true
            }
        });

        if (transactions.length === 0) {
            return {
                success: true,
                message: "ยังไม่มีรายการในระบบค่ะ",
                data: []
            };
        }

        return {
            success: true,
            data: transactions.map(t => ({
                id: t.id,
                amount: t.amount,
                type: t.type,
                status: t.status,
                method: t.paymentMethod || 'N/A',
                reference: t.reference || '-',
                date: t.createdAt
            }))
        };
    }

    /**
     * Escalate conversation to a human admin via LINE push message
     */
    static async escalateToHuman(userId: string, reason: string, conversationSummary: string) {
        const adminLineUserId = process.env.LINE_ADMIN_USER_ID;

        if (!adminLineUserId) {
            logger.warn(`[ChatbotAction] LINE_ADMIN_USER_ID not configured. Cannot escalate.`);
            return {
                success: false,
                message: "ระบบแจ้งเตือนแอดมินยังไม่พร้อมค่ะ กรุณาติดต่อ support@elixopay.com นะคะ"
            };
        }

        logger.info(`[ChatbotAction] 🚨 Escalating to admin. Reason: ${reason}`);

        const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        // Notify admin via LINE push message
        const adminMessage = 
`🚨 แจ้งเตือน: ลูกค้าต้องการความช่วยเหลือ

📋 สาเหตุ: ${reason}
👤 LINE User ID: ${userId}
🕐 เวลา: ${timestamp}

💬 สรุปการสนทนา:
${conversationSummary}

👉 กรุณาติดต่อกลับลูกค้าโดยเร็วค่ะ`;

        await LINEService.pushMessage(adminLineUserId, adminMessage);

        return {
            success: true,
            message: "ส่งแจ้งเตือนถึงเจ้าหน้าที่เรียบร้อยแล้วค่ะ เจ้าหน้าที่จะติดต่อกลับโดยเร็วนะคะ"
        };
    }
}
