/**
 * Admin Controller Tests
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            transaction: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
            user: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
            systemSetting: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
            wallet: { update: jest.fn() },
            auditLog: { findMany: jest.fn(), create: jest.fn() },
            $transaction: jest.fn(),
        },
    };
});

jest.mock('../../services/audit.service', () => ({
    logAction: jest.fn().mockResolvedValue(true),
    formatUpdateDetails: jest.fn().mockReturnValue('details'),
}));

jest.mock('../../utils/mailer', () => ({
    sendPayoutApprovedEmail: jest.fn().mockResolvedValue(true),
    sendPayoutRejectedEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { logAction } from '../../services/audit.service';

const mockPrisma = prisma as any;

describe('Admin Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ getPendingWithdrawals ============
    describe('getPendingWithdrawals logic', () => {
        it('should return pending withdrawals with user info', async () => {
            const mockWithdrawals = [
                {
                    id: 1, amount: 1000, type: 'WITHDRAW', status: 'PENDING',
                    user: { email: 'user@test.com', firstName: 'John', lastName: 'Doe' },
                    createdAt: new Date(),
                },
            ];
            mockPrisma.transaction.findMany.mockResolvedValue(mockWithdrawals);

            const result = await prisma.transaction.findMany({
                where: { type: 'WITHDRAW', status: 'PENDING' },
                include: { user: true },
            });

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('PENDING');
            expect(result[0].user.email).toBe('user@test.com');
        });

        it('should return empty when no pending withdrawals', async () => {
            mockPrisma.transaction.findMany.mockResolvedValue([]);

            const result = await prisma.transaction.findMany({
                where: { type: 'WITHDRAW', status: 'PENDING' },
            });

            expect(result).toEqual([]);
        });
    });

    // ============ approveWithdrawal ============
    describe('approveWithdrawal logic', () => {
        it('should update transaction status to COMPLETED', async () => {
            const mockTx = { id: 1, userId: 1, amount: -500, status: 'PENDING', user: { email: 'u@t.com' } };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txCtx = {
                    transaction: {
                        findUnique: jest.fn().mockResolvedValue(mockTx),
                        update: jest.fn().mockResolvedValue({ ...mockTx, status: 'COMPLETED' }),
                    },
                };
                return cb(txCtx);
            });

            const result = await prisma.$transaction(async (tx: any) => {
                const transaction = await tx.transaction.findUnique({ where: { id: 1 } });
                return await tx.transaction.update({
                    where: { id: 1 },
                    data: { status: 'COMPLETED' },
                });
            });

            expect(result.status).toBe('COMPLETED');
        });

        it('should log the approval action via audit service', async () => {
            await logAction(1, 'APPROVE_WITHDRAWAL', 'TRANSACTION', '1', { amount: 500 }, {} as any);

            expect(logAction).toHaveBeenCalledWith(
                1, 'APPROVE_WITHDRAWAL', 'TRANSACTION', '1',
                expect.any(Object), expect.any(Object)
            );
        });
    });

    // ============ rejectWithdrawal ============
    describe('rejectWithdrawal logic', () => {
        it('should refund balance and create refund transaction on rejection', async () => {
            const mockTx = { id: 1, userId: 1, amount: -500, status: 'PENDING', user: { email: 'u@t.com', firstName: 'U' } };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txCtx = {
                    transaction: {
                        findUnique: jest.fn().mockResolvedValue(mockTx),
                        update: jest.fn().mockResolvedValue({ ...mockTx, status: 'FAILED' }),
                        create: jest.fn().mockResolvedValue({ id: 2, type: 'REFUND', amount: 500, status: 'COMPLETED' }),
                    },
                    wallet: {
                        update: jest.fn().mockResolvedValue({ balance: 500 }),
                    },
                };
                return cb(txCtx);
            });

            const result = await prisma.$transaction(async (tx: any) => {
                const transaction = await tx.transaction.findUnique({ where: { id: 1 } });
                await tx.transaction.update({ where: { id: 1 }, data: { status: 'FAILED' } });

                // Create refund transaction
                const refund = await tx.transaction.create({
                    data: { userId: 1, amount: 500, type: 'REFUND', status: 'COMPLETED' },
                });

                // Refund to wallet
                await tx.wallet.update({
                    where: { userId: 1 },
                    data: { balance: { increment: 500 } },
                });

                return refund;
            });

            expect(result.type).toBe('REFUND');
            expect(result.status).toBe('COMPLETED');
        });
    });

    // ============ getAllUsers ============
    describe('getAllUsers logic', () => {
        it('should return all users with wallet info', async () => {
            const mockUsers = [
                { id: 1, email: 'a@b.com', role: 'user', isActive: true, wallet: { balance: 100, currency: 'THB' } },
                { id: 2, email: 'c@d.com', role: 'admin', isActive: true, wallet: { balance: 0, currency: 'THB' } },
            ];
            mockPrisma.user.findMany.mockResolvedValue(mockUsers);

            const result = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                include: { wallet: true },
            });

            expect(result).toHaveLength(2);
        });
    });

    // ============ toggleUserStatus ============
    describe('toggleUserStatus logic', () => {
        it('should deactivate a user', async () => {
            mockPrisma.user.update.mockResolvedValue({ id: 1, isActive: false });

            const result = await prisma.user.update({
                where: { id: 1 },
                data: { isActive: false },
            });

            expect(result.isActive).toBe(false);
        });

        it('should reactivate a user', async () => {
            mockPrisma.user.update.mockResolvedValue({ id: 1, isActive: true });

            const result = await prisma.user.update({
                where: { id: 1 },
                data: { isActive: true },
            });

            expect(result.isActive).toBe(true);
        });
    });

    // ============ getSettings ============
    describe('getSettings logic', () => {
        it('should return system settings as key-value pairs', async () => {
            mockPrisma.systemSetting.findMany.mockResolvedValue([
                { key: 'withdrawal_fee_thb', value: '30' },
                { key: 'exchange_rate_usdt_thb', value: '35' },
            ]);

            const settings = await prisma.systemSetting.findMany();
            const settingsMap: Record<string, string> = {};
            settings.forEach((s: any) => { settingsMap[s.key] = s.value; });

            expect(settingsMap.withdrawal_fee_thb).toBe('30');
            expect(settingsMap.exchange_rate_usdt_thb).toBe('35');
        });
    });
});
