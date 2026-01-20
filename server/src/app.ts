import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { globalErrorHandler } from './middlewares/error.middleware';
import { AppError } from './utils/AppError';
import adminRouter from './routes/admin.routes';

import authRouter from './routes/auth.routes';
import walletRouter from './routes/wallet.routes';
import kbankRouter from './routes/kbank.routes';

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:3000',
        'https://elixopay.com',
        'https://www.elixopay.com',
        'https://elixopay-com.onrender.com'
    ],
    credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users/wallet', walletRouter);
app.use('/api/v1/kbank', kbankRouter);
app.use('/api/v1/admin', adminRouter);

// 404 Handler
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
