import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';

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
    const user = req.user;

    res.status(200).json({
        success: true,
        data: {
            user
        }
    });
});
