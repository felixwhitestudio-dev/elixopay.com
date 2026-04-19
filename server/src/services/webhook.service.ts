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
     * Includes retry with exponential backoff (3 attempts)
     */
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAYS = [0, 2000, 4000]; // 0s, 2s, 4s

    private static async sendToEndpoint(url: string, secret: string, eventType: string, data: any) {
        const payload = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data
        });

        // Sign the payload using HMAC SHA-256 so the merchant can verify it came from us
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                // Wait before retry (exponential backoff)
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAYS[attempt]));
                    logger.info(`[Webhook] Retry attempt ${attempt + 1}/${this.MAX_RETRIES} for ${eventType} to ${url}`);
                }

                const response = await axios.post(url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Elixopay-Signature': signature,
                        'Elixopay-Event': eventType,
                        'Elixopay-Delivery-Attempt': String(attempt + 1),
                    },
                    timeout: 10000, // 10 seconds
                    validateStatus: (status) => status >= 200 && status < 300,
                });

                logger.info(`[Webhook] ✅ Delivered ${eventType} to ${url} (attempt ${attempt + 1})`);
                return; // Success — exit

            } catch (error: any) {
                const status = error.response?.status || 'NETWORK_ERROR';
                logger.warn(`[Webhook] ❌ Attempt ${attempt + 1}/${this.MAX_RETRIES} failed for ${eventType} to ${url}: ${status} — ${error.message}`);

                if (attempt === this.MAX_RETRIES - 1) {
                    logger.error(`[Webhook] 🚨 All ${this.MAX_RETRIES} retries exhausted for ${eventType} to ${url}. Event dropped.`);
                    // Future: store failed deliveries in a dead-letter queue for manual replay
                }
            }
        }
    }
}

