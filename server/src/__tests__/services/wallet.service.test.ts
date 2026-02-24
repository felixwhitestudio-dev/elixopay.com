/**
 * Wallet Service Tests
 * Uses mocked Prisma client to test business logic without database
 */

// Mock the prisma module before importing anything
jest.mock('../../utils/prisma', () => {
    const mockTransaction = jest.fn();
    const mockWallet = {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };
    const mockTransactionModel = {
        create: jest.fn(),
        findMany: jest.fn(),
    };
    const mockSystemSetting = {
        findUnique: jest.fn(),
    };

    return {
        __esModule: true,
        default: {
            wallet: mockWallet,
            transaction: mockTransactionModel,
            systemSetting: mockSystemSetting,
            $transaction: mockTransaction,
        },
    };
});

import prisma from '../../utils/prisma';
import * as walletService from '../../services/wallet.service';

// Type helpers for mocks
const mockPrisma = prisma as any;

describe('Wallet Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ getWalletByUserId ============
    describe('getWalletByUserId', () => {
        it('should return wallet for valid user', async () => {
            const mockWallet = { id: 1, userId: 1, balance: 100.0, currency: 'THB' };
            mockPrisma.wallet.findUnique.mockResolvedValue(mockWallet);

            const result = await walletService.getWalletByUserId(1);

            expect(result).toEqual(mockWallet);
            expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
                where: { userId: 1 },
            });
        });

        it('should return null for non-existent user', async () => {
            mockPrisma.wallet.findUnique.mockResolvedValue(null);

            const result = await walletService.getWalletByUserId(999);
            expect(result).toBeNull();
        });
    });

    // ============ createWallet ============
    describe('createWallet', () => {
        it('should create a wallet with zero balance', async () => {
            const mockCreated = { id: 1, userId: 5, balance: 0.0, currency: 'THB' };
            mockPrisma.wallet.create.mockResolvedValue(mockCreated);

            const result = await walletService.createWallet(5);

            expect(result).toEqual(mockCreated);
            expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 5,
                    balance: 0.0,
                    currency: 'THB',
                }),
            });
        });
    });

    // ============ deposit ============
    describe('deposit', () => {
        it('should create a DEPOSIT transaction and increment balance', async () => {
            const mockTx = { id: 10, userId: 1, amount: 500, type: 'DEPOSIT', status: 'COMPLETED' };
            const mockUpdatedWallet = { id: 1, userId: 1, balance: 600 };

            // $transaction receives a callback — we execute it with mock tx context
            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    transaction: { create: jest.fn().mockResolvedValue(mockTx) },
                    wallet: { update: jest.fn().mockResolvedValue(mockUpdatedWallet) },
                };
                return cb(txContext);
            });

            const result = await walletService.deposit(1, 500, 'test-ref');

            expect(result.transaction).toEqual(mockTx);
            expect(result.wallet).toEqual(mockUpdatedWallet);
        });
    });

    // ============ withdraw ============
    describe('withdraw', () => {
        it('should create a PENDING withdrawal with fee deduction', async () => {
            const mockTx = { id: 20, userId: 1, amount: -1000, type: 'WITHDRAW', status: 'PENDING' };
            const mockFeeSettng = { key: 'withdrawal_fee_thb', value: '30' };
            const mockWallet = { id: 1, userId: 1, balance: 2000 };
            const mockUpdatedWallet = { id: 1, userId: 1, balance: 970 };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    systemSetting: { findUnique: jest.fn().mockResolvedValue(mockFeeSettng) },
                    wallet: {
                        findUnique: jest.fn().mockResolvedValue(mockWallet),
                        update: jest.fn().mockResolvedValue(mockUpdatedWallet),
                    },
                    transaction: { create: jest.fn().mockResolvedValue(mockTx) },
                };
                return cb(txContext);
            });

            const result = await walletService.withdraw(1, 1000, 'KBANK-1234567890');

            expect(result.transaction).toEqual(mockTx);
            expect(result.wallet).toEqual(mockUpdatedWallet);
            expect(result.fee).toBe(30);
        });

        it('should throw error for insufficient funds', async () => {
            const mockWallet = { id: 1, userId: 1, balance: 50 }; // Only 50 THB

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    systemSetting: { findUnique: jest.fn().mockResolvedValue({ key: 'withdrawal_fee_thb', value: '30' }) },
                    wallet: { findUnique: jest.fn().mockResolvedValue(mockWallet) },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(walletService.withdraw(1, 100, 'KBANK-123')).rejects.toThrow('Insufficient funds');
        });
    });

    // ============ transfer ============
    describe('transfer', () => {
        it('should transfer between two users', async () => {
            const mockSenderWallet = { id: 1, userId: 1, balance: 5000 };
            const mockRecipientUser = {
                id: 2, email: 'recipient@test.com',
                wallet: { id: 2, userId: 2, balance: 100 },
            };
            const mockSenderTx = { id: 30, type: 'TRANSFER_OUT', amount: -200 };
            const mockRecipientTx = { id: 31, type: 'TRANSFER_IN', amount: 200 };
            const mockUpdatedSenderWallet = { id: 1, userId: 1, balance: 4800 };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: {
                        findUnique: jest.fn()
                            .mockResolvedValueOnce(mockSenderWallet)  // sender check
                            .mockResolvedValue(null),
                        update: jest.fn().mockResolvedValue(mockUpdatedSenderWallet),
                    },
                    user: {
                        findUnique: jest.fn().mockResolvedValue(mockRecipientUser),
                    },
                    transaction: {
                        create: jest.fn()
                            .mockResolvedValueOnce(mockSenderTx)
                            .mockResolvedValueOnce(mockRecipientTx),
                    },
                };
                return cb(txContext);
            });

            const result = await walletService.transfer(1, 'recipient@test.com', 200);

            expect(result.senderTx.type).toBe('TRANSFER_OUT');
            expect(result.senderTx.amount).toBe(-200);
        });

        it('should throw error when transferring to self', async () => {
            const mockSenderWallet = { id: 1, userId: 1, balance: 5000 };
            const mockSelfUser = {
                id: 1, email: 'self@test.com',
                wallet: { id: 1, userId: 1, balance: 5000 },
            };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: {
                        findUnique: jest.fn().mockResolvedValue(mockSenderWallet),
                    },
                    user: {
                        findUnique: jest.fn().mockResolvedValue(mockSelfUser),
                    },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(walletService.transfer(1, 'self@test.com', 100)).rejects.toThrow('Cannot transfer to yourself');
        });

        it('should throw error for insufficient funds', async () => {
            const mockSenderWallet = { id: 1, userId: 1, balance: 10 }; // Only 10 THB

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: { findUnique: jest.fn().mockResolvedValue(mockSenderWallet) },
                    user: { findUnique: jest.fn() },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(walletService.transfer(1, 'someone@test.com', 100)).rejects.toThrow('Insufficient funds');
        });
    });

    // ============ getTransactions ============
    describe('getTransactions', () => {
        it('should return transactions for a user', async () => {
            const mockTxs = [
                { id: 1, type: 'DEPOSIT', amount: 100 },
                { id: 2, type: 'WITHDRAW', amount: -50 },
            ];
            mockPrisma.transaction.findMany.mockResolvedValue(mockTxs);

            const result = await walletService.getTransactions(1);

            expect(result).toEqual(mockTxs);
            expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
        });

        it('should respect the limit parameter', async () => {
            mockPrisma.transaction.findMany.mockResolvedValue([]);

            await walletService.getTransactions(1, 5);

            expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 5 })
            );
        });
    });
});
