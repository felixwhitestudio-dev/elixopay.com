const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validatePayment } = require('../middleware/validators');
const paymentController = require('../controllers/paymentController');

/**
 * @route   GET /api/v1/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get('/stats', authenticate, paymentController.getPaymentStats);

/**
 * @route   GET /api/v1/payments
 * @desc    Get all payments for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, paymentController.getPayments);

/**
 * @route   POST /api/v1/payments
 * @desc    Create a new payment
 * @access  Private
 */
router.post('/', authenticate, paymentController.createPayment);

// Public route for fetching details by token (for checkout page)
router.get('/session/:token', paymentController.getPaymentByToken);

// Public route for Elixopay-hosted checkout page (includes Stripe keys)
router.get('/checkout/:token', paymentController.getCheckoutByToken);

// Private route for paying
router.post('/session/:token/pay', authenticate, paymentController.processPayment);

// Stripe Checkout Session (Hosted Checkout — simplest merchant integration)
router.post('/checkout-session', authenticate, paymentController.createCheckoutSession);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment details
 * @access  Private
 */
router.get('/:id', authenticate, paymentController.getPaymentById);

/**
 * @route   POST /api/v1/payments/:id/confirm
 * @desc    Confirm a payment
 * @access  Private
 */
router.post('/:id/confirm', authenticate, paymentController.confirmPayment);

const paymentActionController = require('../controllers/paymentActionController');

/**
 * @route   POST /api/v1/payments/:id/cancel
 * @desc    Cancel a payment
 * @access  Private
 */
router.post('/:id/cancel', authenticate, paymentActionController.cancelPayment);

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Refund a payment
 * @access  Private
 */
router.post('/:id/refund', authenticate, paymentActionController.refundPayment);

module.exports = router;
