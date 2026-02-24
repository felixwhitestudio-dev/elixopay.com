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
 * @route   POST /api/v1/webhooks/kbank
 * @desc    Handle KBank webhook events
 * @access  Public (KBank IP Whitelist)
 */
router.post('/kbank', webhookController.handleKBankWebhook);

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

const db = require('../config/database');
const crypto = require('crypto');

/**
 * @route   GET /api/v1/webhooks
 * @desc    Get all webhooks for authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      'SELECT id, url, enabled_events as events, is_active as status, created_at as "createdAt" FROM webhook_endpoints WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      data: {
        webhooks: result.rows.map(row => ({
          ...row,
          status: row.status ? 'active' : 'inactive'
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * @route   POST /api/v1/webhooks
 * @desc    Create a new webhook
 * @access  Private
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { url, events } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'Webhook URL is required' });
    }

    const id = 'wh_' + crypto.randomBytes(12).toString('hex');
    const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const eventsArray = events && events.length > 0 ? events : ['*'];

    const result = await db.query(
      `INSERT INTO webhook_endpoints (id, user_id, url, secret, enabled_events, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, url, enabled_events as events, is_active as status, created_at as "createdAt"`,
      [id, userId, url, secret, JSON.stringify(eventsArray)]
    );

    const newWebhook = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        webhook: {
          ...newWebhook,
          status: newWebhook.status ? 'active' : 'inactive'
        },
        secret: secret // Reveal secret only once upon generation
      }
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * @route   DELETE /api/v1/webhooks/:id
 * @desc    Delete (deactivate) a webhook
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      'UPDATE webhook_endpoints SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Webhook not found or unauthorized' });
    }

    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
