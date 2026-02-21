import { Router } from 'express';
import { BBLController } from '../controllers/bbl.controller';

const router = Router();

// Endpoint: POST /api/v1/bbl/webhook
router.post('/webhook', BBLController.handleWebhook);

export default router;
