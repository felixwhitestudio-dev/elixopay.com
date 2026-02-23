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
import path from 'path';

const app = express();
app.set('trust proxy', 1);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'http://localhost:3000',
        'https://elixopay.com',
        'https://www.elixopay.com',
        'https://api.elixopay.com',
        'https://app.elixopay.com',
        'https://elixopay-com.onrender.com'
    ],
    credentials: true
}));
app.use(helmet());
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

// Serve static files (KYC documents)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// 404 Handler
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
