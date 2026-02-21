const db = require('../config/database');
const kbankService = require('../services/kbankService');
const { sendEmail } = require('../utils/email');

/**
 * @route   POST /api/v1/payments/:id/cancel
 * @desc    Cancel a pending QR payment
 * @access  Private (Admin)
 */
exports.cancelPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM payments WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const payment = result.rows[0];

        if (payment.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending payments can be cancelled' });
        }

        // Call KBank Service if it's a KBank QR transaction
        if (payment.payment_method === 'kbank_qr' && payment.payment_intent_id) {
            console.log(`Cancelling KBank QR: ${payment.payment_intent_id}`);
            await kbankService.cancelQR(payment.payment_intent_id);
        }

        // Update DB
        const update = await db.query(
            "UPDATE payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
            [id]
        );

        res.json({ success: true, data: update.rows[0] });

    } catch (error) {
        console.error('Cancel Payment Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Void or Refund a completed payment
 * @access  Private (Admin)
 */
exports.refundPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM payments WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const payment = result.rows[0];

        if (payment.status !== 'completed' && payment.status !== 'succeeded') {
            return res.status(400).json({ success: false, message: 'Only completed payments can be refunded' });
        }

        // Call KBank Service
        if (payment.payment_method === 'kbank_qr' && payment.payment_intent_id) {
            console.log(`Voiding KBank Payment: ${payment.payment_intent_id}`);
            // Note: In real world, we check if it needs void (same day) or refund (next day). 
            // Generic 'voidPayment' usually works for same-day.
            await kbankService.voidPayment(payment.payment_intent_id);
        }

        // Update DB
        const update = await db.query(
            "UPDATE payments SET status = 'refunded', refund_amount = amount, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
            [id]
        );

        // Notify User
        const userRes = await db.query('SELECT email FROM users WHERE id = $1', [payment.user_id]);
        if (userRes.rows.length > 0) {
            await sendEmail(userRes.rows[0].email, 'Payment Refunded',
                `Your payment of ${payment.amount} ${payment.currency} has been refunded.`);
        }

        res.json({ success: true, data: update.rows[0] });

    } catch (error) {
        console.error('Refund Payment Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
