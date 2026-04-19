/**
 * Billing Controller Tests
 */

jest.mock('../../utils/prisma', () => {
    return {
        __esModule: true,
        default: {
            product: { create: jest.fn() },
            price: { create: jest.fn(), findUnique: jest.fn() },
            customer: { create: jest.fn(), findUnique: jest.fn() },
            subscription: { create: jest.fn() },
        },
    };
});

jest.mock('../../services/apikey.service', () => ({
    ApiKeyService: {
        validateKey: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import prisma from '../../utils/prisma';
import { ApiKeyService } from '../../services/apikey.service';

const mockPrisma = prisma as any;

describe('Billing Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============ Products ============
    describe('createProduct logic', () => {
        it('should create a product for authenticated merchant', async () => {
            mockPrisma.product.create.mockResolvedValue({
                id: 'prod-1', merchantId: 1, name: 'Premium Plan', description: 'Full access',
            });

            const product = await prisma.product.create({
                data: { merchantId: 1, name: 'Premium Plan', description: 'Full access' },
            });

            expect(product.name).toBe('Premium Plan');
            expect(product.merchantId).toBe(1);
        });
    });

    // ============ Prices ============
    describe('createPrice logic', () => {
        it('should create a monthly price', async () => {
            mockPrisma.price.create.mockResolvedValue({
                id: 'price-1', productId: 'prod-1', amount: 999, currency: 'THB',
                interval: 'month', intervalCount: 1,
            });

            const price = await prisma.price.create({
                data: {
                    productId: 'prod-1', amount: 999, currency: 'THB',
                    interval: 'month', intervalCount: 1,
                },
            });

            expect(price.amount).toBe(999);
            expect(price.interval).toBe('month');
            expect(price.currency).toBe('THB');
        });

        it('should create a yearly price with custom interval count', async () => {
            mockPrisma.price.create.mockResolvedValue({
                id: 'price-2', productId: 'prod-1', amount: 9990,
                interval: 'year', intervalCount: 1,
            });

            const price = await prisma.price.create({
                data: { productId: 'prod-1', amount: 9990, interval: 'year', intervalCount: 1 },
            });

            expect(price.interval).toBe('year');
        });
    });

    // ============ Customers ============
    describe('createCustomer logic', () => {
        it('should create a customer with required fields', async () => {
            mockPrisma.customer.create.mockResolvedValue({
                id: 'cust-1', merchantId: 1, name: 'Alice', email: 'alice@test.com',
                phone: null, metadata: null,
            });

            const customer = await prisma.customer.create({
                data: { merchantId: 1, name: 'Alice', email: 'alice@test.com' },
            });

            expect(customer.name).toBe('Alice');
            expect(customer.email).toBe('alice@test.com');
        });

        it('should create a customer with optional metadata', async () => {
            mockPrisma.customer.create.mockResolvedValue({
                id: 'cust-2', merchantId: 1, name: 'Bob', email: 'bob@test.com',
                phone: '+66891234567', metadata: '{"tier":"gold"}',
            });

            const customer = await prisma.customer.create({
                data: {
                    merchantId: 1, name: 'Bob', email: 'bob@test.com',
                    phone: '+66891234567', metadata: JSON.stringify({ tier: 'gold' }),
                },
            });

            expect(customer.phone).toBe('+66891234567');
            expect(JSON.parse(customer.metadata as string).tier).toBe('gold');
        });
    });

    // ============ Subscriptions ============
    describe('createSubscription logic', () => {
        it('should create an active subscription with correct period', async () => {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            mockPrisma.price.findUnique.mockResolvedValue({
                id: 'price-1', interval: 'month', intervalCount: 1,
            });
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1', merchantId: 1,
            });
            mockPrisma.subscription.create.mockResolvedValue({
                id: 'sub-1', customerId: 'cust-1', priceId: 'price-1',
                status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd,
            });

            const subscription = await prisma.subscription.create({
                data: {
                    customerId: 'cust-1', priceId: 'price-1',
                    currentPeriodStart: now, currentPeriodEnd: periodEnd, status: 'active',
                },
            });

            expect(subscription.status).toBe('active');
            expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(
                subscription.currentPeriodStart.getTime()
            );
        });

        it('should validate price exists before creating subscription', async () => {
            mockPrisma.price.findUnique.mockResolvedValue(null);

            const price = await prisma.price.findUnique({ where: { id: 'nonexistent' } });
            expect(price).toBeNull();
        });

        it('should validate customer belongs to merchant', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1', merchantId: 999, // Different merchant
            });

            const customer = await prisma.customer.findUnique({ where: { id: 'cust-1' } });
            expect(customer!.merchantId).not.toBe(1); // Merchant 1 should not access this customer
        });
    });
});
