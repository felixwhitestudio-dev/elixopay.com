import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars — try multiple locations for flexibility
const envPaths = [
    path.resolve(process.cwd(), '.env'),          // /var/www/elixopay-api/.env (production)
    path.resolve(__dirname, '../../.env'),          // ../../.env from dist/ (local dev)
    path.resolve(__dirname, '../.env'),             // ../.env fallback
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`[ENV] Loaded from: ${envPath}`);
        break;
    }
}

import app from './app';
import { initCronJobs } from './services/cron.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Working Directory: ${process.cwd()}`);

    // Initialize scheduled background tasks (e.g. Subscriptions)
    initCronJobs();
});
