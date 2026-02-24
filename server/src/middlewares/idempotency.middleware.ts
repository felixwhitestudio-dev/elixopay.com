import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const verifyIdempotency = async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // If no key is provided, bypass and continue normally
    if (!idempotencyKey) {
        return next();
    }

    // Hash the payload to verify identical payload on retry
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body) || '').digest('hex');

    try {
        const existingKey = await prisma.idempotencyKey.findUnique({
            where: { key: idempotencyKey }
        });

        if (existingKey) {
            // 1. Concurrent Request Locked Check
            if (existingKey.isLocked) {
                return next(new AppError('Concurrent request detected for this Idempotency-Key. Please wait.', 409, 'idempotency_locked'));
            }

            // 2. Payload Mismatch Check
            if (existingKey.requestPayload !== payloadHash) {
                return next(new AppError('Idempotency-Key is already used with a different request payload.', 400, 'idempotency_mismatch'));
            }

            // 3. Return Cached Response
            if (existingKey.responseStatus && existingKey.responseBody) {
                return res.status(existingKey.responseStatus).json(JSON.parse(existingKey.responseBody));
            }

            // Fallback if an unlocked key exists without a response (should rarely happen unless server crashed during processing)
            return next(new AppError('Previous request failed to capture response. Please generate a new Idempotency-Key.', 500, 'idempotency_error'));
        }

        // 4. Create new Lock mechanism for this Key
        try {
            await prisma.idempotencyKey.create({
                data: {
                    key: idempotencyKey,
                    userId: (req as any).user?.id || null,
                    requestPath: req.originalUrl,
                    requestMethod: req.method,
                    requestPayload: payloadHash,
                    isLocked: true // Lock the entity while controller fires
                }
            });
        } catch (dbError: any) {
            // Prisma Unique Constraint Violation (P2002) - A parallel request beat us to the DB in a microsecond race
            if (dbError.code === 'P2002') {
                return next(new AppError('Concurrent request detected for this Idempotency-Key. Please wait.', 409, 'idempotency_locked'));
            }
            throw dbError; // Throw generic to be caught by outer catch block
        }

        // 5. Intercept the res.json to save the outcome
        const originalJson = res.json.bind(res);
        res.json = (body: any): any => {
            const status = res.statusCode;

            // Fire and forget the async update to save time
            prisma.idempotencyKey.update({
                where: { key: idempotencyKey },
                data: {
                    responseStatus: status,
                    responseBody: JSON.stringify(body),
                    isLocked: false // Unlock
                }
            }).catch(err => logger.error('Failed to update IdempotencyKey:', err));

            return originalJson(body);
        };

        next();

    } catch (error) {
        return next(new AppError('Error verifying Idempotency Key', 500, 'internal_error'));
    }
};
