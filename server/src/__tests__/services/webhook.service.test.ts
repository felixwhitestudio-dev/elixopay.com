/**
 * Webhook Service Tests
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            webhookEndpoint: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                delete: jest.fn(),
            },
        },
    };
});

jest.mock('axios');
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { WebhookService } from '../../services/webhook.service';
import axios from 'axios';

const mockPrisma = prisma as any;
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Webhook Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ createEndpoint ============
    describe('createEndpoint', () => {
        it('should create an endpoint with generated secret', async () => {
            mockPrisma.webhookEndpoint.create.mockResolvedValue({
                id: 'wh-1',
                userId: 1,
                url: 'https://merchant.com/webhook',
                secret: 'generated-secret',
                events: '["payment.success"]',
            });

            const result = await WebhookService.createEndpoint(
                1,
                'https://merchant.com/webhook',
                ['payment.success']
            );

            expect(result).toBeDefined();
            expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 1,
                        url: 'https://merchant.com/webhook',
                        events: '["payment.success"]',
                    }),
                })
            );
        });
    });

    // ============ listEndpoints ============
    describe('listEndpoints', () => {
        it('should return endpoints with parsed events array', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
                { id: 'wh-1', url: 'https://a.com', events: '["payment.success","payment.failed"]' },
                { id: 'wh-2', url: 'https://b.com', events: '["*"]' },
            ]);

            const result = await WebhookService.listEndpoints(1);

            expect(result).toHaveLength(2);
            expect(result[0].events).toEqual(['payment.success', 'payment.failed']);
            expect(result[1].events).toEqual(['*']);
        });

        it('should return empty array for user with no endpoints', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);

            const result = await WebhookService.listEndpoints(999);
            expect(result).toEqual([]);
        });
    });

    // ============ deleteEndpoint ============
    describe('deleteEndpoint', () => {
        it('should delete an existing endpoint', async () => {
            mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({ id: 'wh-1', userId: 1 });
            mockPrisma.webhookEndpoint.delete.mockResolvedValue({});

            const result = await WebhookService.deleteEndpoint(1, 'wh-1');
            expect(result).toBe(true);
        });

        it('should throw 404 for non-existent endpoint', async () => {
            mockPrisma.webhookEndpoint.findFirst.mockResolvedValue(null);

            await expect(WebhookService.deleteEndpoint(1, 'nonexistent'))
                .rejects.toThrow('Webhook endpoint not found');
        });
    });

    // ============ dispatchEvent ============
    describe('dispatchEvent', () => {
        it('should dispatch to subscribed endpoints', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
                { id: 'wh-1', url: 'https://a.com/hook', secret: 'sec1', events: '["payment.success"]', isActive: true },
            ]);
            mockAxios.post.mockResolvedValue({ status: 200 } as any);

            await WebhookService.dispatchEvent(1, 'payment.success', { id: 1, amount: 100 });

            expect(mockAxios.post).toHaveBeenCalledTimes(1);
            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://a.com/hook',
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Elixopay-Signature': expect.any(String),
                        'Elixopay-Event': 'payment.success',
                    }),
                })
            );
        });

        it('should skip endpoints not subscribed to the event', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
                { id: 'wh-1', url: 'https://a.com/hook', secret: 'sec1', events: '["payment.failed"]', isActive: true },
            ]);

            await WebhookService.dispatchEvent(1, 'payment.success', { id: 1 });

            expect(mockAxios.post).not.toHaveBeenCalled();
        });

        it('should dispatch to wildcard (*) endpoints', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
                { id: 'wh-1', url: 'https://a.com/hook', secret: 'sec1', events: '["*"]', isActive: true },
            ]);
            mockAxios.post.mockResolvedValue({ status: 200 } as any);

            await WebhookService.dispatchEvent(1, 'invoice.created', { id: 1 });

            expect(mockAxios.post).toHaveBeenCalledTimes(1);
        });

        it('should not throw when a dispatch fails', async () => {
            mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
                { id: 'wh-1', url: 'https://down.com/hook', secret: 'sec1', events: '["payment.success"]', isActive: true },
            ]);
            mockAxios.post.mockRejectedValue(new Error('Connection refused'));

            // Should not throw
            await expect(
                WebhookService.dispatchEvent(1, 'payment.success', { id: 1 })
            ).resolves.toBeUndefined();
        });
    });
});
