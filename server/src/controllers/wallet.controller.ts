import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as walletService from '../services/wallet.service';

export const getMyWallet = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - user attached by auth middleware
    const userId = req.user.id;
    const wallet = await walletService.getWalletByUserId(userId);

    // Also get recent transactions for convenience
    const transactions = await walletService.getTransactions(userId, 5);

    res.status(200).json({
        success: true,
        data: {
            wallet,
            recentTransactions: transactions
        }
    });
});

export const getMyTransactions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const transactions = await walletService.getTransactions(userId, limit);

    res.status(200).json({
        success: true,
        data: {
            transactions
        }
    });
});

export const deposit = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { amount, reference } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError('Invalid amount', 400));
    }

    const result = await walletService.deposit(userId, Number(amount), reference);

    res.status(200).json({
        success: true,
        data: result
    });
});

export const withdraw = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { amount, bankAccount } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError('Invalid amount', 400));
    }

    const result = await walletService.withdraw(userId, Number(amount), bankAccount);

    res.status(200).json({
        success: true,
        data: result
    });
});

export const transfer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { email, recipient, amount } = req.body;
    // Support both legacy 'email' and new 'recipient' fields
    const finalRecipient = recipient || email;

    if (!finalRecipient || !amount || amount <= 0) {
        return next(new AppError('Please provide recipient (Email or Wallet ID) and valid amount', 400));
    }

    const result = await walletService.transfer(userId, finalRecipient, Number(amount));

    res.status(200).json({
        success: true,
        data: result
    });
});
