import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiKeyService } from '../services/apikey.service';
import { AppError } from '../utils/AppError'; // Added import for AppError
import prisma from '../utils/prisma'; // Added import for prisma

export const createApiKey = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user;
    const { name, mode } = req.body; // mode: 'test' | 'live'

    if (!name) {
        return next(new AppError('API Key name is required', 400));
    }

    const keyMode = mode === 'live' ? 'live' : 'test';

    // Enforce KYC check for live keys
    if (keyMode === 'live' && user.role !== 'admin' && user.kycStatus !== 'verified') {
        return next(new AppError('KYC Verification Required: You must complete identity verification to generate Live API Keys.', 403));
    }

    // Limit to 5 active keys
    const activeCount = await prisma.apiKey.count({
        where: { userId: user.id, isActive: true }
    });

    if (activeCount >= 5) {
        return next(new AppError('You can only have a maximum of 5 active API Keys.', 400));
    }

    const newKey = await ApiKeyService.createApiKey(user.id, name, keyMode);

    res.status(201).json({
        success: true,
        data: {
            apiKey: newKey
        }
    });
});

export const getApiKeys = catchAsync(async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.user.id;

    const keys = await ApiKeyService.listApiKeys(userId);

    res.status(200).json({
        success: true,
        data: {
            apiKeys: keys
        }
    });
});

export const revokeApiKey = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { keyId } = req.params;

    await ApiKeyService.revokeApiKey(userId, keyId);

    res.status(200).json({
        success: true,
        message: 'API Key revoked successfully'
    });
});
