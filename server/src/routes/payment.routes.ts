import express from 'express';
import * as paymentController from '../controllers/payment.controller';
import { protect } from '../middlewares/auth.middleware';
import { requireKyc } from '../middlewares/kyc.middleware';
import { verifyIdempotency } from '../middlewares/idempotency.middleware';

const router = express.Router();

// All layout dashboard routes must be protected with the JWT Auth Cookie
router.use(protect);

// Read-only Routes
router.get('/', paymentController.getPayments);
router.get('/stats', paymentController.getPaymentStats);

// Write/Action Routes (Need KYC + Idempotency)
router.post('/:id/refund', requireKyc, verifyIdempotency, paymentController.refundPayment);

export default router;
