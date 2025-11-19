const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const stripeService = require('../utils/stripe');
const { accrueCommissionForPayment } = require('../utils/ledger');

/**
 * @route   GET /api/v1/payments
 * @desc    Get all payments for current user
 * @access  Private
 */
exports.getPayments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0, sort = 'created_at', order = 'DESC' } = req.query;

    // Build query with optional filters
    let query = `
      SELECT 
        id, 
        amount, 
        currency, 
        status, 
        description, 
        customer_email,
        customer_name,
        payment_method,
        payment_intent_id,
        created_at,
        updated_at,
        settled_at
      FROM payments 
      WHERE user_id = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // Add status filter if provided
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Add sorting
    const allowedSortFields = ['created_at', 'amount', 'status', 'updated_at'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    const countQuery = status 
      ? 'SELECT COUNT(*) FROM payments WHERE user_id = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM payments WHERE user_id = $1';
    const countParams = status ? [userId, status] : [userId];
    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        payments: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].count)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT 
        id, 
        user_id,
        amount, 
        currency, 
        status, 
        description, 
        customer_email,
        customer_name,
        payment_method,
        payment_intent_id,
        metadata,
        created_at,
        updated_at,
        settled_at
      FROM payments 
      WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Payment not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        payment: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/payments
 * @desc    Create a new payment with Stripe
 * @access  Private
 */
exports.createPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      amount, 
      currency = 'THB', 
      description, 
      customer_email,
      customer_name,
      metadata = {}
    } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid amount'
        }
      });
    }

    // Create Payment Intent with Stripe
    const stripeResult = await stripeService.createPaymentIntent({
      amount,
      currency,
      metadata: {
        ...metadata,
        user_id: userId,
        description: description || 'Elixopay Payment'
      }
    });

    if (!stripeResult.success) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create Stripe payment intent',
          details: stripeResult.error
        }
      });
    }

    const paymentIntent = stripeResult.data;

    // Create payment in database with Stripe payment_intent_id
    const result = await db.query(
      `INSERT INTO payments (
        user_id, 
        amount, 
        currency, 
        status, 
        description,
        customer_email,
        customer_name,
        payment_intent_id,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING id, amount, currency, status, description, customer_email, customer_name, payment_intent_id, created_at`,
      [
        userId,
        amount,
        currency,
        'pending',
        description,
        customer_email || req.user.email,
        customer_name || `${req.user.first_name} ${req.user.last_name}`,
        paymentIntent.id, // Use Stripe payment_intent_id
        JSON.stringify(metadata)
      ]
    );

    const payment = result.rows[0];

    // TODO: Add audit logging when audit_logs table is updated

    res.status(201).json({
      success: true,
      data: {
        payment: payment,
        clientSecret: paymentIntent.client_secret // For frontend to complete payment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/payments/:id/confirm
 * @desc    Confirm a payment with Stripe
 * @access  Private
 */
exports.confirmPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { payment_method_id } = req.body;

    // Get payment
    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot confirm payment with status: ${payment.status}`
        }
      });
    }

    // Confirm with Stripe (only if payment_method_id provided, otherwise wait for webhook)
    if (payment_method_id) {
      const stripeResult = await stripeService.confirmPaymentIntent(
        payment.payment_intent_id,
        payment_method_id
      );

      if (!stripeResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to confirm payment with Stripe',
            details: stripeResult.error
          }
        });
      }

      const stripePayment = stripeResult.data;

      // Normalize payment method to satisfy DB check constraint (e.g., 'card', 'promptpay')
      const normalizedMethod = Array.isArray(stripePayment.payment_method_types) && stripePayment.payment_method_types.length > 0
        ? stripePayment.payment_method_types[0]
        : (payment_method_id && payment_method_id.startsWith('pm_') ? 'card' : 'unknown');

      // Update database based on Stripe status
      const newStatus = stripePayment.status === 'succeeded' ? 'succeeded' : 
                       stripePayment.status === 'processing' ? 'pending' : 'failed';

      const updateResult = await db.query(
        `UPDATE payments 
         SET status = $1, 
             payment_method = $2,
             settled_at = ${newStatus === 'succeeded' ? 'CURRENT_TIMESTAMP' : 'NULL'},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, amount, currency, status, payment_intent_id, settled_at`,
        [newStatus, normalizedMethod, id]
      );

      // If succeeded synchronously, accrue commission (best-effort)
      if (newStatus === 'succeeded') {
        try {
          const paymentRow = updateResult.rows[0];
          await accrueCommissionForPayment({
            userId: userId,
            paymentId: id,
            amount: paymentRow.amount,
            currency: paymentRow.currency,
            description: `Commission for payment ${id}`,
          });
        } catch (e) {
          console.warn('⚠️ Commission accrual error (confirm):', e.message);
        }
      }

      return res.json({
        success: true,
        data: {
          payment: updateResult.rows[0]
        }
      });
    }

    // If no payment_method_id, just retrieve status from Stripe
    const stripeResult = await stripeService.retrievePaymentIntent(payment.payment_intent_id);
    
    if (stripeResult.success) {
      const stripePayment = stripeResult.data;
      const newStatus = stripePayment.status === 'succeeded' ? 'succeeded' : 
                       stripePayment.status === 'canceled' ? 'cancelled' : payment.status;

      if (newStatus !== payment.status) {
        const updateResult = await db.query(
          `UPDATE payments 
           SET status = $1, 
               settled_at = ${newStatus === 'succeeded' ? 'CURRENT_TIMESTAMP' : 'NULL'},
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id, amount, currency, status, payment_intent_id, settled_at`,
          [newStatus, id]
        );

        // If succeeded after retrieval, accrue commission (best-effort)
        if (newStatus === 'succeeded') {
          try {
            const paymentRow = updateResult.rows[0];
            await accrueCommissionForPayment({
              userId: userId,
              paymentId: id,
              amount: paymentRow.amount,
              currency: paymentRow.currency,
              description: `Commission for payment ${id}`,
            });
          } catch (e) {
            console.warn('⚠️ Commission accrual error (retrieve):', e.message);
          }
        }

        return res.json({
          success: true,
          data: {
            payment: updateResult.rows[0]
          }
        });
      }
    }

    // TODO: Add audit logging

    res.json({
      success: true,
      data: {
        payment: payment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/payments/:id/cancel
 * @desc    Cancel a payment with Stripe
 * @access  Private
 */
exports.cancelPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Get payment
    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status === 'succeeded' || payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot cancel payment with status: ${payment.status}`
        }
      });
    }

    // Cancel with Stripe
    const stripeResult = await stripeService.cancelPaymentIntent(payment.payment_intent_id);

    if (!stripeResult.success) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to cancel payment with Stripe',
          details: stripeResult.error
        }
      });
    }

    // Update payment status to cancelled
    const updateResult = await db.query(
      `UPDATE payments 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, amount, currency, status, payment_intent_id`,
      ['cancelled', id]
    );

    // TODO: Add audit logging

    res.json({
      success: true,
      data: {
        payment: updateResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Refund a payment with Stripe
 * @access  Private
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason, amount: refundAmount } = req.body;

    // Get payment
    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Only succeeded payments can be refunded'
        }
      });
    }

    // Validate refund amount
    const finalRefundAmount = refundAmount || payment.amount;
    if (finalRefundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Refund amount cannot exceed payment amount'
        }
      });
    }

    // Create refund with Stripe
    const stripeResult = await stripeService.createRefund(
      payment.payment_intent_id,
      refundAmount // null for full refund
    );

    if (!stripeResult.success) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create refund with Stripe',
          details: stripeResult.error
        }
      });
    }

    const refund = stripeResult.data;

    // Update payment status and refund amount
    const updateResult = await db.query(
      `UPDATE payments 
       SET status = $1, refund_amount = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, amount, currency, status, payment_intent_id, refund_amount`,
      ['refunded', finalRefundAmount, id]
    );

    // TODO: Add audit logging

    res.json({
      success: true,
      data: {
        payment: updateResult.rows[0],
        refundAmount: finalRefundAmount,
        refundId: refund.id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
exports.getPaymentStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get overall stats
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0) as total_amount,
        COALESCE(AVG(CASE WHEN status = 'succeeded' THEN amount END), 0) as average_amount
      FROM payments 
      WHERE user_id = $1`,
      [userId]
    );

    // Get recent payments (last 7 days)
    const recentResult = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(amount) as total
      FROM payments 
      WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [userId]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        stats: {
          totalPayments: parseInt(stats.total_payments),
          completedPayments: parseInt(stats.completed_payments),
          pendingPayments: parseInt(stats.pending_payments),
          failedPayments: parseInt(stats.failed_payments),
          totalAmount: parseFloat(stats.total_amount),
          averageAmount: parseFloat(stats.average_amount)
        },
        recentActivity: recentResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
