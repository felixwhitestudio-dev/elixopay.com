import express from 'express';
import * as apiKeyController from '../controllers/apikey.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Require authentication for all API Key requests
// Note: KYC check is done per-action in the controller (only enforced for 'live' keys)
router.use(protect);

router.post('/', apiKeyController.createApiKey);
router.get('/', apiKeyController.getApiKeys);
router.delete('/:keyId', apiKeyController.revokeApiKey);

export default router;
