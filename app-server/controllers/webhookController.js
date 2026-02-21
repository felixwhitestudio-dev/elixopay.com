const db = require('../config/database');
const stripeService = require('../utils/stripe');
const { accrueCommissionForPayment } = require('../utils/ledger');
const { sendEmail } = require('../utils/email');
const { sendWebhook } = require('../utils/webhook');

/**
 * Helper to log audit events safely
 */
async function logAudit({ userId, action, entityId, entityType, details, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_id, entity_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityId, entityType, details, ip || 'system']
    );
  } catch (err) {
    // Audit logging should not break the flow, just log error
    console.error('⚠️ Failed to write audit log:', err.message);
  }
}

/**
 * @route   POST /api/v1/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe only)
 */
exports.handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    // Verify webhook signature
    const verificationResult = stripeService.verifyWebhookSignature(
      req.body, // Raw body buffer
      signature
    );

    if (!verificationResult.success) {
      console.error('Webhook signature verification failed:', verificationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Webhook signature verification failed'
      });
    }

    const event = verificationResult.data;
    console.log('✅ Stripe Webhook Event:', event.type);

    // Log webhook to database
    await db.query(
      `INSERT INTO webhook_logs (
        provider,
        event_type,
        event_id,
        payload,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      ['stripe', event.type, event.id, JSON.stringify(event.data), 'received']
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      case 'payment_intent.created':
        console.log('Payment Intent Created:', event.data.object.id);
        break;

      case 'charge.succeeded':
        console.log('Charge Succeeded:', event.data.object.id);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Update webhook log status to processed
    await db.query(
      `UPDATE webhook_logs 
       SET status = $1, processed_at = CURRENT_TIMESTAMP
       WHERE event_id = $2`,
      ['processed', event.id]
    );

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);

    // Log error to database
    try {
      await db.query(
        `INSERT INTO webhook_logs (
          provider,
          event_type,
          event_id,
          payload,
          status,
          error_message,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          'stripe',
          'unknown',
          'error',
          JSON.stringify(req.body),
          'failed',
          error.message
        ]
      );
    } catch (dbError) {
      console.error('Failed to log webhook error:', dbError);
    }

    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
};

/**
 * @route   POST /api/v1/webhooks/kbank
 * @desc    Handle KBank webhook events
 * @access  Public (KBank IP Whitelist usually)
 */
exports.handleKBankWebhook = async (req, res) => {
  try {
    console.log('🔔 KBank Webhook Received:', req.body);

    // In production, we should verify signature or source IP
    const { partnerTxnUid, statusCode, txnStatus } = req.body;

    // Log raw webhook
    await db.query(
      `INSERT INTO webhook_logs (provider, event_type, event_id, payload, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      ['kbank', 'payment_status', partnerTxnUid, JSON.stringify(req.body), 'received']
    );

    if (statusCode !== '00') {
      console.warn('⚠️ KBank Webhook: Transaction failed or cancelled', req.body);
      return res.json({ success: true }); // Acknowledge receipt even if failed
    }

    // Map partnerTxnUid back to our payment txn
    // We stored partnerTxnUid as payment_intent_id in paymentController
    const result = await db.query(
      `SELECT id, user_id, amount, currency, status FROM payments WHERE payment_intent_id = $1`,
      [partnerTxnUid]
    );

    if (result.rows.length === 0) {
      console.error('❌ Payment not found for KBank txn:', partnerTxnUid);
      return res.json({ success: true });
    }

    const payment = result.rows[0];

    if (payment.status === 'completed') {
      console.log('ℹ️ Payment already completed:', payment.id);
      return res.json({ success: true });
    }

    // Update Status
    await db.query(
      `UPDATE payments SET status = 'completed', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [payment.id]
    );

    console.log(`✅ Updated KBank payment ${payment.id} to completed`);

    // --- Post-Payment Actions (Reusing logic from Stripe handler) ---
    // 1. Send Email
    const userRes = await db.query('SELECT email FROM users WHERE id = $1', [payment.user_id]);
    const user = userRes.rows[0];
    if (user && user.email) {
      await sendEmail(user.email, 'Payment Received (PromptPay)',
        `<h3>Payment Succeeded</h3><p>Received ${payment.amount} ${payment.currency} via PromptPay.</p>`);
    }

    // 2. Accrue Commission
    try {
      await accrueCommissionForPayment({
        userId: payment.user_id, paymentId: payment.id, amount: payment.amount, currency: payment.currency,
        description: `Commission for PromptPay payment ${payment.id}`
      });
    } catch (e) {
      console.warn('Commission error:', e.message);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('KBank Webhook Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log('💰 Payment Intent Succeeded:', paymentIntent.id);

    // Update payment status in database
    const result = await db.query(
      `UPDATE payments 
       SET status = $1, 
           settled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_intent_id = $2
       RETURNING id, user_id, amount, currency`,
      ['succeeded', paymentIntent.id]
    );

    if (result.rows.length > 0) {
      const payment = result.rows[0];
      console.log(`✅ Updated payment ${payment.id} to succeeded`);

      // 1. Fetch User & Webhook Config
      const userRes = await db.query('SELECT email FROM users WHERE id = $1', [payment.user_id]);
      const user = userRes.rows[0];

      // 2. Send email notification
      if (user && user.email) {
        await sendEmail(
          user.email,
          'Payment Received - Elixopay',
          `<h3>Payment Succeeded</h3>
           <p>You received <strong>${payment.amount} ${payment.currency}</strong></p>
           <p>ID: ${payment.id}</p>
           <p>Status: Succeeded</p>`
        );
      }

      // 3. Trigger Post-Payment Webhook (if configured)
      const whRes = await db.query(
        `SELECT url, id, enabled_events FROM webhook_endpoints 
         WHERE user_id = $1 AND is_active = true`,
        [payment.user_id]
      );

      // Check if user has a webhook that subscribes to payment.succeeded (or all)
      for (const endpoint of whRes.rows) {
        // Simple check: if enabled_events implies it (assuming array of strings)
        if (!endpoint.enabled_events || endpoint.enabled_events.includes('payment.succeeded') || endpoint.enabled_events.includes('*')) {
          sendWebhook(endpoint.url, 'payment.succeeded', {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: 'succeeded',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 4. Add audit log
      await logAudit({
        userId: payment.user_id,
        action: 'payment_received',
        entityId: payment.id,
        entityType: 'payment',
        details: { amount: payment.amount, currency: payment.currency, paymentIntent: paymentIntent.id }
      });

      // Accrue commission for the user's primary agency (best-effort, non-blocking)
      try {
        const acc = await accrueCommissionForPayment({
          userId: payment.user_id,
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          description: `Commission for payment ${payment.id}`,
        });
        if (!acc.success) {
          console.warn('⚠️ Commission accrual skipped/failed:', acc.error || acc.message);
        } else if (acc.data) {
          console.log(`📈 Commission accrued: ${acc.data.commissionAmt} ${payment.currency} at ${acc.data.percent * 100}%`);
        }
      } catch (e) {
        console.warn('⚠️ Commission accrual error:', e.message);
      }
    } else {
      console.warn(`⚠️  Payment not found for payment_intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error('Error handling payment_intent.succeeded:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log('❌ Payment Intent Failed:', paymentIntent.id);

    // Update payment status in database
    const result = await db.query(
      `UPDATE payments 
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_intent_id = $2
       RETURNING id, user_id, amount, currency`,
      ['failed', paymentIntent.id]
    );

    if (result.rows.length > 0) {
      const payment = result.rows[0];
      console.log(`✅ Updated payment ${payment.id} to failed`);

      // 1. Fetch User
      const userRes = await db.query('SELECT email FROM users WHERE id = $1', [payment.user_id]);
      const user = userRes.rows[0];

      // 2. Send failure notification email
      if (user && user.email) {
        await sendEmail(
          user.email,
          'Payment Failed - Elixopay',
          `<h3>Payment Failed</h3>
           <p>A payment of <strong>${payment.amount} ${payment.currency}</strong> failed.</p>
           <p>ID: ${payment.id}</p>
           <p>Reason: ${paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'Unknown'}</p>`
        );
      }

      // 3. Add audit log
      await logAudit({
        userId: payment.user_id,
        action: 'payment_failed',
        entityId: payment.id,
        entityType: 'payment',
        details: { reason: paymentIntent.last_payment_error }
      });

    } else {
      console.warn(`⚠️  Payment not found for payment_intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    console.log('🚫 Payment Intent Canceled:', paymentIntent.id);

    // Update payment status in database
    const result = await db.query(
      `UPDATE payments 
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_intent_id = $2
       RETURNING id, user_id, amount, currency`,
      ['cancelled', paymentIntent.id]
    );

    if (result.rows.length > 0) {
      const payment = result.rows[0];
      console.log(`✅ Updated payment ${payment.id} to cancelled`);

      // Add audit log
      await logAudit({
        userId: payment.user_id,
        action: 'payment_cancelled',
        entityId: payment.id,
        entityType: 'payment',
        details: { paymentIntent: paymentIntent.id }
      });
    } else {
      console.warn(`⚠️  Payment not found for payment_intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error('Error handling payment_intent.canceled:', error);
    throw error;
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge) {
  try {
    console.log('💸 Charge Refunded:', charge.id);

    // Get payment intent from charge
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      console.warn('⚠️  No payment_intent found in charge object');
      return;
    }

    // Calculate refund amount
    const refundAmount = charge.amount_refunded / 100; // Convert from cents

    // Update payment status in database
    const result = await db.query(
      `UPDATE payments 
       SET status = $1,
           refund_amount = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_intent_id = $3
       RETURNING id, user_id, amount, currency`,
      ['refunded', refundAmount, paymentIntentId]
    );

    if (result.rows.length > 0) {
      const payment = result.rows[0];
      console.log(`✅ Updated payment ${payment.id} to refunded`);

      // 1. Fetch User
      const userRes = await db.query('SELECT email FROM users WHERE id = $1', [payment.user_id]);
      const user = userRes.rows[0];

      // 2. Send refund notification email
      if (user && user.email) {
        await sendEmail(
          user.email,
          'Payment Refunded - Elixopay',
          `<h3>Payment Refunded</h3>
           <p>A refund of <strong>${refundAmount} ${payment.currency}</strong> has been processed.</p>
           <p>Payment ID: ${payment.id}</p>`
        );
      }

      // 3. Add audit log
      await logAudit({
        userId: payment.user_id,
        action: 'payment_refunded',
        entityId: payment.id,
        entityType: 'payment',
        details: { refundAmount, chargeId: charge.id }
      });

    } else {
      console.warn(`⚠️  Payment not found for payment_intent: ${paymentIntentId}`);
    }
  } catch (error) {
    console.error('Error handling charge.refunded:', error);
    throw error;
  }
}

/**
 * @route   GET /api/v1/webhooks/logs
 * @desc    Get webhook logs
 * @access  Private (Admin)
 */
exports.getWebhookLogs = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, status, provider = 'stripe' } = req.query;

    let query = `
      SELECT 
        id,
        provider,
        event_type,
        event_id,
        status,
        error_message,
        created_at,
        processed_at
      FROM webhook_logs
      WHERE provider = $1
    `;

    const params = [provider];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    const countQuery = status
      ? 'SELECT COUNT(*) FROM webhook_logs WHERE provider = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM webhook_logs WHERE provider = $1';
    const countParams = status ? [provider, status] : [provider];
    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/webhooks/test
 * @desc    Test webhook endpoint
 * @access  Public
 */
exports.testWebhook = (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
};
