const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const webhookController = require('../controllers/webhookController');

/**
 * @route   POST /api/v1/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe only)
 * @note    This endpoint requires raw body buffer, configured in server.js
 */
router.post('/stripe', webhookController.handleStripeWebhook);

/**
 * @route   GET /api/v1/webhooks/test
 * @desc    Test webhook endpoint
 * @access  Public
 */
router.get('/test', webhookController.testWebhook);

/**
 * @route   GET /api/v1/webhooks/logs
 * @desc    Get webhook logs
 * @access  Private (Admin)
 */
router.get('/logs', authenticate, webhookController.getWebhookLogs);

/**
 * @route   GET /api/v1/webhooks
 * @desc    Get all webhooks
 * @access  Private
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      webhooks: []
    }
  });
});

/**
 * @route   POST /api/v1/webhooks
 * @desc    Create a new webhook
 * @access  Private
 */
router.post('/', authenticate, (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      webhook: {
        id: 'wh_' + Date.now(),
        url: req.body.url,
        events: req.body.events || [],
        status: 'active',
        createdAt: new Date().toISOString()
      }
    }
  });
});

module.exports = router;
