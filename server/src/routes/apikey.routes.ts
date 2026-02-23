import express from 'express';
import * as apiKeyController from '../controllers/apikey.controller';
import { protect } from '../middlewares/auth.middleware';
import { requireKyc } from '../middlewares/kyc.middleware';

const router = express.Router();

// Require authentication and KYC verification for all API Key requests
router.use(protect);
router.use(requireKyc);

router.post('/', apiKeyController.createApiKey);
router.get('/', apiKeyController.getApiKeys);
router.delete('/:keyId', apiKeyController.revokeApiKey);

export default router;
