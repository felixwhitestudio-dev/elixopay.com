import logger from '../utils/logger';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

/**
 * Generate a new secure API key
 * Format: prefix_randomHex (e.g., ep_test_a1b2c3d4e5f6g7h8...)
 */
const generateSecureKey = (mode: 'test' | 'live') => {
    const prefix = mode === 'live' ? 'ep_live_' : 'ep_test_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const secretKey = `${prefix}${randomPart}`;
    return secretKey;
};

/**
 * Hash a key for secure storage
 */
export const hashKey = (key: string) => {
    return crypto.createHash('sha256').update(key).digest('hex');
};

export class ApiKeyService {
    /**
     * Creates a new API Key for a user
     * @returns The raw secret key (only shown once) and the DB record
     */
    static async createApiKey(userId: number, name: string, mode: 'test' | 'live' = 'test') {
        const rawKey = generateSecureKey(mode);
        const keyHash = hashKey(rawKey);

        // The prefix shown in UI, e.g., ep_test_a1b2c...
        const keyPrefix = rawKey.substring(0, 16) + '...';

        const apiKey = await prisma.apiKey.create({
            data: {
                userId,
                name,
                keyPrefix,
                keyHash,
                mode
            }
        });

        // We return the raw key ONLY here. It is never stored in plaintext.
        return {
            id: apiKey.id,
            name: apiKey.name,
            mode: apiKey.mode,
            keyPrefix: apiKey.keyPrefix,
            secretKey: rawKey, // Show ONLY ONCE to the user
            createdAt: apiKey.createdAt
        };
    }

    /**
     * Lists all keys for a user (without secret)
     */
    static async listApiKeys(userId: number) {
        return await prisma.apiKey.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                mode: true,
                isActive: true,
                createdAt: true,
                lastUsed: true
            }
        });
    }

    /**
     * Revokes (deactivates) an API Key
     */
    static async revokeApiKey(userId: number, keyId: string) {
        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, userId }
        });

        if (!key) {
            throw new AppError('API Key not found or does not belong to this user', 404);
        }

        return await prisma.apiKey.update({
            where: { id: keyId },
            data: { isActive: false }
        });
    }

    /**
     * Validates a provided secret key and returns the associated User
     */
    static async validateKey(secretKey: string) {
        if (!secretKey || (!secretKey.startsWith('ep_test_') && !secretKey.startsWith('ep_live_'))) {
            return null;
        }

        const keyHash = hashKey(secretKey);

        const apiKey = await prisma.apiKey.findFirst({
            where: {
                keyHash,
                isActive: true
            },
            include: {
                user: {
                    include: { wallet: true }
                }
            }
        });

        if (!apiKey || !apiKey.user.isActive) {
            return null;
        }

        // Update lastUsed timestamp in background (fire and forget)
        prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsed: new Date() }
        }).catch(err => logger.error('Failed to update API key lastUsed:', err));

        return {
            user: apiKey.user,
            mode: apiKey.mode
        };
    }
}
