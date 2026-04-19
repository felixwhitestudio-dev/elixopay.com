import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { LINEService } from '../services/line.service';
import logger from '../utils/logger';

/**
 * LINE Webhook Controller
 * 
 * Handles HTTP requests from the LINE Servers.
 */
export const handleWebhook = catchAsync(async (req: Request, res: Response) => {
    // 💡 1️. Log the incoming events for audit purposes
    const events = req.body?.events || [];
    
    // Explicitly handle LINE's 'Verify' test (which sends an empty events array)
    if (events.length === 0) {
        logger.info(`[LINEWebhook] 🛡️ Verification (Verify) or empty payload received. Responding 200 OK.`);
        return res.status(200).send('OK');
    }

    logger.info(`[LINEWebhook] 📥 Received Webhook POST with ${events.length} events.`);

    // 💡 2. ⚡️ Let LINEService process each event (AI processing happens inside)
    // We process each event and log success/error
    for (const event of events) {
        logger.info(`[LINEWebhook] Processing event type: ${event.type} from ${event.source?.userId}`);
        
        LINEService.processEvent(event)
            .then(() => logger.info(`[LINEWebhook] ✅ Event ${event.type} processed.`))
            .catch((err) => {
                logger.error(`[LINEWebhook] ❌ Event ${event.type} failed:`, err);
                // We don't throw here to ensure other events in the same batch can still be processed
            });
    }

    // 💡 3. Always return 200 OK to LINE immediately
    res.status(200).send('OK');
});

