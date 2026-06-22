const { pool } = require('../config/database');
const commissionService = require('../services/commissionService'); // Import service

// ...

// 5. Update Payment Status
// Orphaned code removed to fix top-level await error
const { v4: uuidv4 } = require('uuid');
const stripeService = require('../utils/stripe');
const kbankService = require('../services/kbankService');

// --- Helper: Generate Checkout Token ---
const generateToken = () => {
  return require('crypto').randomBytes(24).toString('hex');
};

/**
 * @route   POST /api/v1/payments
 * @desc    Create a payment session (Merchant API)
 * @access  Private (Merchant Key)
 */
exports.createPayment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { amount, currency, description, return_url, cancel_url, payment_method_type = 'stripe' } = req.body;

    // 1. Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
    }
    if (!currency || currency.toUpperCase() !== 'THB') {
      return res.status(400).json({ success: false, error: { message: 'Only THB is currently supported' } });
    }
    if (!return_url) {
      return res.status(400).json({ success: false, error: { message: 'return_url is required' } });
    }

    // 2. Create Payment Record associated with Merchant (User)
    const token = generateToken();
    const checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/checkout.html?token=${token}`;
    let stripePaymentIntentId = null;
    let stripeClientSecret = null;

    // 3. Create Stripe Payment Intent if needed
    if (payment_method_type === 'stripe') {
      const intentRes = await stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: {
          merchant_id: userId,
          description
        }
      });

      if (!intentRes.success) {
        return res.status(500).json({ success: false, error: { message: 'Stripe error: ' + intentRes.error } });
      }
      stripePaymentIntentId = intentRes.data.id;
      stripeClientSecret = intentRes.data.client_secret;
    }

    // 4. Create KBank QR if needed
    let kbankTxnId = null;
    let kbankQrCode = null;

    if (payment_method_type === 'kbank_qr') {
      try {
        // Use token or generate a specific order ID
        const orderId = `ELIX-${token.substring(0, 10)}`;
        const qrResult = await kbankService.generateQR(amount, orderId, description);

        kbankTxnId = qrResult.txnId;
        kbankQrCode = qrResult.qrCode;

        // We reuse stripe fields for storage to avoid schema migration in this step
        // payment_intent_id -> txnId
        // client_secret -> qrCode
        stripePaymentIntentId = kbankTxnId;
        stripeClientSecret = kbankQrCode;

      } catch (err) {
        console.error('KBank QR Generation Failed:', err);
        return res.status(500).json({ success: false, error: { message: 'Failed to generate QR Code' } });
      }
    }

    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO payments (
                merchant_id, amount, currency, status, token, 
                return_url, cancel_url, description, 
                payment_intent_id, client_secret, payment_method_type,
                created_at
            ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, NOW()) 
            RETURNING id, token, status, amount, currency, payment_intent_id`,
      [userId, amount, currency.toUpperCase(), token, return_url, cancel_url, description, stripePaymentIntentId, stripeClientSecret, payment_method_type]
    );

    await client.query('COMMIT');

    const payment = insertRes.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        token: payment.token,
        checkout_url: checkoutUrl,
        checkout_url: checkoutUrl,
        clientSecret: stripeClientSecret, // Optional, usually frontend gets it via token
        paymentIntentId: payment.payment_intent_id,
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * @route   GET /api/v1/payments/:token
 * @desc    Get payment details for checkout page
 * @access  Public
 */
exports.getPaymentByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT p.id, p.amount, p.currency, p.description, p.status, p.return_url,
                    u.first_name as merchant_name, u.email as merchant_email
             FROM payments p
             JOIN users u ON p.merchant_id = u.id
             WHERE p.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Payment session not found' } });
    }

    const payment = result.rows[0];

    // Don't reveal return_url until paid? Actually frontend needs it for redirect on success.
    // Or maybe only redirect via backend? 
    // Standard flow: Frontend calls 'process' -> Backend Success -> Frontend redirects.

    res.json({
      success: true,
      data: {
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        status: payment.status,
        merchant: {
          name: (payment.merchant_name || 'Merchant')
        },
        clientSecret: payment.client_secret,
        stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY,
        paymentMethodType: payment.payment_method_type || 'stripe',
        // For KBank, clientSecret holds the QR Code string
        qrCode: (payment.payment_method_type === 'kbank_qr') ? payment.client_secret : null
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/payments/:token/process
 * @desc    Process payment (User pays)
 * @access  Private (User logged in)
 */
exports.processPayment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const payerId = req.user.id;

    // 1. Get Payment & Merchant
    const paymentRes = await client.query(
      `SELECT * FROM payments WHERE token = $1`,
      [token]
    );

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Payment not found' } });
    }
    const payment = paymentRes.rows[0];

    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, error: { message: 'Payment already processed' } });
    }

    if (payment.merchant_id === payerId) {
      return res.status(400).json({ success: false, error: { message: 'Cannot pay yourself' } });
    }

    const amount = parseFloat(payment.amount);

    await client.query('BEGIN');

    // 2. Lock Payer Wallet
    const payerWalletRes = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
      [payerId, 'THB']
    );
    const payerWallet = payerWalletRes.rows[0];

    if (!payerWallet || parseFloat(payerWallet.balance) < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: { message: 'Insufficient balance' } });
    }

    // 3. Get Merchant Wallet
    let merchantWalletRes = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
      [payment.merchant_id, 'THB']
    );
    let merchantWallet = merchantWalletRes.rows[0];

    if (!merchantWallet) {
      // Should exist, but create if fail safe
      // simplified for speed
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'Merchant wallet error' } });
    }

    // 4. Transfer
    await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, payerWallet.id]);
    await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [amount, merchantWallet.id]);

    // 5. Update Payment Status
    await client.query('UPDATE payments SET status = $1, payer_id = $2, paid_at = NOW() WHERE id = $3', ['completed', payerId, payment.id]);

    // 6. Logs (using existing Enum types: transfer_in/transfer_out)
    const logDesc = `Payment to ${payment.description || 'Merchant'} (Ref: ${payment.token})`;

    await client.query(
      `INSERT INTO transaction_logs (user_id, wallet_id, type, amount, currency, description, created_at)
             VALUES ($1, $2, 'transfer_out', $3, 'THB', $4, NOW())`,
      [payerId, payerWallet.id, amount, logDesc]
    );

    await client.query(
      `INSERT INTO transaction_logs (user_id, wallet_id, type, amount, currency, description, created_at)
             VALUES ($1, $2, 'transfer_in', $3, 'THB', $4, NOW())`,
      [payment.merchant_id, merchantWallet.id, amount, logDesc]
    );

    await client.query('COMMIT');

    // 7. Distribute Commissions (Async, non-blocking for response speed, or include in flow)
    // We await it here to ensure logs are generated before potential redirect checks,
    // though ideally this could be a background job.
    try {
      await commissionService.distributeCommissions(payment.id, payment.merchant_id, amount, 'THB');
    } catch (commError) {
      console.error('Commission distribution failed', commError);
    }

    res.json({
      success: true,
      data: {
        message: 'Payment successful',
        redirect_url: payment.return_url
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// -- Exports for existing route file compatibility --
exports.getPaymentStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
         COUNT(*)::int AS "totalPayments",
         COUNT(*) FILTER (WHERE status = 'succeeded' OR status = 'completed')::int AS "completedPayments",
         COUNT(*) FILTER (WHERE status = 'pending')::int AS "pendingPayments",
         COUNT(*) FILTER (WHERE status = 'failed')::int AS "failedPayments",
         COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded' OR status = 'completed'), 0)::numeric AS "totalAmount",
         COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded' OR status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS "monthlyAmount"
       FROM payments
       WHERE merchant_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: { stats: result.rows[0] }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0, sort = 'desc' } = req.query;

    let query = `SELECT id, amount, currency, status, description, payment_method_type, 
                        token, return_url, created_at, settled_at
                 FROM payments WHERE merchant_id = $1`;
    const params = [userId];
    let paramIdx = 2;

    if (status) {
      query += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'}`;
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Total count
    let countQuery = 'SELECT COUNT(*)::int FROM payments WHERE merchant_id = $1';
    const countParams = [userId];
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0].count;

    res.json({
      success: true,
      data: {
        payments: result.rows,
        pagination: {
          total,
          offset: parseInt(offset),
          limit: parseInt(limit),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Remove 'pay_' prefix if it was passed by external merchants
    const cleanId = id.startsWith('pay_') ? id.substring(4) : id;

    // Optional safety check: Ensure ID is an integer
    if (isNaN(cleanId)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid payment ID format' } });
    }

    const result = await pool.query(
      `SELECT * FROM payments WHERE id = $1 AND (merchant_id = $2 OR payer_id = $2)`,
      [cleanId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Payment not found' } });
    }

    res.json({ success: true, data: { payment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
exports.confirmPayment = (req, res) => res.json({ success: true });
exports.cancelPayment = (req, res) => res.json({ success: true });
exports.refundPayment = (req, res) => res.json({ success: true });

/**
 * @route   POST /api/v1/payments/checkout-session
 * @desc    Create a Stripe Checkout Session (Hosted Checkout — simplest integration)
 * @access  Private (Merchant API Key)
 */
exports.createCheckoutSession = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { amount, currency = 'THB', description, success_url, cancel_url, metadata } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
    }
    if (!success_url) {
      return res.status(400).json({ success: false, error: { message: 'success_url is required' } });
    }
    if (!cancel_url) {
      return res.status(400).json({ success: false, error: { message: 'cancel_url is required' } });
    }

    // Create Stripe Checkout Session
    const sessionRes = await stripeService.createCheckoutSession({
      amount,
      currency,
      description: description || 'Payment via Elixopay',
      successUrl: success_url + '?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: cancel_url,
      metadata: {
        merchant_id: userId,
        description: description || '',
        ...(metadata || {})
      }
    });

    if (!sessionRes.success) {
      return res.status(500).json({ success: false, error: { message: 'Stripe error: ' + sessionRes.error } });
    }

    const session = sessionRes.data;
    const token = generateToken();

    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO payments (
        merchant_id, amount, currency, status, token,
        return_url, cancel_url, description,
        payment_intent_id, checkout_session_id, payment_method_type,
        created_at
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, 'stripe', NOW())
      RETURNING id, token, status, amount, currency`,
      [userId, amount, currency.toUpperCase(), token, success_url, cancel_url, description,
       session.payment_intent, session.id]
    );

    await client.query('COMMIT');

    const payment = insertRes.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        checkout_url: session.url,
        session_id: session.id,
        token: payment.token
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * @route   GET /api/v1/payments/checkout/:token
 * @desc    Get payment details for Elixopay-hosted checkout page (includes clientSecret & publicKey)
 * @access  Public
 */
exports.getCheckoutByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT p.id, p.amount, p.currency, p.description, p.status,
              p.return_url, p.cancel_url, p.client_secret, p.payment_method_type,
              u.first_name as merchant_name
       FROM payments p
       JOIN users u ON p.merchant_id = u.id
       WHERE p.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Payment session not found or expired' } });
    }

    const payment = result.rows[0];

    if (payment.status !== 'pending') {
      return res.json({
        success: true,
        data: {
          status: payment.status === 'succeeded' || payment.status === 'completed' ? 'COMPLETED' : payment.status.toUpperCase(),
          amount: payment.amount,
          currency: payment.currency,
          description: payment.description,
          merchantName: payment.merchant_name || 'Merchant',
          returnUrl: payment.return_url
        }
      });
    }

    const responseData = {
      id: payment.id,
      status: 'PENDING',
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      merchantName: payment.merchant_name || 'Merchant',
      paymentMethodType: payment.payment_method_type || 'stripe',
      returnUrl: payment.return_url
    };

    // If Stripe payment → include clientSecret and publishable key for Stripe Elements
    if (payment.payment_method_type === 'stripe' || !payment.payment_method_type) {
      responseData.clientSecret = payment.client_secret;
      responseData.stripePublicKey = process.env.STRIPE_PUBLISHABLE_KEY;
    }

    // If KBank QR → include QR code
    if (payment.payment_method_type === 'kbank_qr') {
      responseData.qrCodeBase64 = payment.client_secret; // QR stored in client_secret field
    }

    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
};

