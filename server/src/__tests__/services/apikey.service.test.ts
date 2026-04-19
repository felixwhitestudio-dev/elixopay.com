/**
 * API Key Service Tests
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            apiKey: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
        },
    };
});

// Mock logger to suppress output
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { ApiKeyService, hashKey } from '../../services/apikey.service';

const mockPrisma = prisma as any;

describe('API Key Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ hashKey ============
    describe('hashKey', () => {
        it('should produce consistent SHA-256 hashes', () => {
            const hash1 = hashKey('ep_test_abc123');
            const hash2 = hashKey('ep_test_abc123');
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
        });

        it('should produce different hashes for different inputs', () => {
            const hash1 = hashKey('ep_test_key_one');
            const hash2 = hashKey('ep_test_key_two');
            expect(hash1).not.toBe(hash2);
        });
    });

    // ============ createApiKey ============
    describe('createApiKey', () => {
        it('should create a test key with ep_test_ prefix', async () => {
            mockPrisma.apiKey.create.mockResolvedValue({
                id: 'uuid-1',
                name: 'My Test Key',
                keyPrefix: 'ep_test_xxxxxxxx...',
                keyHash: 'hash123',
                mode: 'test',
                createdAt: new Date(),
            });

            const result = await ApiKeyService.createApiKey(1, 'My Test Key', 'test');

            expect(result.secretKey).toMatch(/^ep_test_/);
            expect(result.mode).toBe('test');
            expect(result.name).toBe('My Test Key');
            expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 1,
                        name: 'My Test Key',
                        mode: 'test',
                    }),
                })
            );
        });

        it('should create a live key with ep_live_ prefix', async () => {
            mockPrisma.apiKey.create.mockResolvedValue({
                id: 'uuid-2',
                name: 'Production Key',
                keyPrefix: 'ep_live_xxxxxxxx...',
                keyHash: 'hash456',
                mode: 'live',
                createdAt: new Date(),
            });

            const result = await ApiKeyService.createApiKey(1, 'Production Key', 'live');

            expect(result.secretKey).toMatch(/^ep_live_/);
            expect(result.mode).toBe('live');
        });

        it('should default to test mode when no mode specified', async () => {
            mockPrisma.apiKey.create.mockResolvedValue({
                id: 'uuid-3', name: 'Default Key', mode: 'test',
                keyPrefix: 'ep_test_xxx...', keyHash: 'h', createdAt: new Date(),
            });

            await ApiKeyService.createApiKey(1, 'Default Key');

            expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ mode: 'test' }),
                })
            );
        });
    });

    // ============ listApiKeys ============
    describe('listApiKeys', () => {
        it('should return keys without secret', async () => {
            const mockKeys = [
                { id: 'k1', name: 'Key 1', keyPrefix: 'ep_test_xxx...', mode: 'test', isActive: true, createdAt: new Date(), lastUsed: null },
            ];
            mockPrisma.apiKey.findMany.mockResolvedValue(mockKeys);

            const result = await ApiKeyService.listApiKeys(1);

            expect(result).toEqual(mockKeys);
            expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { userId: 1 } })
            );
        });
    });

    // ============ revokeApiKey ============
    describe('revokeApiKey', () => {
        it('should deactivate an existing key', async () => {
            mockPrisma.apiKey.findFirst.mockResolvedValue({ id: 'k1', userId: 1 });
            mockPrisma.apiKey.update.mockResolvedValue({ id: 'k1', isActive: false });

            const result = await ApiKeyService.revokeApiKey(1, 'k1');
            expect(result.isActive).toBe(false);
        });

        it('should throw 404 if key not found', async () => {
            mockPrisma.apiKey.findFirst.mockResolvedValue(null);

            await expect(ApiKeyService.revokeApiKey(1, 'nonexistent'))
                .rejects.toThrow('API Key not found');
        });
    });

    // ============ validateKey ============
    describe('validateKey', () => {
        it('should return null for invalid key format', async () => {
            const result = await ApiKeyService.validateKey('invalid_key');
            expect(result).toBeNull();
        });

        it('should return null for empty key', async () => {
            const result = await ApiKeyService.validateKey('');
            expect(result).toBeNull();
        });

        it('should return user and mode for valid active key', async () => {
            const mockUser = { id: 1, email: 'test@example.com', isActive: true, wallet: {} };
            mockPrisma.apiKey.findFirst.mockResolvedValue({
                id: 'k1', mode: 'test', user: mockUser,
            });
            // Mock the fire-and-forget update
            mockPrisma.apiKey.update.mockResolvedValue({});

            const result = await ApiKeyService.validateKey('ep_test_' + 'a'.repeat(64));

            expect(result).not.toBeNull();
            expect(result!.user).toEqual(mockUser);
            expect(result!.mode).toBe('test');
        });

        it('should return null for inactive user', async () => {
            mockPrisma.apiKey.findFirst.mockResolvedValue({
                id: 'k1', mode: 'test',
                user: { id: 1, isActive: false },
            });

            const result = await ApiKeyService.validateKey('ep_test_' + 'b'.repeat(64));
            expect(result).toBeNull();
        });
    });
});
