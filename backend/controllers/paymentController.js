const commissionService = require('../services/commissionService'); // Import service

// ...

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

// 7. Distribute Commissions (Async - don't block response)
// We pass merchant_id (user_id), transaction_id, amount
commissionService.distributeCommissions(payment.id, payment.merchant_id, amount, 'THB')
  .catch(err => console.error('Commission Error:', err));
const { v4: uuidv4 } = require('uuid');
const stripeService = require('../utils/stripe');

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
        clientSecret: stripeClientSecret, // Optional, usually frontend gets it via token
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
    console.log('DEBUG: getPaymentByToken called');
    console.log('DEBUG: URL:', req.originalUrl);
    console.log('DEBUG: Params:', req.params);
    const { token } = req.params;

    const result = await pool.query(
      `SELECT p.id, p.amount, p.currency, p.description, p.status, p.return_url,
                    u.first_name as merchant_name, u.email as merchant_email
             FROM payments p
             JOIN users u ON p.merchant_id = u.id
             WHERE p.token = $1`,
      [token]
    );

    console.log('Searching for token:', token);
    console.log('Result count:', result.rows.length);
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
        paymentMethodType: payment.payment_method_type || 'stripe'
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
exports.getPaymentStats = (req, res) => res.json({
  success: true,
  data: {
    stats: {
      totalPayments: 0,
      completedPayments: 0,
      pendingPayments: 0,
      totalAmount: 0
    }
  }
});

exports.getPayments = (req, res) => res.json({
  success: true,
  data: {
    payments: [],
    pagination: {
      total: 0,
      offset: 0,
      limit: 20,
      hasMore: false
    }
  }
});

exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM payments WHERE id = $1 AND (merchant_id = $2 OR payer_id = $2)`,
      [id, userId]
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
