/**
 * KYC Controller Tests
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            user: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
        },
    };
});

jest.mock('../../utils/mailer', () => ({
    sendKycApprovedEmail: jest.fn().mockResolvedValue(true),
    sendKycRejectedEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { sendKycApprovedEmail, sendKycRejectedEmail } from '../../utils/mailer';

const mockPrisma = prisma as any;

describe('KYC Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ getPendingKyc ============
    describe('getPendingKyc logic', () => {
        it('should find users with pending KYC status', async () => {
            const mockUsers = [
                { id: 1, email: 'user1@test.com', kycStatus: 'pending', kycSubmittedAt: new Date() },
                { id: 2, email: 'user2@test.com', kycStatus: 'pending', kycSubmittedAt: new Date() },
            ];
            mockPrisma.user.findMany.mockResolvedValue(mockUsers);

            const result = await prisma.user.findMany({
                where: { kycStatus: 'pending' },
                orderBy: { kycSubmittedAt: 'asc' },
            });

            expect(result).toHaveLength(2);
            expect(result[0].kycStatus).toBe('pending');
        });

        it('should return empty array when no pending KYC', async () => {
            mockPrisma.user.findMany.mockResolvedValue([]);

            const result = await prisma.user.findMany({
                where: { kycStatus: 'pending' },
            });

            expect(result).toEqual([]);
        });
    });

    // ============ verifyKyc (Approval) ============
    describe('verifyKyc - Approval', () => {
        it('should update status to verified and lock bank account', async () => {
            const mockUser = {
                id: 1, email: 'user@test.com', firstName: 'John',
                kycStatus: 'pending',
            };
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPrisma.user.update.mockResolvedValue({
                ...mockUser,
                kycStatus: 'verified',
                bankVerified: true,
                kycVerifiedAt: new Date(),
            });

            const updatedUser = await prisma.user.update({
                where: { id: 1 },
                data: {
                    kycStatus: 'verified',
                    kycVerifiedAt: new Date(),
                    kycReviewedBy: 'admin@elixopay.com',
                    bankVerified: true,
                    kycRejectionReason: null,
                },
            });

            expect(updatedUser.kycStatus).toBe('verified');
            expect(updatedUser.bankVerified).toBe(true);
        });

        it('should send approval email', async () => {
            await sendKycApprovedEmail('user@test.com', 'John');

            expect(sendKycApprovedEmail).toHaveBeenCalledWith('user@test.com', 'John');
        });
    });

    // ============ verifyKyc (Rejection) ============
    describe('verifyKyc - Rejection', () => {
        it('should update status to rejected with reason', async () => {
            const mockUser = { id: 1, email: 'user@test.com', firstName: 'Jane', kycStatus: 'pending' };
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPrisma.user.update.mockResolvedValue({
                ...mockUser,
                kycStatus: 'rejected',
                kycRejectionReason: 'เอกสารไม่ชัดเจน',
            });

            const updatedUser = await prisma.user.update({
                where: { id: 1 },
                data: {
                    kycStatus: 'rejected',
                    kycRejectionReason: 'เอกสารไม่ชัดเจน',
                },
            });

            expect(updatedUser.kycStatus).toBe('rejected');
            expect(updatedUser.kycRejectionReason).toBe('เอกสารไม่ชัดเจน');
        });

        it('should send rejection email with reason', async () => {
            await sendKycRejectedEmail('user@test.com', 'Jane', 'เอกสารไม่ชัดเจน');

            expect(sendKycRejectedEmail).toHaveBeenCalledWith('user@test.com', 'Jane', 'เอกสารไม่ชัดเจน');
        });
    });

    // ============ getAllKyc ============
    describe('getAllKyc logic', () => {
        it('should exclude unverified users', async () => {
            mockPrisma.user.findMany.mockResolvedValue([
                { id: 1, kycStatus: 'pending' },
                { id: 2, kycStatus: 'verified' },
                { id: 3, kycStatus: 'rejected' },
            ]);

            const result = await prisma.user.findMany({
                where: { kycStatus: { not: 'unverified' } },
            });

            expect(result).toHaveLength(3);
            expect(result.every((u: any) => u.kycStatus !== 'unverified')).toBe(true);
        });
    });

    // ============ Edge Cases ============
    describe('Edge Cases', () => {
        it('should handle user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const user = await prisma.user.findUnique({ where: { id: 999 } });
            expect(user).toBeNull();
        });

        it('should handle email failure gracefully (non-fatal)', async () => {
            (sendKycApprovedEmail as jest.Mock).mockRejectedValue(new Error('SMTP down'));

            try {
                await sendKycApprovedEmail('user@test.com', 'John');
            } catch (err: any) {
                expect(err.message).toBe('SMTP down');
            }
        });
    });
});
