import express from 'express';
import * as checkoutController from '../controllers/checkout.controller';

const router = express.Router();

import { verifyIdempotency } from '../middlewares/idempotency.middleware';

/**
 * Public routes for Merchants using API Keys
 * Note: These routes do NOT use the standard JWT `protect` middleware,
 * because authentication is handled via the Bearer API Key inside the controller.
 */
router.post('/payments', verifyIdempotency, checkoutController.createPayment);
router.get('/payments/:id', checkoutController.getPaymentStatus);
router.post('/payments/:id/refund', verifyIdempotency, checkoutController.refundPayment);

// Public Checkout UI Routes
router.get('/:id', checkoutController.getCheckoutDetails);
router.post('/:id/simulate-pay', checkoutController.simulatePaymentCompletion);

export default router;
