import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Middleware to ensure the user has completed KYC verification.
 * Must be used after the `protect` middleware which sets `req.user`.
 * Admins are automatically exempted from this check.
 */
export const requireKyc = (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user;

    if (!user) {
        return next(new AppError('Please log in to access this feature', 401));
    }

    // Admins bypass KYC restrictions
    if (user.role === 'admin') {
        return next();
    }

    // Check if the user's KYC status is verified
    if (user.kycStatus !== 'verified') {
        return next(new AppError('KYC Verification Required: You must complete identity verification before using this feature.', 403));
    }

    next();
};
