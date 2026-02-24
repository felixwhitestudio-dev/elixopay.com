import express from 'express';
import * as billingController from '../controllers/billing.controller';
import { verifyIdempotency } from '../middlewares/idempotency.middleware';

const router = express.Router();

/**
 * Public routes for Merchants using API Keys
 * Auth is handled inside the controllers by extracting the Bearer token.
 */
router.post('/products', verifyIdempotency, billingController.createProduct);
router.post('/prices', verifyIdempotency, billingController.createPrice);
router.post('/customers', verifyIdempotency, billingController.createCustomer);
router.post('/subscriptions', verifyIdempotency, billingController.createSubscription);

export default router;
