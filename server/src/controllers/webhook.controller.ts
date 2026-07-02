import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { WebhookService } from '../services/webhook.service';
import { AppError } from '../utils/AppError';

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

/**
 * POST /api/v1/webhooks/test
 * Sends a test event to all active webhook endpoints for the authenticated merchant.
 * Useful for merchants to verify their webhook integration is working.
 */
export const testWebhook = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    const endpoints = await WebhookService.listEndpoints(userId);
    const activeEndpoints = endpoints.filter((ep: any) => ep.isActive);

    if (activeEndpoints.length === 0) {
        return next(new AppError('No active webhook endpoints found. Create one first.', 400));
    }

    // Dispatch a test ping event to all active endpoints
    await WebhookService.dispatchEvent(userId, 'test.ping', {
        message: 'This is a test webhook from Elixopay',
        timestamp: new Date().toISOString(),
        test: true,
    });

    res.status(200).json({
        success: true,
        message: `Test event dispatched to ${activeEndpoints.length} endpoint(s)`,
        data: {
            endpointsNotified: activeEndpoints.length,
            eventType: 'test.ping',
            endpoints: activeEndpoints.map((ep: any) => ({
                id: ep.id,
                url: ep.url,
            })),
        },
    });
});

