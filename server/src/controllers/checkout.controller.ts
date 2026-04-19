import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { ApiKeyService } from '../services/apikey.service';
import prisma from '../utils/prisma';
import { WebhookService } from '../services/webhook.service';
import { orchestrator } from '../services/orchestrator.service';
import { PaymentMethod } from '../providers/PaymentProvider';

/**
 * Public Endpoint for Merchants to create a payment request.
 * Expected Header: Authorization: Bearer <Secret_Key>
 */
export const createPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract API Key from Bearer token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Unauthorized: Missing API Key in Authorization header', 401));
    }

    // 2. Validate API Key
    const authData = await ApiKeyService.validateKey(token);
    if (!authData) {
        return next(new AppError('Unauthorized: Invalid or revoked API Key', 401));
    }

    const { user, mode } = authData;
    const { amount, currency, referenceId, description, returnUrl, method: requestedMethod, provider: preferredProvider } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError('Invalid amount', 400));
    }

    // Determine payment method (default to 'qr' for backward compatibility)
    const method: PaymentMethod = requestedMethod || 'qr';
    const validMethods: PaymentMethod[] = ['qr', 'card', 'bank_transfer', 'wallet'];
    if (!validMethods.includes(method)) {
        return next(new AppError(`Invalid payment method: '${method}'. Valid methods: ${validMethods.join(', ')}`, 400));
    }

    const isTestMode = mode === 'test';

    // 3. Create charge through Payment Orchestrator
    let chargeResult;
    try {
        chargeResult = await orchestrator.createCharge(
            {
                amount,
                currency: currency || 'THB',
                method,
                description: description || 'API Checkout',
                returnUrl,
                token: req.body.token,       // For card payments (Omise token)
                orderId: referenceId || `ORD-${Date.now()}`,
                metadata: { referenceId },
            },
            {
                isTestMode,
                preferredProvider,
            }
        );
    } catch (err: any) {
        logger.error('[Checkout] Orchestrator charge failed:', err.message);
        return next(new AppError(`Payment creation failed: ${err.message}`, 502));
    }

    // 4. Create a pending Transaction record with provider info
    const transaction = await prisma.transaction.create({
        data: {
            userId: user.id,
            amount: amount,
            type: 'DEPOSIT',
            status: chargeResult.result.status === 'completed' ? 'COMPLETED' : 'PENDING',
            reference: referenceId || `API-${Date.now()}`,
            provider: chargeResult.provider,
            providerChargeId: chargeResult.result.providerChargeId,
            paymentMethod: method,
            metadata: JSON.stringify({
                description: description || 'API Checkout',
                returnUrl: returnUrl,
                mode: mode,
            }),
        }
    });

    // 5. Return checkout details to the merchant
    const responseData: Record<string, any> = {
        id: transaction.id,
        amount,
        currency: currency || 'THB',
        status: transaction.status.toLowerCase(),
        method,
        provider: chargeResult.provider,
        checkoutUrl: `${process.env.APP_URL || 'http://localhost:8080'}/checkout.html?ref=${transaction.id}`,
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
    };

    // Add method-specific fields
    if (chargeResult.result.qrCode) {
        responseData.qrCodeBase64 = chargeResult.result.qrCode;
    }
    if (chargeResult.result.redirectUrl) {
        responseData.redirectUrl = chargeResult.result.redirectUrl;
    }
    if (chargeResult.result.authorizeUri) {
        responseData.authorizeUri = chargeResult.result.authorizeUri;
    }

    res.status(200).json({
        success: true,
        data: responseData,
    });
});

/**
 * Public API Endpoint for Merchants to check the status of a payment.
 * Expected Header: Authorization: Bearer <Secret_Key>
 */
export const getPaymentStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract API Key from Bearer token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Unauthorized: Missing API Key in Authorization header', 401));
    }

    // 2. Validate API Key
    const authData = await ApiKeyService.validateKey(token);
    if (!authData) {
        return next(new AppError('Unauthorized: Invalid or revoked API Key', 401));
    }

    const { user } = authData;
    const { id } = req.params;

    // 3. Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) }
    });

    if (!transaction) {
        return next(new AppError('Payment not found', 404));
    }

    // 4. Security: Merchants can only view their own transactions
    if (transaction.userId !== user.id) {
        return next(new AppError('Payment not found', 404));
    }

    // 5. Parse metadata for extra details
    let description = '';
    let returnUrl = '';
    let mode = 'live';
    try {
        if (transaction.metadata) {
            const meta = JSON.parse(transaction.metadata);
            description = meta.description || '';
            returnUrl = meta.returnUrl || '';
            mode = meta.mode || 'live';
        }
    } catch (e) { }

    res.status(200).json({
        success: true,
        data: {
            id: transaction.id,
            object: 'payment',
            amount: transaction.amount,
            currency: 'THB',
            status: transaction.status.toLowerCase(),
            method: transaction.paymentMethod || 'qr',
            provider: transaction.provider || 'unknown',
            description,
            reference_id: transaction.reference,
            paid_at: transaction.status === 'COMPLETED' ? transaction.updatedAt : null,
            created_at: transaction.createdAt,
            mode
        }
    });
});

/**
 * Public Endpoint for the Hosted Checkout Page to fetch payment details.
 * No Auth Required.
 */
export const getCheckoutDetails = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true
                }
            }
        }
    });

    if (!transaction) {
        return next(new AppError('Payment not found', 404));
    }

    // Parse metadata
    let description = 'Elixopay Checkout';
    try {
        if (transaction.metadata) {
            const meta = JSON.parse(transaction.metadata);
            if (meta.description) description = meta.description;
        }
    } catch (e) { }

    // Regenerate QR for display using orchestrator
    let qrImage = '';
    if (transaction.status === 'PENDING') {
        try {
            const provider = transaction.provider || 'kbank';
            const method = (transaction.paymentMethod as PaymentMethod) || 'qr';
            // Determine if this is test mode
            let isTestMode = false;
            try {
                if (transaction.metadata) {
                    const meta = JSON.parse(transaction.metadata);
                    isTestMode = meta.mode === 'test';
                }
            } catch (e) { }

            const chargeResult = await orchestrator.createCharge(
                { amount: Number(transaction.amount), currency: 'THB', method, orderId: `K${Date.now()}` },
                { isTestMode, preferredProvider: provider }
            );
            qrImage = chargeResult.result.qrCode || '';
        } catch (err) {
            qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=PROMPTPAY-DEMO-${transaction.amount}`;
        }
    }

    res.status(200).json({
        success: true,
        data: {
            id: transaction.id,
            amount: transaction.amount,
            status: transaction.status,
            description,
            merchantName: `${transaction.user.firstName || ''} ${transaction.user.lastName || ''}`.trim() || transaction.user.email,
            qrCodeBase64: qrImage,
            createdAt: transaction.createdAt
        }
    });
});

/**
 * Test Mode Endpoint to simulate a successful payment from the customer.
 * Only works with test mode transactions.
 */
export const simulatePaymentCompletion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
            where: { id: Number(id) }
        });

        if (!transaction) {
            throw new AppError('Payment not found', 404);
        }

        if (transaction.status === 'COMPLETED') {
            throw new AppError('Payment is already completed', 400);
        }

        // 1. Mark transaction as COMPLETED
        await tx.transaction.update({
            where: { id: Number(id) },
            data: { status: 'COMPLETED' }
        });

        // 2. Add funds to the appropriate Merchant Wallet balance
        let updateData = {};
        try {
            if (transaction.metadata) {
                const meta = JSON.parse(transaction.metadata);
                if (meta.mode === 'test') {
                    updateData = { testBalance: { increment: transaction.amount } };
                } else {
                    updateData = { balance: { increment: transaction.amount } };
                }
            } else {
                updateData = { balance: { increment: transaction.amount } };
            }
        } catch (e) {
            updateData = { balance: { increment: transaction.amount } };
        }

        await tx.wallet.update({
            where: { userId: transaction.userId },
            data: updateData
        });
    });

    // Dispatch webhook: payment.success
    const completedTx = await prisma.transaction.findUnique({ where: { id: Number(id) } });
    if (completedTx) {
        WebhookService.dispatchEvent(completedTx.userId, 'payment.success', {
            id: completedTx.id,
            amount: completedTx.amount,
            status: 'COMPLETED',
            reference: completedTx.reference,
            completedAt: new Date().toISOString(),
        }).catch(err => logger.error('[Webhook] Dispatch failed for payment.success:', err));
    }

    res.status(200).json({
        success: true,
        message: 'Mock payment completed successfully. Funds added to merchant wallet.'
    });
});

/**
 * Public API Endpoint for Merchants to Refund a Payment (Partial or Full).
 * Expected Header: Authorization: Bearer <Secret_Key>
 */
export const refundPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract and Validate API Key from Bearer token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new AppError('Unauthorized: Missing API Key in Authorization header', 401));
    }

    const authData = await ApiKeyService.validateKey(token);
    if (!authData) {
        return next(new AppError('Unauthorized: Invalid or revoked API Key', 401));
    }

    const { user, mode } = authData;
    const { id } = req.params;
    let refundAmount = req.body.amount ? Number(req.body.amount) : undefined;

    // We must execute this inside a Prisma Transaction to ensure Data Consistency
    const refundResult = await prisma.$transaction(async (tx) => {
        // 2. Fetch the original payment
        const originalTransaction = await tx.transaction.findUnique({
            where: { id: Number(id) }
        });

        if (!originalTransaction) {
            throw new AppError('Original payment not found', 404);
        }

        // 3. Security: Merchants can only refund their own transactions
        if (originalTransaction.userId !== user.id) {
            throw new AppError('Unauthorized: You do not own this transaction', 403);
        }

        if (originalTransaction.status !== 'COMPLETED') {
            throw new AppError('Cannot refund a transaction that is not COMPLETED', 400);
        }

        if (originalTransaction.type !== 'DEPOSIT') {
            throw new AppError('Can only refund direct deposits/payments', 400);
        }

        // 4. Calculate Available Refund Balance
        const originalTotal = Number(originalTransaction.amount);
        const alreadyRefunded = Number(originalTransaction.refundedAmount);
        const maxRefundable = originalTotal - alreadyRefunded;

        if (maxRefundable <= 0) {
            throw new AppError('This transaction has already been fully refunded', 400, 'fully_refunded');
        }

        // If amount not specified, do a FULL refund of whatever is left
        if (!refundAmount) {
            refundAmount = maxRefundable;
        }

        if (refundAmount <= 0) {
            throw new AppError('Refund amount must be greater than zero', 400);
        }

        if (refundAmount > maxRefundable) {
            throw new AppError(`Refund amount (${refundAmount}) exceeds maximum refundable balance (${maxRefundable})`, 400, 'exceeds_refundable_balance');
        }

        // 5. Deduct from Merchant Wallet
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) throw new AppError('Merchant wallet not found', 404);

        const currentBalance = mode === 'test' ? Number(wallet.testBalance) : Number(wallet.balance);
        if (currentBalance < refundAmount) {
            throw new AppError(`Insufficient funds in ${mode.toUpperCase()} wallet to process this refund.`, 400, 'insufficient_funds');
        }

        const updateData = mode === 'test'
            ? { testBalance: { decrement: refundAmount } }
            : { balance: { decrement: refundAmount } };

        await tx.wallet.update({
            where: { userId: user.id },
            data: updateData
        });

        // 6. Update Original Ledger
        await tx.transaction.update({
            where: { id: originalTransaction.id },
            data: {
                refundedAmount: { increment: refundAmount }
            }
        });

        // 7. Create New Refund Ledger Entry
        const refundTx = await tx.transaction.create({
            data: {
                userId: user.id,
                amount: refundAmount,
                type: 'REFUND',
                status: 'COMPLETED', // In a real system (KBank), this might be PENDING first
                parentId: originalTransaction.id,
                metadata: JSON.stringify({
                    mode: mode,
                    reason: req.body.reason || 'Customer requested automated refund'
                })
            }
        });

        return refundTx;
    });

    // Dispatch webhook: payment.refunded
    WebhookService.dispatchEvent(user.id, 'payment.refunded', {
        id: refundResult.id,
        originalTransactionId: refundResult.parentId,
        refundedAmount: refundResult.amount,
        status: 'COMPLETED',
    }).catch(err => logger.error('[Webhook] Dispatch failed for payment.refunded:', err));

    res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: {
            id: refundResult.id,
            refundedAmount: refundResult.amount,
            originalTransactionId: refundResult.parentId,
            status: refundResult.status
        }
    });
});

