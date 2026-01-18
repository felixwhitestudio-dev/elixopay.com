import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as exchangeService from '../services/exchange.service';

export const getRate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const rates = await exchangeService.getRate();
    res.status(200).json({
        success: true,
        data: rates
    });
});

export const swap = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { type, amount } = req.body;

    if (!type || !amount || amount <= 0) {
        return next(new AppError('Invalid parameters. Type (BUY/SELL) and positive amount required.', 400));
    }

    if (type !== 'BUY' && type !== 'SELL') {
        return next(new AppError('Invalid transaction type. Must be BUY or SELL.', 400));
    }

    const result = await exchangeService.executeExchange(userId, type, Number(amount));

    res.status(200).json({
        success: true,
        data: result
    });
});
