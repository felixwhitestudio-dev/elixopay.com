import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * POST /api/v1/auth/2fa/setup
 * Generate a 2FA secret and QR code for the user to scan
 */
export const setup2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError('User not found', 404));

    if (user.twoFactorEnabled) {
        return next(new AppError('Two-factor authentication is already enabled', 400));
    }

    // Generate a new TOTP secret
    const secret = speakeasy.generateSecret({
        name: `Elixopay (${user.email})`,
        issuer: 'Elixopay',
        length: 20,
    });

    // Store the secret temporarily (not yet enabled)
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32 },
    });

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    res.status(200).json({
        success: true,
        data: {
            secret: secret.base32,    // Manual entry backup
            qrCode: qrCodeUrl,        // QR code image (base64)
        }
    });
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verify a TOTP code and enable 2FA
 */
export const verify2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) return next(new AppError('Please provide a verification code', 400));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError('User not found', 404));
    if (!user.twoFactorSecret) return next(new AppError('Please set up 2FA first', 400));

    // Verify the token
    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 1, // Allow 1 step before/after for clock skew
    });

    if (!verified) {
        return next(new AppError('Invalid verification code. Please try again.', 400));
    }

    // Enable 2FA
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
    });

    logger.info(`[2FA] Enabled for user ${user.email}`);

    res.status(200).json({
        success: true,
        message: 'Two-factor authentication has been enabled successfully.',
    });
});

/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA (requires password confirmation)
 */
export const disable2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) return next(new AppError('Please provide your password to disable 2FA', 400));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError('User not found', 404));

    if (!user.twoFactorEnabled) {
        return next(new AppError('Two-factor authentication is not enabled', 400));
    }

    // Verify password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return next(new AppError('Invalid password', 401));
    }

    // Disable 2FA
    await prisma.user.update({
        where: { id: userId },
        data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
        },
    });

    logger.info(`[2FA] Disabled for user ${user.email}`);

    res.status(200).json({
        success: true,
        message: 'Two-factor authentication has been disabled.',
    });
});

/**
 * POST /api/v1/auth/2fa/validate
 * Validate a 2FA code during login (called after password is verified)
 */
export const validate2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, token, tempToken } = req.body;

    if (!email || !token || !tempToken) {
        return next(new AppError('Please provide email, verification code, and temp token', 400));
    }

    // Verify the temp token
    const jwt = require('jsonwebtoken');
    let decoded: any;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
        return next(new AppError('Invalid or expired session. Please login again.', 401));
    }

    if (decoded.purpose !== '2fa') {
        return next(new AppError('Invalid token type', 401));
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { wallet: true }
    });

    if (!user || user.email !== email) {
        return next(new AppError('Invalid credentials', 401));
    }

    // Verify the TOTP token
    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret || '',
        encoding: 'base32',
        token: token,
        window: 1,
    });

    if (!verified) {
        return next(new AppError('Invalid verification code', 401));
    }

    // 2FA verified — issue the real JWT
    const authService = require('../services/auth.service');
    const fullToken = authService.signToken(user.id);

    logger.info(`[2FA] Login verified for user ${user.email}`);

    res.status(200).json({
        success: true,
        token: fullToken,
        data: {
            token: fullToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                wallet: user.wallet,
                twoFactorEnabled: user.twoFactorEnabled,
            }
        }
    });
});
