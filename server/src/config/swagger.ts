import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Elixopay API',
            version: '1.0.0',
            description: 'Elixopay Payment Gateway REST API — ระบบรับชำระเงินออนไลน์สำหรับธุรกิจ',
            contact: {
                name: 'Elixopay Support',
                email: 'support@elixopay.com',
                url: 'https://elixopay.com',
            },
        },
        servers: [
            { url: '/api/v1', description: 'API v1' },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token จาก /auth/login',
                },
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API Key จาก Dashboard → API Keys',
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'สมัคร / เข้าสู่ระบบ / จัดการบัญชี' },
            { name: 'Checkout', description: 'สร้างรายการชำระเงิน' },
            { name: 'Payments', description: 'ดูรายการชำระเงิน' },
            { name: 'Refund', description: 'คืนเงิน' },
            { name: 'Wallet', description: 'กระเป๋าเงิน / ถอนเงิน' },
            { name: 'KYC', description: 'ยืนยันตัวตน' },
            { name: 'Webhooks', description: 'Webhook สำหรับร้านค้า' },
            { name: 'API Keys', description: 'จัดการ API Key' },
            { name: 'Admin', description: 'แอดมิน (เฉพาะ Admin)' },
        ],
        paths: {
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'สมัครสมาชิก',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password', 'firstName', 'lastName'],
                                    properties: {
                                        email: { type: 'string', example: 'merchant@example.com' },
                                        password: { type: 'string', example: 'SecurePass123!' },
                                        firstName: { type: 'string', example: 'สมชาย' },
                                        lastName: { type: 'string', example: 'ใจดี' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'สมัครสำเร็จ' } },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'เข้าสู่ระบบ',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password'],
                                    properties: {
                                        email: { type: 'string', example: 'merchant@example.com' },
                                        password: { type: 'string', example: 'SecurePass123!' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'เข้าสู่ระบบสำเร็จ — ได้รับ JWT token' } },
                },
            },
            '/checkout/create': {
                post: {
                    tags: ['Checkout'],
                    summary: 'สร้างรายการชำระเงิน',
                    security: [{ ApiKeyAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['amount', 'paymentMethod'],
                                    properties: {
                                        amount: { type: 'number', example: 1500.00, description: 'จำนวนเงิน (บาท)' },
                                        paymentMethod: { type: 'string', enum: ['qr', 'card', 'bank_transfer'], example: 'qr' },
                                        orderId: { type: 'string', example: 'ORD-12345', description: 'รหัสคำสั่งซื้อจากร้านค้า' },
                                        webhookUrl: { type: 'string', example: 'https://myshop.com/webhook' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'สร้างรายการสำเร็จ — ได้รับ payment URL หรือ QR code' },
                        '400': { description: 'ข้อมูลไม่ถูกต้อง' },
                    },
                },
            },
            '/payments': {
                get: {
                    tags: ['Payments'],
                    summary: 'ดูรายการชำระเงินทั้งหมด',
                    security: [{ BearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED'] } },
                    ],
                    responses: { '200': { description: 'รายการชำระเงิน' } },
                },
            },
            '/refund': {
                post: {
                    tags: ['Refund'],
                    summary: 'ขอคืนเงิน',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['transactionId', 'amount'],
                                    properties: {
                                        transactionId: { type: 'integer', example: 123 },
                                        amount: { type: 'number', example: 500.00, description: 'จำนวนเงินที่ต้องการคืน' },
                                        reason: { type: 'string', example: 'สินค้ามีปัญหา' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'คืนเงินสำเร็จ' },
                        '400': { description: 'ไม่สามารถคืนเงินได้ (เกิน 30 วัน, ยอดเกิน, ฯลฯ)' },
                    },
                },
                get: {
                    tags: ['Refund'],
                    summary: 'ดูรายการคืนเงินทั้งหมด',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'รายการคืนเงิน' } },
                },
            },
            '/users/wallet': {
                get: {
                    tags: ['Wallet'],
                    summary: 'ดูยอดเงินในกระเป๋า',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'ข้อมูลกระเป๋าเงิน' } },
                },
            },
            '/users/wallet/withdraw': {
                post: {
                    tags: ['Wallet'],
                    summary: 'ถอนเงินเข้าบัญชีธนาคาร',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['amount'],
                                    properties: {
                                        amount: { type: 'number', example: 5000.00, description: 'จำนวนเงินที่ต้องการถอน (ขั้นต่ำ 100 บาท)' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'ถอนเงินสำเร็จ' } },
                },
            },
        },
    },
    apis: [], // We define paths inline above
};

export const swaggerSpec = swaggerJsdoc(options);
