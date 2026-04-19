import OpenAI from 'openai';
import logger from '../utils/logger';
import { ChatbotActionService } from './chatbot.action.service';

/**
 * AI Service for Elixopay
 * 
 * Handles interaction with OpenAI API including chat completions 
 * and function calling (tools) for transaction lookups, wallet checks,
 * and human handover.
 */
export class AIService {
    private static openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 15000, // 15 seconds max — fail fast instead of hanging
        maxRetries: 1,  // Only retry once
    });

    /**
     * System prompt defining the persona and instructions for the support bot.
     */
    private static readonly SYSTEM_PROMPT = `คุณชื่อ"มะลิ" เจ้าหน้าที่ Elixopay (Payment Gateway ไทย) พูดสุภาพ ใช้ค่ะ/นะคะ ตอบสั้น 1-2 ประโยค ห้ามบอกว่าเป็น AI

ข้อมูลหลัก:
- ธนาคาร: KBank, BBL, PromptPay QR, บัตร Visa/Mastercard
- ค่าธรรมเนียม: บัตร 3.5%, QR/โอน 1%, ไม่มีรายเดือน, ถอนฟรี
- Settlement: T+2, ถอนขั้นต่ำ 100 บาท
- สมัคร: elixopay.com, KYC 1-3 วัน
- Refund ได้ภายใน 30 วัน, คืน 5-14 วันทำการ
- Support: จ-ศ 09-18น. / support@elixopay.com
- มี REST API, Webhook, Sandbox

กฎ: ตอบสั้นเหมือนแชท ห้ามสร้างข้อมูลปลอม ใช้ tool เมื่อต้องเช็คข้อมูล ถ้าไม่รู้ให้ escalate_to_human`;

    /**
     * Define tools (functions) available to the AI.
     */
    private static readonly TOOLS: any[] = [
        {
            type: "function",
            function: {
                name: "check_payment_status",
                description: "เช็คสถานะการชำระเงิน",
                parameters: {
                    type: "object",
                    properties: {
                        referenceId: { type: "string", description: "รหัสอ้างอิง เช่น API-12345" },
                    },
                    required: ["referenceId"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "check_wallet_balance",
                description: "เช็คยอดเงินคงเหลือร้านค้า",
                parameters: {
                    type: "object",
                    properties: {
                        identifier: { type: "string", description: "อีเมลหรือ Merchant ID" },
                    },
                    required: ["identifier"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "get_recent_transactions",
                description: "ดูรายการล่าสุดของร้านค้า",
                parameters: {
                    type: "object",
                    properties: {
                        identifier: { type: "string", description: "อีเมลหรือ Merchant ID" },
                        limit: { type: "number", description: "จำนวนรายการ (1-10)" },
                    },
                    required: ["identifier"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "escalate_to_human",
                description: "ส่งต่อเจ้าหน้าที่เมื่อตอบไม่ได้หรือเรื่องเร่งด่วน",
                parameters: {
                    type: "object",
                    properties: {
                        reason: { type: "string", description: "สาเหตุ" },
                        conversationSummary: { type: "string", description: "สรุปการสนทนา" },
                    },
                    required: ["reason", "conversationSummary"],
                },
            },
        },
    ];

    // ── Conversation Memory ──────────────────────────────────
    // In-memory store: userId → { messages[], lastActive }
    // Keeps last 10 messages (5 pairs) per user, expires after 30 min
    private static conversationHistory = new Map<string, {
        messages: Array<{ role: string; content: string }>;
        lastActive: number;
    }>();

    private static readonly MAX_HISTORY = 10; // 5 user + 5 assistant messages
    private static readonly HISTORY_TTL = 30 * 60 * 1000; // 30 minutes

    /**
     * Get or create conversation history for a user
     */
    private static getHistory(userId: string): Array<{ role: string; content: string }> {
        const entry = this.conversationHistory.get(userId);
        if (!entry || Date.now() - entry.lastActive > this.HISTORY_TTL) {
            // Expired or new — start fresh
            this.conversationHistory.set(userId, { messages: [], lastActive: Date.now() });
            return [];
        }
        entry.lastActive = Date.now();
        return entry.messages;
    }

    /**
     * Add a message to conversation history
     */
    private static addToHistory(userId: string, role: string, content: string) {
        const entry = this.conversationHistory.get(userId);
        if (!entry) return;

        entry.messages.push({ role, content });

        // Keep only last N messages
        if (entry.messages.length > this.MAX_HISTORY) {
            entry.messages = entry.messages.slice(-this.MAX_HISTORY);
        }
        entry.lastActive = Date.now();
    }

    /**
     * Clean up expired conversations (call periodically)
     */
    private static cleanupHistory() {
        const now = Date.now();
        for (const [userId, entry] of this.conversationHistory.entries()) {
            if (now - entry.lastActive > this.HISTORY_TTL) {
                this.conversationHistory.delete(userId);
            }
        }
    }

    /**
     * Execute a tool call and return the result
     */
    private static async executeTool(userId: string, toolCall: any): Promise<string> {
        const functionCall = toolCall.function;
        const args = JSON.parse(functionCall.arguments);

        switch (functionCall.name) {
            case "check_payment_status": {
                const result = await ChatbotActionService.getPaymentStatus(args.referenceId);
                return JSON.stringify(result);
            }
            case "check_wallet_balance": {
                const result = await ChatbotActionService.getWalletBalance(args.identifier);
                return JSON.stringify(result);
            }
            case "get_recent_transactions": {
                const result = await ChatbotActionService.getRecentTransactions(args.identifier, args.limit || 5);
                return JSON.stringify(result);
            }
            case "escalate_to_human": {
                const result = await ChatbotActionService.escalateToHuman(userId, args.reason, args.conversationSummary);
                return JSON.stringify(result);
            }
            default: {
                logger.warn(`[AIService] Unknown tool call: ${functionCall.name}`);
                return JSON.stringify({ success: false, message: "Unknown tool" });
            }
        }
    }

    /**
     * Generate a response based on user input, handling tool calls if necessary.
     * Now includes conversation history for context.
     */
    static async generateResponse(userId: string, userMessage: string) {
        try {
            logger.info(`[AIService] Generating response for user ${userId}`);

            // Cleanup old conversations periodically
            if (Math.random() < 0.1) this.cleanupHistory(); // 10% chance per call

            // Build messages with conversation history
            const history = this.getHistory(userId);
            this.addToHistory(userId, 'user', userMessage);

            const messages: any[] = [
                { role: "system", content: this.SYSTEM_PROMPT },
                ...history,
                { role: "user", content: userMessage }
            ];

            // Initial call to OpenAI
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                max_tokens: 150,
                messages,
                tools: this.TOOLS,
                tool_choice: "auto",
            });

            const responseMessage = response.choices[0].message;

            // Handle Tool Calls
            if (responseMessage.tool_calls) {
                const toolMessages: any[] = [
                    ...messages,
                    responseMessage
                ];

                for (const toolCall of responseMessage.tool_calls) {
                    const result = await this.executeTool(userId, toolCall);
                    
                    toolMessages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        content: result,
                    });
                }

                // Call OpenAI again with the tool's result to get the final answer
                const finalResponse = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    max_tokens: 300,
                    messages: toolMessages as any,
                });

                const reply = finalResponse.choices[0].message.content || '';
                this.addToHistory(userId, 'assistant', reply);
                return reply;
            }

            const reply = responseMessage.content || '';
            this.addToHistory(userId, 'assistant', reply);
            return reply;

        } catch (error: any) {
            logger.error(`[AIService] Error generating response:`, error);
            return "ขอโทษนะคะ ระบบขัดข้องชั่วคราวค่ะ ลองใหม่อีกครั้งนะคะ หรือติดต่อ support@elixopay.com ค่ะ";
        }
    }

    /**
     * Analyze an image (e.g. payment slip) using GPT-4o-mini Vision
     */
    static async analyzeImage(userId: string, imageBase64: string) {
        try {
            logger.info(`[AIService] 🖼️ Analyzing image for user ${userId}`);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                max_tokens: 500,
                messages: [
                    {
                        role: "system",
                        content: `คุณชื่อ "มะลิ" เจ้าหน้าที่ฝ่ายดูแลลูกค้าของ Elixopay (เอลิโซเพย์)
คุณเป็นคนจริงๆ ไม่ใช่ AI พูดจาสุภาพ ใช้ "ค่ะ" และ "นะคะ"

เมื่อได้รับรูปสลิปการโอนเงิน ให้อ่านและสรุปข้อมูลต่อไปนี้:
1. ธนาคารผู้โอน (ถ้าเห็น)
2. ธนาคารผู้รับ (ถ้าเห็น)
3. จำนวนเงิน
4. วันที่และเวลา
5. เลขอ้างอิง/เลขที่รายการ (ถ้าเห็น)
6. ชื่อผู้โอน (ถ้าเห็น — ห้ามแสดงนามสกุลเต็ม ให้แสดงแค่ตัวอักษรแรก)
7. ชื่อผู้รับ (ถ้าเห็น — ห้ามแสดงนามสกุลเต็ม ให้แสดงแค่ตัวอักษรแรก)

สรุปข้อมูลเป็นข้อๆ สั้นๆ ชัดเจน
ถ้ารูปไม่ใช่สลิปโอนเงิน ให้บอกสั้นๆ ว่ารูปนี้คืออะไร และถามว่ามีอะไรให้ช่วยไหม

⚠️ ห้ามยืนยันว่าการโอนเงินสำเร็จหรือเงินเข้าแล้ว ให้แจ้งว่า "มะลิอ่านข้อมูลจากสลิปให้นะคะ แต่ต้องให้ทีมตรวจสอบกับระบบอีกครั้งค่ะ"
⚠️ ห้ามบอกว่าสลิปเป็นของจริงหรือปลอม`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`,
                                    detail: "high"
                                }
                            },
                            {
                                type: "text",
                                text: "ช่วยอ่านข้อมูลจากรูปนี้ให้หน่อยค่ะ"
                            }
                        ]
                    }
                ],
            });

            const reply = response.choices[0].message.content || 'ขอโทษนะคะ มะลิไม่สามารถอ่านรูปนี้ได้ค่ะ';
            this.addToHistory(userId, 'assistant', `[อ่านรูปภาพ] ${reply}`);
            return reply;

        } catch (error: any) {
            logger.error(`[AIService] Error analyzing image:`, error);
            return "ขอโทษนะคะ มะลิไม่สามารถอ่านรูปนี้ได้ค่ะ ลองส่งใหม่อีกครั้ง หรือพิมพ์ข้อมูลมาแทนนะคะ";
        }
    }
}
