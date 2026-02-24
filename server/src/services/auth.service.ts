import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export const signToken = (id: number) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
};

import * as walletService from './wallet.service';

export const generateMerchantId = async (): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    const PREFIX = 'ELXP';

    for (let attempt = 0; attempt < 10; attempt++) {
        let code = '';
        const bytes = crypto.randomBytes(6);
        for (let i = 0; i < 6; i++) {
            code += chars[bytes[i] % chars.length];
        }
        const merchantId = `${PREFIX}-${code}`;

        // Check uniqueness
        const existing = await prisma.user.findUnique({ where: { merchantId } });
        if (!existing) return merchantId;
    }
    throw new AppError('Failed to generate unique Merchant ID. Please try again.', 500);
};

export const registerUser = async (email: string, passwordHash: string, firstName: string, lastName: string) => {
    const merchantId = await generateMerchantId();

    const user = await prisma.user.create({
        data: {
            email,
            password: passwordHash,
            firstName,
            lastName,
            merchantId,
        },
    });

    // Auto-create wallet
    await walletService.createWallet(user.id);

    return user;
};

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 12);
};

export const comparePassword = async (candidate: string, hash: string) => {
    return await bcrypt.compare(candidate, hash);
};

export const generateVerificationToken = () => {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash it for database storage (optional but good practice)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Set expiration to 24 hours from now
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return { token, hashedToken, expires };
};

export const generatePasswordResetToken = () => {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Set expiration to 1 hour from now
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000);

    return { token, hashedToken, expires };
};
