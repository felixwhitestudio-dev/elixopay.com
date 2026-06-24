import express from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import * as stripeConnectController from '../controllers/stripe-connect.controller';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// NOTE: The Stripe webhook route is mounted separately in app.ts
// BEFORE express.json() to preserve the raw body for signature verification.
// ═══════════════════════════════════════════════════════════════════════════════

// Protected routes (require JWT)
router.post('/onboard', protect, stripeConnectController.onboard);
router.get('/status', protect, stripeConnectController.getStatus);
router.post('/refresh-link', protect, stripeConnectController.refreshLink);
router.delete('/disconnect', protect, stripeConnectController.disconnect);
router.get('/payouts', protect, stripeConnectController.getPayouts);

// Admin-only routes
router.post('/payout', protect, restrictTo('admin'), stripeConnectController.createPayout);

export default router;
