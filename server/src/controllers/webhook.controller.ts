import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { WebhookService } from '../services/webhook.service';

export const createEndpoint = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { url, events } = req.body;

    const newEndpoint = await WebhookService.createEndpoint(userId, url, events || ['*']);

    res.status(201).json({
        success: true,
        data: {
            webhook: newEndpoint
        }
    });
});

export const getEndpoints = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    const endpoints = await WebhookService.listEndpoints(userId);

    res.status(200).json({
        success: true,
        data: {
            webhooks: endpoints
        }
    });
});

export const deleteEndpoint = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { id } = req.params;

    await WebhookService.deleteEndpoint(userId, id);

    res.status(200).json({
        success: true,
        message: 'Webhook endpoint deleted successfully'
    });
});
