import logger from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export class WebhookService {
    /**
     * Create a new webhook endpoint for a merchant
     */
    static async createEndpoint(userId: number, url: string, events: string[]) {
        // Generate a random high-entropy secret for signing payloads
        const secret = crypto.randomBytes(32).toString('hex');
        const eventsJson = JSON.stringify(events);

        return await prisma.webhookEndpoint.create({
            data: {
                userId,
                url,
                secret,
                events: eventsJson
            }
        });
    }

    /**
     * List all webhook endpoints for a merchant
     */
    static async listEndpoints(userId: number) {
        const endpoints = await prisma.webhookEndpoint.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return endpoints.map(ep => ({
            ...ep,
            events: JSON.parse(ep.events || '[]')
        }));
    }

    /**
     * Delete a webhook endpoint
     */
    static async deleteEndpoint(userId: number, endpointId: string) {
        const endpoint = await prisma.webhookEndpoint.findFirst({
            where: { id: endpointId, userId }
        });

        if (!endpoint) {
            throw new AppError('Webhook endpoint not found', 404);
        }

        await prisma.webhookEndpoint.delete({
            where: { id: endpointId }
        });

        return true;
    }

    /**
     * Dispatch an event to all subscribed endpoints for a specific merchant
     * @param userId The merchant's user ID
     * @param eventType e.g., "payment.success"
     * @param payload The data to send
     */
    static async dispatchEvent(userId: number, eventType: string, payload: any) {
        const endpoints = await prisma.webhookEndpoint.findMany({
            where: { userId, isActive: true }
        });

        for (const ep of endpoints) {
            try {
                const subscribedEvents = JSON.parse(ep.events || '[]');
                if (subscribedEvents.includes('*') || subscribedEvents.includes(eventType)) {
                    await this.sendToEndpoint(ep.url, ep.secret, eventType, payload);
                }
            } catch (error) {
                logger.error(`Failed to parse events for webhook ${ep.id}`, error);
            }
        }
    }

    /**
     * Send the actual HTTP request to the merchant's server securely
     */
    private static async sendToEndpoint(url: string, secret: string, eventType: string, data: any) {
        const payload = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data
        });

        // Sign the payload using HMAC SHA-256 so the merchant can verify it came from us
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Elixopay-Signature': signature,
                    'Elixopay-Event': eventType
                },
                timeout: 5000 // 5 seconds max
            });
            logger.info(`[Webhook] Successfully dispatched ${eventType} to ${url}`);
        } catch (error: any) {
            logger.error(`[Webhook] Failed to dispatch ${eventType} to ${url}: ${error.message}`);
            // In a production environment, we should queue failed webhooks for automatic retries
        }
    }
}
