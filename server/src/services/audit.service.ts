
import prisma from '../utils/prisma';

/**
 * Log a user action to the database.
 * @param userId - ID of the user performing the action.
 * @param action - The action being performed (e.g., 'LOGIN', 'APPROVE').
 * @param entityType - The type of entity involved (e.g., 'TRANSACTION', 'USER').
 * @param entityId - The ID of the entity involved.
 * @param details - Additional details or metadata (e.g., old/new values) as an object.
 * @param req - Express Request object to extract IP and User Agent.
 */
export const logAction = async (
    userId: number,
    action: string,
    entityType?: string,
    entityId?: string,
    details?: any,
    req?: any
) => {
    try {
        let ipAddress = 'unknown';
        let userAgent = 'unknown';

        if (req) {
            ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
            userAgent = req.headers['user-agent'] || 'unknown';

            // Handle array for x-forwarded-for
            if (Array.isArray(ipAddress)) {
                ipAddress = ipAddress[0];
            }
        }

        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId: entityId?.toString(),
                details: details ? JSON.stringify(details) : undefined,
                ipAddress,
                userAgent
            }
        });
    } catch (error) {
        // We generally don't want audit logging failure to crash the main request,
        // so we log the error but don't rethrow.
        console.error('Failed to create audit log:', error);
    }
};

/**
 * Helper to standardise details format for updates
 */
export const formatUpdateDetails = (oldData: any, newData: any) => {
    return {
        previous: oldData,
        updated: newData
    };
};
