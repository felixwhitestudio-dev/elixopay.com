import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import prisma from '../utils/prisma';
import { logAction, formatUpdateDetails } from "../services/audit.service"; // Import service
import { sendPayoutApprovedEmail, sendPayoutRejectedEmail } from '../utils/mailer';

export const getPendingWithdrawals = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const withdrawals = await prisma.transaction.findMany({
        where: {
            type: 'WITHDRAW',
            status: 'PENDING'
        },
        include: {
            user: {
                select: {
                    email: true,
                    firstName: true,
                    lastName: true
                }
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    res.status(200).json({
        success: true,
        data: {
            withdrawals: withdrawals.map(w => ({
                id: w.id,
                amount: Math.abs(Number(w.amount)), // Send as positive for display
                currency: 'THB', // Default for now
                created_at: w.createdAt,
                reference: w.reference,
                metadata: w.metadata ? JSON.parse(w.metadata) : {},
                user: {
                    email: w.user.email,
                    name: `${w.user.firstName || ''} ${w.user.lastName || ''}`.trim()
                }
            }))
        }
    });
});

export const approveWithdrawal = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    let transactionRecord: any = null;

    await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
            where: { id: Number(id) },
            include: { user: true }
        });

        if (!transaction) {
            throw new AppError('Transaction not found', 404);
        }

        if (transaction.status !== 'PENDING') {
            throw new AppError('Transaction is not pending', 400);
        }

        // Just update status to COMPLETED
        await tx.transaction.update({
            where: { id: Number(id) },
            data: { status: 'COMPLETED' }
        });
        transactionRecord = transaction;
    });

    // Send Email Notification
    if (transactionRecord && transactionRecord.user?.email) {
        sendPayoutApprovedEmail(
            transactionRecord.user.email,
            transactionRecord.user.firstName || 'User',
            Number(transactionRecord.amount)
        ).catch(err => logger.error('[Mailer] Failed to send payout approval email', err));
    }

    // Log Action
    // @ts-ignore
    await logAction(req.user.id, 'APPROVE_WITHDRAWAL', 'TRANSACTION', id, { amount: 'unknown' }, req);

    res.status(200).json({
        success: true,
        message: 'Withdrawal approved successfully'
    });
});

export const rejectWithdrawal = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { reason } = req.body;

    let transactionRecord: any = null;

    await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
            where: { id: Number(id) },
            include: { user: true }
        });

        if (!transaction) {
            throw new AppError('Transaction not found', 404);
        }

        if (transaction.status !== 'PENDING') {
            throw new AppError('Transaction is not pending', 400);
        }

        // 1. Update status to FAILED
        await tx.transaction.update({
            where: { id: Number(id) },
            data: {
                status: 'FAILED',
                metadata: JSON.stringify({
                    ...JSON.parse(transaction.metadata || '{}'),
                    rejection_reason: reason
                })
            }
        });

        // 2. Refund money to user wallet

        // Optional: Create a refund transaction record? 
        // Usually good practice, but for simplicity we rely on the FAILED status of the original tx to explain why money didn't leave?
        // Actually, if we just increment balance, we might have a discrepancy if we sum transactions vs balance.
        // It's better to create a "REFUND" transaction or just mark this one FAILED and reverse the balance.
        // If we only mark this FAILED, a sum of COMPLETED transactions won't include this -500. 
        // But the balance was already deducted.
        // So we need to either: 
        // A) Create a +500 "REFUND" transaction (COMPLETED).
        // B) Just increment balance physically.

        // Let's go with A for better audit trail.
        await tx.transaction.create({
            data: {
                userId: transaction.userId,
                amount: Math.abs(Number(transaction.amount)),
                type: 'REFUND',
                status: 'COMPLETED',
                reference: `REFUND: ${transaction.id}`,
                metadata: JSON.stringify({ original_tx_id: transaction.id, reason })
            }
        });

        await tx.wallet.update({
            where: { userId: transaction.userId },
            data: {
                balance: {
                    increment: Math.abs(Number(transaction.amount))
                }
            }
        });
        transactionRecord = transaction;
    });

    // Send Email Notification
    if (transactionRecord && transactionRecord.user?.email) {
        sendPayoutRejectedEmail(
            transactionRecord.user.email,
            transactionRecord.user.firstName || 'User',
            Number(transactionRecord.amount),
            reason
        ).catch(err => logger.error('[Mailer] Failed to send payout rejection email', err));
    }

    // Log Action
    // @ts-ignore
    await logAction(req.user.id, 'REJECT_WITHDRAWAL', 'TRANSACTION', id, { reason }, req);

    res.status(200).json({
        success: true,
        message: 'Withdrawal rejected and refunded'
    });
});

export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            wallet: {
                select: {
                    balance: true,
                    currency: true
                }
            }
        }
    });

    res.status(200).json({
        success: true,
        data: {
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                role: u.role,
                isActive: u.isActive,
                joinedAt: u.createdAt,
                balance: u.wallet?.balance || 0,
                currency: u.wallet?.currency || 'THB'
            }))
        }
    });
});

export const toggleUserStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { isActive } = req.body; // Expect boolean

    const user = await prisma.user.update({
        where: { id: Number(id) },
        data: { isActive: isActive }
    });

    res.status(200).json({
        success: true,
        message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
        data: { user }
    });
});

export const getSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const settings = await prisma.systemSetting.findMany();

    // Transform array to object for easier frontend consumption
    const settingsMap = settings.reduce((acc: Record<string, string>, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    res.status(200).json({
        success: true,
        data: settingsMap
    });
});

export const updateSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const updates = req.body;

    // Fetch old settings for logging
    const oldSettings = await prisma.systemSetting.findMany({
        where: { key: { in: Object.keys(updates) } }
    });
    const oldSettingsMap = oldSettings.reduce((acc: any, curr) => ({ ...acc, [curr.key]: curr.value }), {});

    const results = [];
    for (const [key, value] of Object.entries(updates)) {
        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        });
        results.push(setting);
    }

    // Log Action
    // @ts-ignore
    await logAction(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', undefined, formatUpdateDetails(oldSettingsMap, updates), req);

    res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: results
    });
});

export const getAllTransactions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const transactions = await prisma.transaction.findMany({
        include: {
            user: {
                select: {
                    email: true,
                    firstName: true,
                    lastName: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 100 // Limit to last 100 for now to prevent overload
    });

    const formattedTransactions = transactions.map(tx => ({
        id: tx.id,
        user: tx.user ? `${tx.user.firstName} ${tx.user.lastName} (${tx.user.email})` : 'Unknown',
        amount: tx.amount,
        type: tx.type,
        status: tx.status,
        reference: tx.reference,
        createdAt: tx.createdAt
    }));

    res.status(200).json({
        success: true,
        data: formattedTransactions
    });
});

export const getAuditLogs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const logs = await prisma.auditLog.findMany({
        include: {
            user: {
                select: { email: true, firstName: true, lastName: true }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    res.status(200).json({
        success: true,
        data: logs.map(log => ({
            ...log,
            user: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''} (${log.user.email})`.trim() : 'Unknown'
        }))
    });
});

export const getStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const usdtSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_thb_reserve' } });
    const thbSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_thb_balance' } });

    res.status(200).json({
        success: true,
        data: {
            usdt: usdtSetting ? parseFloat(usdtSetting.value) : 0,
            thb: thbSetting ? parseFloat(thbSetting.value) : 0
        }
    });
});

export const getLiquidity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const usdtSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_thb_reserve' } });

    res.status(200).json({
        success: true,
        data: {
            balance: usdtSetting ? parseFloat(usdtSetting.value) : 0
        }
    });
});

export const addLiquidity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { amount, currency } = req.body;
    // @ts-ignore
    const adminUserId = req.user.id;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return next(new AppError('Please provide a valid numeric amount greater than 0.', 400));
    }

    if (currency !== 'THB') {
        return next(new AppError('Currently, only THB liquidity addition is supported via this interface.', 400));
    }

    const numericAmount = Number(amount);

    await prisma.$transaction(async (tx) => {
        // 1. Create a transaction record to log the addition
        await tx.transaction.create({
            data: {
                userId: adminUserId,
                amount: numericAmount,
                type: 'SYSTEM_LIQUIDITY_ADD',
                status: 'COMPLETED',
                reference: 'On-chain deposit via Admin UI',
                metadata: JSON.stringify({ currency })
            }
        });

        // 2. Fetch current settings and increment
        const existingUsdtSetting = await tx.systemSetting.findUnique({ where: { key: 'platform_thb_reserve' } });
        const currentBalance = existingUsdtSetting && !isNaN(parseFloat(existingUsdtSetting.value))
            ? parseFloat(existingUsdtSetting.value)
            : 0;

        const newBalance = currentBalance + numericAmount;

        // 3. Upsert
        await tx.systemSetting.upsert({
            where: { key: 'platform_thb_reserve' },
            update: { value: newBalance.toString() },
            create: { key: 'platform_thb_reserve', value: newBalance.toString(), description: 'Platform liquidity pool for THB' }
        });
    });

    res.status(200).json({
        success: true,
        message: 'Successfully added liquidity.',
    });
});

export const getLiquidityHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const history = await prisma.transaction.findMany({
        where: { type: 'SYSTEM_LIQUIDITY_ADD' },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    res.status(200).json({
        success: true,
        data: {
            transactions: history.map(tx => ({
                id: tx.id,
                created_at: tx.createdAt,
                type: 'deposit', // Mapping SYSTEM_LIQUIDITY_ADD to 'deposit' for UI consistency
                amount: tx.amount,
                currency: tx.metadata ? JSON.parse(tx.metadata).currency || 'THB' : 'THB',
                status: tx.status
            }))
        }
    });
});

export const getDashboardOverview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1. Get total users
    const totalUsers = await prisma.user.count({
        where: { role: 'user' }
    });

    // 2. Get pending KYC requests
    const pendingKyc = await prisma.user.count({
        where: { kycStatus: 'pending' }
    });

    // 3. Get pending bank requests
    const pendingBankRequests = await prisma.bankAccountChangeRequest.count({
        where: { status: 'pending' }
    });

    // 4. Get active platforms balances (THB and THB)
    const usdtSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_thb_reserve' } });
    const thbSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_thb_balance' } });

    // 5. Calculate total withdraw volume (Completed THB withdrawals)
    const completedWithdrawals = await prisma.transaction.aggregate({
        where: { type: 'WITHDRAW', status: 'COMPLETED' },
        _sum: { amount: true }
    });
    const totalWithdrawVolume = completedWithdrawals._sum.amount ? Math.abs(Number(completedWithdrawals._sum.amount)) : 0;

    // 6. Recent users for the chart (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Group by date - raw query or fetch and group in memory since it's SQLite
    const recentUsers = await prisma.user.findMany({
        where: {
            role: 'user',
            createdAt: { gte: sevenDaysAgo }
        },
        select: { createdAt: true }
    });

    const userSignupsByDate = recentUsers.reduce((acc: Record<string, number>, user) => {
        const dateStr = user.createdAt.toISOString().split('T')[0];
        acc[dateStr] = (acc[dateStr] || 0) + 1;
        return acc;
    }, {});

    res.status(200).json({
        success: true,
        data: {
            stats: {
                totalUsers,
                pendingKyc,
                pendingBankRequests,
                platformThbReserve: usdtSetting && !isNaN(parseFloat(usdtSetting.value)) ? parseFloat(usdtSetting.value) : 0,
                platformThbBalance: thbSetting && !isNaN(parseFloat(thbSetting.value)) ? parseFloat(thbSetting.value) : 0,
                totalWithdrawVolume
            },
            chartData: {
                userSignupsByDate
            }
        }
    });
});

