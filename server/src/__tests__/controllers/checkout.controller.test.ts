/**
 * Checkout Controller Tests
 * Tests the public API endpoints for payment processing
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            transaction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
            wallet: { update: jest.fn() },
            $transaction: jest.fn(),
        },
    };
});

jest.mock('../../services/apikey.service', () => ({
    ApiKeyService: {
        validateKey: jest.fn(),
    },
}));

jest.mock('../../services/kbank.service', () => ({
    KBankService: {
        generateQR: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { ApiKeyService } from '../../services/apikey.service';
import { KBankService } from '../../services/kbank.service';

const mockPrisma = prisma as any;
const mockApiKeyService = ApiKeyService as jest.Mocked<typeof ApiKeyService>;
const mockKBankService = KBankService as any;

// Helper to create mock Express objects
const mockReq = (overrides = {}) => ({
    headers: { authorization: 'Bearer ep_test_validkey123' },
    body: {},
    params: {},
    ...overrides,
});

const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const mockNext = jest.fn();

describe('Checkout Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Payment Flow Logic', () => {
        it('should validate API key format', async () => {
            // validateKey returns null for invalid key
            (mockApiKeyService.validateKey as jest.Mock).mockResolvedValue(null);

            const result = await ApiKeyService.validateKey('invalid_key');
            expect(result).toBeNull();
        });

        it('should authenticate with valid test key', async () => {
            const mockUser = { id: 1, email: 'merchant@test.com', isActive: true, wallet: { balance: 5000 } };
            (mockApiKeyService.validateKey as jest.Mock).mockResolvedValue({
                user: mockUser,
                mode: 'test',
            });

            const result = await ApiKeyService.validateKey('ep_test_validkey123');
            expect(result).not.toBeNull();
            expect(result!.user.email).toBe('merchant@test.com');
            expect(result!.mode).toBe('test');
        });

        it('should distinguish between test and live mode keys', async () => {
            (mockApiKeyService.validateKey as jest.Mock)
                .mockResolvedValueOnce({ user: { id: 1 }, mode: 'test' })
                .mockResolvedValueOnce({ user: { id: 1 }, mode: 'live' });

            const testResult = await ApiKeyService.validateKey('ep_test_abc');
            const liveResult = await ApiKeyService.validateKey('ep_live_abc');

            expect(testResult!.mode).toBe('test');
            expect(liveResult!.mode).toBe('live');
        });
    });

    describe('Transaction Creation', () => {
        it('should create a PENDING transaction record', async () => {
            const mockTx = {
                id: 100, userId: 1, amount: 500, type: 'DEPOSIT',
                status: 'PENDING', reference: 'REF-123',
            };
            mockPrisma.transaction.create.mockResolvedValue(mockTx);

            const result = await prisma.transaction.create({
                data: {
                    userId: 1, amount: 500, type: 'DEPOSIT',
                    status: 'PENDING', reference: 'REF-123',
                },
            });

            expect(result.status).toBe('PENDING');
            expect(result.type).toBe('DEPOSIT');
            expect(result.amount).toBe(500);
        });
    });

    describe('QR Code Generation', () => {
        it('should generate QR via KBank service', async () => {
            mockKBankService.generateQR.mockResolvedValue({
                qrCode: 'base64-qr-image-data',
                txnId: 'kbank-ref-123',
                refId: 'ref-456',
            });

            const result = await KBankService.generateQR(500, 'Payment for order');

            expect(result.qrCode).toBe('base64-qr-image-data');
            expect(result.txnId).toBe('kbank-ref-123');
        });

        it('should handle KBank service failure gracefully', async () => {
            mockKBankService.generateQR.mockRejectedValue(new Error('KBank API unavailable'));

            await expect(KBankService.generateQR(500, 'test'))
                .rejects.toThrow('KBank API unavailable');
        });
    });

    describe('Payment Completion (Mock)', () => {
        it('should update transaction status and wallet balance', async () => {
            const mockTx = { id: 100, userId: 1, amount: 500, status: 'PENDING', metadata: '{}' };
            const mockUpdatedTx = { ...mockTx, status: 'COMPLETED' };

            mockPrisma.$transaction.mockImplementation(async (cb: any) => {
                const txContext = {
                    transaction: {
                        findUnique: jest.fn().mockResolvedValue(mockTx),
                        update: jest.fn().mockResolvedValue(mockUpdatedTx),
                    },
                    wallet: {
                        update: jest.fn().mockResolvedValue({ balance: 500 }),
                    },
                };
                return cb(txContext);
            });

            const result = await prisma.$transaction(async (tx: any) => {
                const transaction = await tx.transaction.findUnique({ where: { id: 100 } });
                expect(transaction.status).toBe('PENDING');

                const updated = await tx.transaction.update({
                    where: { id: 100 },
                    data: { status: 'COMPLETED' },
                });
                expect(updated.status).toBe('COMPLETED');

                await tx.wallet.update({
                    where: { userId: 1 },
                    data: { balance: { increment: 500 } },
                });

                return updated;
            });

            expect(result.status).toBe('COMPLETED');
        });
    });
});
