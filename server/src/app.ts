import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { globalErrorHandler } from './middlewares/error.middleware';
import { AppError } from './utils/AppError';
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
import path from 'path';

const app = express();
app.set('trust proxy', 1);

// Middlewares
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
app.use(morgan('dev'));

// Rate Limiting (General Security)
// Apply specifically to Auth routes to prevent brute-force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Routes
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users/wallet', walletRouter);
app.use('/api/v1/kbank', kbankRouter);
app.use('/api/v1/bbl', bblRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/bank', bankRouter);
app.use('/api/v1/apikeys', apiKeyRouter);
app.use('/api/v1/webhooks', webhookRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/payments', paymentRouter);

// Serve static files (KYC documents)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve static dashboard files — try production path first, then local dev path
const possibleFrontendPaths = [
    path.join(process.cwd(), 'public'),                  // /var/www/elixopay-api/public (production)
    path.join(__dirname, '../../app-server/public'),      // local dev
];
const frontendPath = possibleFrontendPaths.find(p => require('fs').existsSync(p)) || possibleFrontendPaths[0];
console.log(`[STATIC] Serving frontend from: ${frontendPath}`);
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
    // If the request was for an HTML file and it wasn't found, try redirecting to dashboard or login
    if (req.originalUrl === '/' || req.originalUrl === '/index.html') {
        return res.redirect('/login.html');
    }
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
