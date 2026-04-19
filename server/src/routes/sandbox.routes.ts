import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Sandbox Info API
 * 
 * Public endpoint for developers to understand the sandbox/test mode.
 * No auth required — this is documentation.
 */
router.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        data: {
            sandbox: {
                description: 'Elixopay Sandbox — ระบบทดสอบการชำระเงิน',
                howToUse: [
                    '1. เข้าสู่ระบบที่ Dashboard แล้วสร้าง API Key แบบ "test"',
                    '2. ใช้ API Key ที่ขึ้นต้นด้วย ep_test_xxx ในการเรียก API',
                    '3. รายการทั้งหมดจะถูกจำลอง ไม่มีการเรียกเก็บเงินจริง',
                    '4. ใช้ endpoint /checkout/:id/simulate-pay เพื่อจำลองการชำระเงินสำเร็จ',
                    '5. เมื่อพร้อมใช้จริง สร้าง API Key แบบ "live" (ep_live_xxx)',
                ],
                testApiKeyPrefix: 'ep_test_',
                liveApiKeyPrefix: 'ep_live_',
                testCards: [
                    { number: '4242 4242 4242 4242', description: 'บัตรที่ชำระสำเร็จ' },
                    { number: '4111 1111 1111 1111', description: 'บัตรที่ถูกปฏิเสธ' },
                    { number: '4000 0000 0000 0002', description: 'บัตรที่หมดอายุ' },
                ],
                testAmounts: {
                    success: 'จำนวนเงินใดก็ได้ (ยกเว้นด้านล่าง)',
                    decline: '999.99 — จำลองการปฏิเสธ',
                    timeout: '888.88 — จำลอง timeout',
                },
                endpoints: {
                    createCharge: 'POST /api/v1/checkout/create (ใช้ X-API-Key: ep_test_xxx)',
                    simulatePay: 'POST /api/v1/checkout/:id/simulate-pay',
                    checkStatus: 'GET /api/v1/payments/:id',
                },
                notes: [
                    'รายการ Sandbox จะไม่ปรากฏในรายงานยอดขายจริง',
                    'Webhook จะถูกส่งตามปกติ แต่ payload จะมี "test": true',
                    'ยอดเงินใน Test Wallet แยกจาก Live Wallet',
                ],
            },
        },
    });
});

export default router;
