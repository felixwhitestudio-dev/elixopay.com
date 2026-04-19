/**
 * Exchange Service Tests
 */

jest.mock('../../utils/prisma', () => {
    const mockWallet = { findUnique: jest.fn(), update: jest.fn() };
    const mockTransaction = { create: jest.fn() };
    const mockSystemSetting = { findUnique: jest.fn() };

    return {
        __esModule: true,
        default: {
            wallet: mockWallet,
            transaction: mockTransaction,
            systemSetting: mockSystemSetting,
            $transaction: jest.fn(),
        },
    };
});

jest.mock('axios');
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import * as exchangeService from '../../services/exchange.service';

const mockPrisma = prisma as any;

describe('Exchange Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ getRate ============
    describe('getRate', () => {
        it('should return manual rate when mode is manual', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            const rate = await exchangeService.getRate();

            expect(rate.buy).toBeCloseTo(35.35, 1);   // 35 * 1.01
            expect(rate.sell).toBeCloseTo(34.65, 1);   // 35 * 0.99
            expect(rate.timestamp).toBeDefined();
        });

        it('should use default rate 34.00 when no setting exists', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce(null);

            const rate = await exchangeService.getRate();

            expect(rate.buy).toBeCloseTo(34.34, 1);   // 34 * 1.01
            expect(rate.sell).toBeCloseTo(33.66, 1);   // 34 * 0.99
        });
    });

    // ============ executeExchange ============
    describe('executeExchange', () => {
        it('should BUY USDT with THB successfully', async () => {
            // Mock getRate dependencies
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            const mockWallet = { id: 1, userId: 1, balance: 10000, usdtBalance: 0 };
            const mockUpdatedWallet = { id: 1, userId: 1, balance: 9000, usdtBalance: 28.37 };
            const mockTx = { id: 1, type: 'EXCHANGE', status: 'COMPLETED' };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: {
                        findUnique: jest.fn().mockResolvedValue(mockWallet),
                        update: jest.fn().mockResolvedValue(mockUpdatedWallet),
                    },
                    transaction: {
                        create: jest.fn().mockResolvedValue(mockTx),
                    },
                };
                return cb(txContext);
            });

            const result = await exchangeService.executeExchange(1, 'BUY', 1000);

            expect(result.success).toBe(true);
            expect(result.exchanged.from.currency).toBe('THB');
            expect(result.exchanged.to.currency).toBe('USDT');
            expect(result.exchanged.rate).toBeCloseTo(35.35, 1);
        });

        it('should SELL USDT for THB successfully', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            const mockWallet = { id: 1, userId: 1, balance: 0, usdtBalance: 100 };
            const mockUpdatedWallet = { id: 1, userId: 1, balance: 3465, usdtBalance: 0 };
            const mockTx = { id: 2, type: 'EXCHANGE', status: 'COMPLETED' };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: {
                        findUnique: jest.fn().mockResolvedValue(mockWallet),
                        update: jest.fn().mockResolvedValue(mockUpdatedWallet),
                    },
                    transaction: {
                        create: jest.fn().mockResolvedValue(mockTx),
                    },
                };
                return cb(txContext);
            });

            const result = await exchangeService.executeExchange(1, 'SELL', 100);

            expect(result.success).toBe(true);
            expect(result.exchanged.from.currency).toBe('USDT');
            expect(result.exchanged.to.currency).toBe('THB');
        });

        it('should throw error for insufficient THB balance on BUY', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            const mockWallet = { id: 1, userId: 1, balance: 50, usdtBalance: 0 }; // Only 50 THB

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: { findUnique: jest.fn().mockResolvedValue(mockWallet) },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(exchangeService.executeExchange(1, 'BUY', 1000))
                .rejects.toThrow('Insufficient THB balance');
        });

        it('should throw error for insufficient USDT balance on SELL', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            const mockWallet = { id: 1, userId: 1, balance: 0, usdtBalance: 5 }; // Only 5 USDT

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: { findUnique: jest.fn().mockResolvedValue(mockWallet) },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(exchangeService.executeExchange(1, 'SELL', 100))
                .rejects.toThrow('Insufficient USDT balance');
        });

        it('should throw error for non-existent wallet', async () => {
            mockPrisma.systemSetting.findUnique
                .mockResolvedValueOnce({ key: 'exchange_rate_mode', value: 'manual' })
                .mockResolvedValueOnce({ key: 'exchange_rate_usdt_thb', value: '35.00' });

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    wallet: { findUnique: jest.fn().mockResolvedValue(null) },
                    transaction: { create: jest.fn() },
                };
                return cb(txContext);
            });

            await expect(exchangeService.executeExchange(999, 'BUY', 100))
                .rejects.toThrow('Wallet not found');
        });
    });
});
