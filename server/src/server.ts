import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import logger from './utils/logger';

// Load env vars — try multiple locations for flexibility
const envPaths = [
    path.resolve(process.cwd(), '.env'),          // /var/www/elixopay-api/.env (production)
    path.resolve(__dirname, '../../.env'),          // ../../.env from dist/ (local dev)
    path.resolve(__dirname, '../.env'),             // ../.env fallback
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        logger.info(`[ENV] Loaded from: ${envPath}`);
        break;
    }
}

// Initialize Sentry (must happen after env vars are loaded)
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.2, // 20% of transactions for performance monitoring
    });
    logger.info('[Sentry] Error monitoring initialized');
} else {
    logger.warn('[Sentry] SENTRY_DSN not set — error monitoring disabled');
}

import app from './app';
import { initCronJobs } from './services/cron.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Working Directory: ${process.cwd()}`);

    // Initialize scheduled background tasks (e.g. Subscriptions)
    initCronJobs();
});
