import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { RefundService } from '../services/refund.service';
import { AppError } from '../utils/AppError';

/**
 * Refund Controller
 * 
 * Handles HTTP requests for refund operations.
 */

// POST /api/v1/refund — Create a new refund
export const createRefund = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { transactionId, amount, reason } = req.body;

    if (!transactionId || !amount) {
        throw new AppError('กรุณาระบุ transactionId และ amount', 400);
    }

    const refund = await RefundService.createRefund(userId, Number(transactionId), Number(amount), reason);

    res.status(201).json({
        success: true,
        status: 'success',
        message: 'คืนเงินสำเร็จ',
        data: { refund },
    });
});

// GET /api/v1/refund/:id — Get refund details
export const getRefund = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) throw new AppError('Unauthorized', 401);

    const refund = await RefundService.getRefundById(userId, Number(req.params.id));

    res.status(200).json({
        success: true,
        status: 'success',
        data: { refund },
    });
});

// GET /api/v1/refund — List all refunds
export const listRefunds = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) throw new AppError('Unauthorized', 401);

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await RefundService.listRefunds(userId, page, limit);

    res.status(200).json({
        success: true,
        status: 'success',
        data: result,
    });
});
