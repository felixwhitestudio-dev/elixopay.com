import express from 'express';
import * as webhookController from '../controllers/webhook.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Require authentication for all Webhook management requests
router.use(protect);

router.post('/', webhookController.createEndpoint);
router.get('/', webhookController.getEndpoints);
router.delete('/:id', webhookController.deleteEndpoint);

export default router;
