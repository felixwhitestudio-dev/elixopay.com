import express from 'express';
import * as paymentController from '../controllers/payment.controller';
import * as checkoutController from '../controllers/checkout.controller';
import { protect } from '../middlewares/auth.middleware';
import { requireKyc } from '../middlewares/kyc.middleware';
import { verifyIdempotency } from '../middlewares/idempotency.middleware';

const router = express.Router();

// Public endpoint for merchants to create payment (backward compatibility with docs)
router.post('/', verifyIdempotency, checkoutController.createPayment);

// All layout dashboard routes must be protected with the JWT Auth Cookie
router.use(protect);

// Read-only Routes
router.get('/', paymentController.getPayments);
router.get('/stats', paymentController.getPaymentStats);
router.get('/export/csv', paymentController.exportPaymentsCSV);

// Write/Action Routes (Need KYC + Idempotency)
router.post('/link', requireKyc, verifyIdempotency, paymentController.createPaymentLink);
router.post('/:id/refund', requireKyc, verifyIdempotency, paymentController.refundPayment);

export default router;
