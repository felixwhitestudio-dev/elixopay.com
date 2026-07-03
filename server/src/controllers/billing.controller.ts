import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import prisma from '../utils/prisma';
import { ApiKeyService } from '../services/apikey.service';
import jwt from 'jsonwebtoken';

/**
 * Helper to validate merchant API key or Dashboard JWT session
 */
const getMerchantFromKey = async (req: Request) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) throw new AppError('Unauthorized: Missing API Key or Session', 401);

    // 1. Try JWT Token (Dashboard usage - token has 3 parts)
    if (token.split('.').length === 3) {
        try {
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-dev-key');
            const user = await prisma.user.findUnique({ where: { id: decoded.id } });
            if (user) return user;
        } catch(e) {
            // Ignore and fall through just in case, or throw?
            // Actually, if it looks like a JWT but fails, it's definitely an invalid session.
            throw new AppError('Unauthorized: Invalid or expired session', 401);
        }
    }

    // 2. Try Bearer API Key (External Integration usage)
    const authData = await ApiKeyService.validateKey(token);
    if (!authData) throw new AppError('Unauthorized: Invalid API Key', 401);

    return authData.user;
};

// -------------------------------------------------------------
// 1. PRODUCTS
// -------------------------------------------------------------
export const createProduct = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const { name, description, amount, interval, currency } = req.body;

    if (!name) return next(new AppError('Product name is required', 400));

    const product = await prisma.product.create({
        data: {
            merchantId: merchant.id,
            name,
            description,
            ...(amount && interval ? {
                prices: {
                    create: [{
                        amount: Number(amount),
                        interval,
                        currency: currency || 'THB'
                    }]
                }
            } : {})
        },
        include: { prices: true }
    });

    res.status(201).json({ success: true, data: product });
});

export const getProducts = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const products = await prisma.product.findMany({
        where: { merchantId: merchant.id, isActive: true },
        include: { prices: { where: { isActive: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: { products } });
});

export const deleteProduct = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const { id } = req.params;

    const product = await prisma.product.findFirst({
        where: { id, merchantId: merchant.id }
    });

    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    await prisma.product.update({
        where: { id },
        data: { isActive: false }
    });

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
});

// -------------------------------------------------------------
// 2. PRICES
// -------------------------------------------------------------
export const createPrice = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const { productId, amount, currency, interval, intervalCount } = req.body;

    if (!productId || !amount || !interval) {
        return next(new AppError('Missing required fields', 400));
    }

    const price = await prisma.price.create({
        data: {
            productId,
            amount: Number(amount),
            currency: currency || 'THB',
            interval,
            intervalCount: intervalCount || 1
        }
    });

    res.status(201).json({ success: true, data: price });
});

export const getPrices = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const prices = await prisma.price.findMany({
        where: { product: { merchantId: merchant.id } },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: prices });
});

// -------------------------------------------------------------
// 3. CUSTOMERS
// -------------------------------------------------------------
export const createCustomer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const { name, email, phone, metadata } = req.body;

    if (!name || !email) {
        return next(new AppError('Customer name and email are required', 400));
    }

    const customer = await prisma.customer.create({
        data: {
            merchantId: merchant.id,
            name,
            email,
            phone,
            metadata: metadata ? JSON.stringify(metadata) : null
        }
    });

    res.status(201).json({ success: true, data: customer });
});

export const getCustomers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const customers = await prisma.customer.findMany({
        where: { merchantId: merchant.id },
        include: { subscriptions: true },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: { customers } });
});

// -------------------------------------------------------------
// 4. SUBSCRIPTIONS
// -------------------------------------------------------------
export const createSubscription = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const { customerId, priceId } = req.body;

    if (!customerId || !priceId) {
        return next(new AppError('customerId and priceId are required', 400));
    }

    // Validate relations
    const price = await prisma.price.findUnique({ where: { id: priceId } });
    if (!price) return next(new AppError('Price not found', 404));

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.merchantId !== merchant.id) {
        return next(new AppError('Customer not found or access denied', 404));
    }

    // Calculate initial period end based on price interval
    const now = new Date();
    const periodEnd = new Date(now);

    if (price.interval === 'month') {
        periodEnd.setMonth(periodEnd.getMonth() + price.intervalCount);
    } else if (price.interval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + price.intervalCount);
    } else if (price.interval === 'week') {
        periodEnd.setDate(periodEnd.getDate() + (7 * price.intervalCount));
    }

    const subscription = await prisma.subscription.create({
        data: {
            customerId,
            priceId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            status: 'active'
        }
    });

    res.status(201).json({ success: true, data: subscription });
});

export const getSubscriptions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const merchant = await getMerchantFromKey(req);
    const subscriptions = await prisma.subscription.findMany({
        where: { customer: { merchantId: merchant.id } },
        include: { customer: true, price: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: { subscriptions } });
});
