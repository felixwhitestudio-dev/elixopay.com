import express, { Request, Response } from 'express';
import logger from './utils/logger';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { globalErrorHandler } from './middlewares/error.middleware';
import { AppError } from './utils/AppError';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import adminRouter from './routes/admin.routes';

import authRouter from './routes/auth.routes';
import walletRouter from './routes/wallet.routes';
import kbankRouter from './routes/kbank.routes';
import bblRouter from './routes/bbl.routes';
import kycRouter from './routes/kyc.routes';
import bankRouter from './routes/bank.routes';
import apiKeyRouter from './routes/apikey.routes';
import webhookRouter from './routes/webhook.routes';
import checkoutRouter from './routes/checkout.routes';
import billingRouter from './routes/billing.routes';
import paymentRouter from './routes/payment.routes';
import partnerRouter from './routes/partner.routes';
import hierarchyRouter from './routes/hierarchy.routes';
import refundRouter from './routes/refund.routes';
import sandboxRouter from './routes/sandbox.routes';
import notificationRouter from './routes/notification.routes';
import contactRouter from './routes/contact.routes';
import path from 'path';

const app = express();
app.set('trust proxy', 1);

// 🛡️ [PHASE 1] LINE Webhook (Priority Handler)
import * as lineController from './controllers/line.controller';
import crypto from 'crypto';

app.post(['/line', '/api/v1/line/webhook'], express.raw({ type: 'application/json' }), async (req: Request, res: Response, next) => {
    const signature = req.headers['x-line-signature'] as string;
    const body = req.body; // Buffer (because of express.raw)

    // 🛡️ 0. Guard: reject empty/invalid requests (bots, scanners, health checks)
    if (!body || !Buffer.isBuffer(body) || body.length === 0 || !signature) {
        return res.status(200).send('OK');
    }

    // 🛡️ 1. Verification Logic
    const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
    const hash = crypto.createHmac('sha256', channelSecret).update(body).digest('base64');

    if (hash !== signature) {
        logger.error('[LINE_WEBHOOK] ❌ Signature Mismatch!');
        return res.status(200).send('OK'); // Still return 200 to LINE (don't retry)
    }

    // 📥 2. Parse body and pass to controller
    try {
        const bodyJson = JSON.parse(body.toString());
        req.body = bodyJson;
        logger.info(`[LINE_WEBHOOK] ✅ Signature OK. ${bodyJson.events?.length || 0} events.`);
        
        // Controller will handle responding 200 OK
        return lineController.handleWebhook(req as any, res as any, next);
    } catch (e) {
        logger.error('[LINE_WEBHOOK] ❌ Failed to parse body');
        return res.status(200).send('OK');
    }
});

// 🛡️ [PHASE 2] Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        /http:\/\/localhost:\d+/,
        /http:\/\/127\.0\.0\.1:\d+/,
        'https://elixopay.com',
        'https://www.elixopay.com',
        'https://api.elixopay.com',
        'https://app.elixopay.com',
        'https://elixopay-com.onrender.com'
    ],
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://accounts.google.com", "https://cdn.jsdelivr.net", "https://js.stripe.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
            frameSrc: ["'self'", "https://accounts.google.com", "https://js.stripe.com"],
            connectSrc: ["'self'", "https://api.elixopay.com", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://www.googleapis.com", "https://api.stripe.com"],
            imgSrc: ["'self'", "data:", "https:"],
            upgradeInsecureRequests: null,
            scriptSrcAttr: ["'unsafe-inline'"],
        }
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
}));
// Use 'combined' format in production for full request logging, 'dev' for colored console output
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Stricter limit for auth routes (login, register, etc.)
    message: 'Too many authentication attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute per IP for general API
    message: 'Too many requests from this IP, please try again after 1 minute',
    standardHeaders: true,
    legacyHeaders: false,
});

// Per-Merchant Rate Limiting (by API key or user ID)
const merchantLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per merchant
    message: 'Rate limit exceeded for this merchant account. Please try again shortly.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Identify by API key or user ID only — no IP fallback
        const apiKey = req.headers['x-api-key'] as string;
        const userId = (req as any).user?.id;
        return apiKey || (userId ? `user-${userId}` : 'anonymous');
    },
    validate: false, // Disable all validations to prevent IPv6 crash
});

// Health Check (must be before rate limiting — used by Load Balancer)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'elixopay-api',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// Google Search Console verification
app.get('/google33d86f68459996f3.html', (req, res) => {
    res.send('google-site-verification: google33d86f68459996f3.html');
});

// API Documentation (Swagger)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Elixopay API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// Routes
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users/wallet', merchantLimiter, walletRouter);
app.use('/api/v1/kbank', kbankRouter);
app.use('/api/v1/bbl', bblRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/bank', bankRouter);
app.use('/api/v1/apikeys', apiKeyRouter);
app.use('/api/v1/webhooks', webhookRouter);
app.use('/api/v1/checkout', merchantLimiter, checkoutRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/payments', merchantLimiter, paymentRouter);
app.use('/api/v1/partners', partnerRouter);
app.use('/api/v1/hierarchy', hierarchyRouter);
app.use('/api/v1/refund', merchantLimiter, refundRouter);
app.use('/api/v1/sandbox', sandboxRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/contact', contactRouter);

// Serve static files (KYC documents)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve static dashboard files — try production path first, then local dev path
const possibleFrontendPaths = [
    path.join(process.cwd(), 'public'),                  // /var/www/elixopay-api/public (production)
    path.join(__dirname, '../../app-server/public'),      // local dev
];
const frontendPath = possibleFrontendPaths.find(p => require('fs').existsSync(p)) || possibleFrontendPaths[0];
logger.info(`[STATIC] Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Explicit route for the login page to bypass static middleware flakiness
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Explicit route for the index page to bypass static middleware flakiness 
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Explicit route for the dashboard page to bypass static middleware flakiness
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// 404 Handler
app.all(/(.*)/, (req, res, next) => {
    // Root domain → Landing Page
    if (req.originalUrl === '/') {
        return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
