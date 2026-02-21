import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';
import jwt from 'jsonwebtoken';

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, firstName, lastName } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return next(new AppError('Email already in use', 400));
    }

    const hashedPassword = await authService.hashPassword(password);

    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            wallet: {
                create: {
                    balance: 0.00,
                    currency: 'THB'
                }
            }
        },
        include: { wallet: true }
    });

    const token = authService.signToken(newUser.id);

    res.status(201).json({
        success: true,
        token,
        data: {
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                wallet: newUser.wallet
            }
        }
    });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });

    if (!user || !(await authService.comparePassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    if (user.isActive === false) {
        return next(new AppError('Your account has been suspended. Please contact support.', 403));
    }

    const token = authService.signToken(user.id);

    res.status(200).json({
        success: true,
        token, // Send token at root level for dashboard compatibility
        data: {
            token, // Also send inside data for consistency
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                wallet: user.wallet
            }
        }
    });
});

export const me = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User is attached by protect middleware
    let user = req.user;

    // Auto-generate wallet if missing (fail-safe for legacy or incomplete accounts)
    if (!user.wallet) {
        try {
            const newWallet = await prisma.wallet.create({
                data: { userId: user.id, balance: 0.0, currency: 'THB' }
            });
            user.wallet = newWallet;
        } catch (err) {
            console.error('Failed to auto-generate wallet in /me endpoint:', err);
        }
    }

    res.status(200).json({
        success: true,
        data: {
            user
        }
    });
});

export const googleLogin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken } = req.body;
    if (!accessToken) return next(new AppError('No token provided', 400));

    // Fetch user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        return next(new AppError('Invalid Google token', 401));
    }

    const payload = await response.json();
    const email = payload.email;

    if (!email) {
        return next(new AppError('No email found from Google account', 400));
    }

    let user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });

    if (user) {
        // Existing user: direct login
        if (user.isActive === false) return next(new AppError('Your account has been suspended.', 403));

        const token = authService.signToken(user.id);
        return res.status(200).json({
            success: true,
            status: 'SUCCESS',
            token,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    wallet: user.wallet
                }
            }
        });
    } else {
        // New user: Redirect to profile completion
        // Issue a short-lived temporary token encoding the verified email
        const tempToken = jwt.sign({ email, google: true }, process.env.JWT_SECRET || 'super-secret-dev-key', { expiresIn: '15m' });

        return res.status(200).json({
            success: true,
            status: 'REQUIRE_COMPLETION',
            data: { tempToken, email }
        });
    }
});

export const completeGoogleProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { tempToken, firstName, lastName } = req.body;

    if (!tempToken || !firstName || !lastName || firstName.trim() === '' || lastName.trim() === '') {
        return next(new AppError('Please provide all required fields (First and Last Name)', 400));
    }

    let decoded: any;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'super-secret-dev-key');
    } catch (err) {
        return next(new AppError('Invalid or expired temporary token. Please sign in with Google again.', 401));
    }

    if (!decoded.email || !decoded.google) {
        return next(new AppError('Invalid token content', 401));
    }

    const existingUser = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (existingUser) {
        return next(new AppError('User already exists', 400));
    }

    // Generate a strong random password for Google-only users
    const randomPassword = await authService.hashPassword(Math.random().toString(36).slice(-10) + 'A1!');

    const newUser = await prisma.user.create({
        data: {
            email: decoded.email,
            password: randomPassword,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            wallet: { create: { balance: 0.00, currency: 'THB' } }
        },
        include: { wallet: true }
    });

    const token = authService.signToken(newUser.id);

    res.status(201).json({
        success: true,
        token,
        data: {
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                wallet: newUser.wallet
            }
        }
    });
});
