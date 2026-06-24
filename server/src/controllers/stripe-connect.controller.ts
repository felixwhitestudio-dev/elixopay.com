import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { StripeConnectService } from '../services/stripe-connect.service';
import logger from '../utils/logger';

/**
 * POST /api/v1/stripe-connect/onboard
 * Creates a new Stripe Connected Account + returns the onboarding link.
 * Requires JWT auth.
 */
export const onboard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    // Create the connected account (idempotent — throws if already connected)
    const account = await StripeConnectService.createConnectedAccount(userId);

    // Generate the onboarding link
    const accountLink = await StripeConnectService.createOnboardingLink(userId);

    res.status(200).json({
        success: true,
        data: {
            accountId: account.id,
            onboardingUrl: accountLink.url,
            expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
        },
    });
});

/**
 * GET /api/v1/stripe-connect/status
 * Returns Stripe account status for the authenticated merchant.
 * Requires JWT auth.
 */
export const getStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    const status = await StripeConnectService.getAccountStatus(userId);

    res.status(200).json({
        success: true,
        data: status,
    });
});

/**
 * POST /api/v1/stripe-connect/refresh-link
 * Creates a new onboarding link (Account Links expire after a short time).
 * Requires JWT auth.
 */
export const refreshLink = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    const accountLink = await StripeConnectService.createOnboardingLink(userId);

    res.status(200).json({
        success: true,
        data: {
            onboardingUrl: accountLink.url,
            expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
        },
    });
});

/**
 * DELETE /api/v1/stripe-connect/disconnect
 * Disconnects the merchant's Stripe account.
 * Requires JWT auth.
 */
export const disconnect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    await StripeConnectService.disconnectAccount(userId);

    res.status(200).json({
        success: true,
        message: 'Stripe account disconnected successfully.',
    });
});

/**
 * POST /api/v1/stripe-connect/payout
 * Admin creates a transfer/payout to a merchant's connected account.
 * Requires JWT auth + admin role (enforced at route level via restrictTo).
 */
export const createPayout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { merchantUserId, amount, description } = req.body;

    if (!merchantUserId || !amount || amount <= 0) {
        return next(new AppError('merchantUserId and a positive amount are required', 400));
    }

    const result = await StripeConnectService.createTransferToMerchant(
        Number(merchantUserId),
        Number(amount),
        description
    );

    res.status(200).json({
        success: true,
        message: `Transfer of ฿${amount} initiated.`,
        data: {
            transferId: result.transfer.id,
            payoutId: result.payout.id,
            amount: result.payout.amount,
            status: result.payout.status,
        },
    });
});

/**
 * GET /api/v1/stripe-connect/payouts
 * Get payout history for the authenticated merchant.
 * Requires JWT auth.
 */
export const getPayouts = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    const payouts = await StripeConnectService.getPayoutHistory(userId);

    res.status(200).json({
        success: true,
        data: payouts,
    });
});
