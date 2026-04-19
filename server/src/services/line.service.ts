import { Client, WebhookEvent, MessageAPIResponseBase, TextMessage, FlexMessage, FlexBubble } from '@line/bot-sdk';
import logger from '../utils/logger';
import { AIService } from './ai.service';

/**
 * LINE Messaging Service
 * 
 * Handles incoming webhook events, parses messages, 
 * and sends AI-generated replies back to users.
 * Supports text messages and rich Flex Messages.
 */
export class LINEService {
    private static config = {
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
        channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    };

    private static client = new Client(this.config);

    /**
     * Entry point for all LINE webhook events.
     */
    static async handleEvents(events: WebhookEvent[]): Promise<MessageAPIResponseBase[]> {
        return Promise.all(events.map((event) => this.processEvent(event)));
    }

    /**
     * Processes a single LINE event (Follow, Message, etc.)
     */
    public static async processEvent(event: WebhookEvent): Promise<any> {
        if (event.type !== 'message') {
            logger.info(`[LINEService] Skipping unhandled event type: ${event.type}`);
            return null;
        }

        const userId = event.source.userId || 'unknown';

        // ═══════════════════════════════════════════════════════════
        // 🖼️ Handle IMAGE messages (e.g. payment slips)
        // ═══════════════════════════════════════════════════════════
        if (event.message.type === 'image') {
            logger.info(`[LINEService] 🖼️ Received image from ${userId}`);

            try {
                // 1. Download image from LINE
                const imageBase64 = await this.downloadImageAsBase64(event.message.id);

                if (!imageBase64) {
                    await this.pushMessage(userId, 'ขอโทษนะคะ มะลิไม่สามารถอ่านรูปนี้ได้ค่ะ ลองส่งใหม่อีกครั้งนะคะ');
                    return null;
                }

                // 2. Send to AI with vision capability
                const aiReply = await AIService.analyzeImage(userId, imageBase64);

                // 3. Push the analysis result
                if (aiReply) {
                    logger.info(`[LINEService] 🤖 Image Analysis Ready`);
                    await this.pushMessage(userId, aiReply);
                }

                return { success: true };

            } catch (err: any) {
                logger.error(`[LINEService] ❌ Failed to process image:`, {
                    error: err.message,
                    details: err.originalError?.response?.data || err
                });
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════
        // 💬 Handle TEXT messages
        // ═══════════════════════════════════════════════════════════
        if (event.message.type !== 'text') {
            logger.info(`[LINEService] Skipping unsupported message type: ${event.message.type}`);
            return null;
        }

        const userText = event.message.text;
        logger.info(`[LINEService] Received message from ${userId}: "${userText}"`);

        try {
            // 🧠 Send to AIService for brain processing
            const aiReply = await AIService.generateResponse(userId, userText);

            // 📨 Push the AI answer
            if (aiReply) {
                logger.info(`[LINEService] 🤖 AI Response: "${aiReply}"`);
                await this.pushMessage(userId, aiReply);
            }

            return { success: true };

        } catch (err: any) {
            logger.error(`[LINEService] ❌ Failed to process LINE event:`, {
                error: err.message,
                details: err.originalError?.response?.data || err
            });
            
            return null;
        }
    }

    /**
     * Download an image from LINE and convert to base64
     */
    private static async downloadImageAsBase64(messageId: string): Promise<string | null> {
        try {
            const stream = await this.client.getMessageContent(messageId);
            const chunks: Buffer[] = [];

            return new Promise((resolve, reject) => {
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const base64 = buffer.toString('base64');
                    logger.info(`[LINEService] 🖼️ Image downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);
                    resolve(base64);
                });
                stream.on('error', (err: Error) => {
                    logger.error(`[LINEService] ❌ Image download failed:`, err);
                    reject(err);
                });
            });
        } catch (err) {
            logger.error(`[LINEService] ❌ Failed to get image content:`, err);
            return null;
        }
    }

    /**
     * Helper to push a direct text message (not as a reply)
     */
    static async pushMessage(to: string, text: string) {
        if (!this.config.channelAccessToken) {
            logger.warn(`[LINEService] Missing Channel Token, skipping push message.`);
            return;
        }
        
        try {
            await this.client.pushMessage(to, { type: 'text', text });
            logger.info(`[LINEService] Pushed message to ${to}`);
        } catch (err) {
            logger.error(`[LINEService] Push message failed:`, err);
        }
    }

    /**
     * Show a typing indicator ("..." animation) in the chat
     * Uses LINE's Display Loading Animation API
     * The animation automatically stops when a message is sent
     */
    static async showLoadingAnimation(chatId: string) {
        try {
            const response = await fetch('https://api.line.me/v2/bot/chat/loading', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.channelAccessToken}`,
                },
                body: JSON.stringify({
                    chatId,
                    loadingSeconds: 20, // Max 60, will stop when message is pushed
                }),
            });

            if (!response.ok) {
                logger.warn(`[LINEService] Loading animation failed: ${response.status}`);
            }
        } catch (err) {
            // Non-critical — if it fails, user just won't see the animation
            logger.warn(`[LINEService] Loading animation error:`, err);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🎨 Flex Message Builders (Rich Card Messages)
    // ═══════════════════════════════════════════════════════════

    /**
     * Push a Flex Message (Rich Card) to a user
     */
    static async pushFlexMessage(to: string, altText: string, bubble: FlexBubble) {
        if (!this.config.channelAccessToken) {
            logger.warn(`[LINEService] Missing Channel Token, skipping flex message.`);
            return;
        }

        try {
            const flexMessage: FlexMessage = {
                type: 'flex',
                altText,
                contents: bubble,
            };
            await this.client.pushMessage(to, flexMessage);
            logger.info(`[LINEService] Pushed flex message to ${to}`);
        } catch (err) {
            logger.error(`[LINEService] Flex message push failed:`, err);
        }
    }

    /**
     * Build a Payment Status Flex Bubble
     */
    static buildPaymentStatusBubble(data: {
        id: number;
        amount: string | number;
        status: string;
        type: string;
        method: string;
        date: string;
        merchantName: string;
    }): FlexBubble {
        const statusColor = data.status === 'COMPLETED' ? '#2ECC71' 
            : data.status === 'PENDING' ? '#F39C12' 
            : '#E74C3C';
        
        const statusEmoji = data.status === 'COMPLETED' ? '✅' 
            : data.status === 'PENDING' ? '⏳' 
            : '❌';

        const statusText = data.status === 'COMPLETED' ? 'สำเร็จ'
            : data.status === 'PENDING' ? 'รอดำเนินการ'
            : 'ล้มเหลว';

        return {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '💳 สถานะการชำระเงิน',
                        weight: 'bold',
                        size: 'md',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: '#1A1A2E',
                paddingAll: '15px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'สถานะ', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: `${statusEmoji} ${statusText}`, size: 'sm', weight: 'bold', color: statusColor, flex: 3, align: 'end' },
                        ],
                    },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'md',
                        contents: [
                            { type: 'text', text: 'จำนวนเงิน', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: `฿${Number(data.amount).toLocaleString()}`, size: 'sm', weight: 'bold', flex: 3, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'sm',
                        contents: [
                            { type: 'text', text: 'ประเภท', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: data.type, size: 'sm', flex: 3, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'sm',
                        contents: [
                            { type: 'text', text: 'ช่องทาง', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: data.method, size: 'sm', flex: 3, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'sm',
                        contents: [
                            { type: 'text', text: 'เลขที่', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: `#${data.id}`, size: 'sm', flex: 3, align: 'end' },
                        ],
                    },
                ],
                paddingAll: '15px',
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `ร้านค้า: ${data.merchantName}`,
                        size: 'xs',
                        color: '#AAAAAA',
                        align: 'center',
                    },
                ],
                paddingAll: '10px',
            },
            styles: {
                body: { separator: false },
            },
        } as FlexBubble;
    }

    /**
     * Build a Wallet Balance Flex Bubble
     */
    static buildWalletBubble(data: {
        merchantName: string;
        merchantId: string;
        balance: string | number;
        currency: string;
        kycStatus: string;
    }): FlexBubble {
        const kycColor = data.kycStatus === 'verified' ? '#2ECC71' 
            : data.kycStatus === 'pending' ? '#F39C12' 
            : '#E74C3C';

        const kycText = data.kycStatus === 'verified' ? '✅ ยืนยันแล้ว'
            : data.kycStatus === 'pending' ? '⏳ รอตรวจสอบ'
            : '❌ ยังไม่ยืนยัน';

        return {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '👛 ยอดเงินคงเหลือ',
                        weight: 'bold',
                        size: 'md',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: '#16213E',
                paddingAll: '15px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `฿${Number(data.balance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                        size: 'xxl',
                        weight: 'bold',
                        align: 'center',
                        color: '#2ECC71',
                    },
                    {
                        type: 'text',
                        text: data.currency,
                        size: 'xs',
                        color: '#AAAAAA',
                        align: 'center',
                        margin: 'xs',
                    },
                    { type: 'separator', margin: 'lg' },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'md',
                        contents: [
                            { type: 'text', text: 'ร้านค้า', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: data.merchantName, size: 'sm', flex: 3, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'sm',
                        contents: [
                            { type: 'text', text: 'รหัส', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: data.merchantId, size: 'sm', flex: 3, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'sm',
                        contents: [
                            { type: 'text', text: 'KYC', size: 'sm', color: '#999999', flex: 2 },
                            { type: 'text', text: kycText, size: 'sm', color: kycColor, flex: 3, align: 'end' },
                        ],
                    },
                ],
                paddingAll: '15px',
            },
        } as FlexBubble;
    }

    /**
     * Build a Transactions List Flex Bubble (shows up to 5 transactions)
     */
    static buildTransactionListBubble(transactions: Array<{
        id: number;
        amount: string | number;
        type: string;
        status: string;
        method: string;
        date: string | Date;
    }>): FlexBubble {
        const rows: any[] = [];

        for (const tx of transactions.slice(0, 5)) {
            const statusEmoji = tx.status === 'COMPLETED' ? '✅' 
                : tx.status === 'PENDING' ? '⏳' 
                : '❌';
            
            const date = new Date(tx.date).toLocaleDateString('th-TH', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            rows.push({
                type: 'box',
                layout: 'horizontal',
                margin: 'md',
                contents: [
                    { type: 'text', text: `${statusEmoji} ${tx.type}`, size: 'xs', flex: 3 },
                    { type: 'text', text: `฿${Number(tx.amount).toLocaleString()}`, size: 'xs', weight: 'bold', flex: 2, align: 'end' },
                    { type: 'text', text: date, size: 'xs', color: '#999999', flex: 3, align: 'end' },
                ],
            });
        }

        return {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `📊 รายการล่าสุด (${transactions.length} รายการ)`,
                        weight: 'bold',
                        size: 'md',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: '#0F3460',
                paddingAll: '15px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    // Table Header
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'รายการ', size: 'xs', color: '#AAAAAA', weight: 'bold', flex: 3 },
                            { type: 'text', text: 'จำนวน', size: 'xs', color: '#AAAAAA', weight: 'bold', flex: 2, align: 'end' },
                            { type: 'text', text: 'วันที่', size: 'xs', color: '#AAAAAA', weight: 'bold', flex: 3, align: 'end' },
                        ],
                    },
                    { type: 'separator', margin: 'sm' },
                    ...rows,
                ],
                paddingAll: '15px',
            },
        } as FlexBubble;
    }
}
