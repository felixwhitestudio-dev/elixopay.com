import { Request, Response, NextFunction } from 'express';
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import prisma from '../utils/prisma';
import { logAction, formatUpdateDetails } from "../services/audit.service"; // Import service

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

    await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
            where: { id: Number(id) }
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
    });

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

    await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
            where: { id: Number(id) }
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
        // Note: transaction.amount is negative for withdrawals, so we subtract it (double negative = positive) 
        // OR we just use Math.abs. Let's look at wallet service:
        // withdraw service: amount: -amount.
        // So transaction.amount is e.g. -500.
        // To refund, we need to add 500 back.
        // balance increment: -(-500) = +500.
        // But safer to just use Math.abs() to be sure.

        await tx.wallet.update({
            where: { userId: transaction.userId },
            data: {
                balance: {
                    increment: Math.abs(Number(transaction.amount))
                }
            }
        });

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
    });

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
    console.log('updateSettings called');
    console.log('Prisma keys:', Object.keys(prisma));
    const updates = req.body;
    console.log('Updates:', updates);

    // Fetch old settings for logging
    const oldSettings = await prisma.systemSetting.findMany({
        where: { key: { in: Object.keys(updates) } }
    });
    console.log('Old settings fetched');
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
    console.log('Settings upserted');

    // Log Action
    // @ts-ignore
    console.log('Logging action for user:', req.user?.id);
    // @ts-ignore
    await logAction(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', undefined, formatUpdateDetails(oldSettingsMap, updates), req);
    console.log('Action logged');

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
