import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import Logger from '../utils/logger';

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        Logger.error(err);
    }

    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false, // Changed to match frontend expectation
            status: err.status,
            message: err.message,
        });
    }
    // Programming or other unknown error: don't leak details
    else {
        // 1) Log error
        Logger.error('ERROR 💥', err);

        // 2) Send generic message
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went very wrong!',
        });
    }
};
