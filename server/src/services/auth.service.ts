import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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

export const registerUser = async (email: string, passwordHash: string, firstName: string, lastName: string) => {
    const user = await prisma.user.create({
        data: {
            email,
            password: passwordHash,
            firstName,
            lastName,
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
