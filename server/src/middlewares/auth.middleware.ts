import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // 1) Getting token and check of it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verification token
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { wallet: true }
    });

    if (!currentUser) {
        return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    // @ts-ignore
    req.user = currentUser;
    next();
});

export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // @ts-ignore
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};
