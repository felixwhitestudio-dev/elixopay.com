import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import prisma from '../utils/prisma';

// Get all notifications for the logged-in user
export const getNotifications = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === 'true';

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        }),
        prisma.notification.count({
            where: { userId, isRead: false },
        }),
    ]);

    res.status(200).json({
        success: true,
        data: { notifications, unreadCount },
    });
});

// Mark a notification as read
export const markAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;
    const { id } = req.params;

    await prisma.notification.updateMany({
        where: { id: parseInt(id), userId },
        data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'Marked as read' });
});

// Mark all notifications as read
export const markAllAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user.id;

    await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

// Helper: Create a notification (used by other services)
export async function createNotification(userId: number, type: string, title: string, message: string, metadata?: any) {
    return prisma.notification.create({
        data: {
            userId,
            type,
            title,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
        },
    });
}
