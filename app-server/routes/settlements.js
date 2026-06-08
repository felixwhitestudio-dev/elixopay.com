const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route   GET /api/v1/settlements
 * @desc    List settlements for authenticated user (paginated, filterable)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0, from, to } = req.query;

    let query = `SELECT id, amount, fee, net_amount, currency, status,
                        reference_id, bank_name, account_number, account_name,
                        period_start, period_end, notes,
                        completed_at, failure_reason, created_at, updated_at
                 FROM settlements WHERE user_id = $1`;
    const params = [userId];
    let paramIdx = 2;

    if (status) {
      query += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (from) {
      query += ` AND created_at >= $${paramIdx}`;
      params.push(from);
      paramIdx++;
    }
    if (to) {
      query += ` AND created_at <= $${paramIdx}`;
      params.push(to);
      paramIdx++;
    }

    // Count total
    const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        settlements: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   GET /api/v1/settlements/stats
 * @desc    Get settlement summary stats for authenticated user
 * @access  Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT
        COALESCE(SUM(amount), 0) as total_processed,
        COALESCE(SUM(fee), 0) as total_fees,
        COALESCE(SUM(net_amount), 0) as net_received,
        COUNT(*) as total_settlements,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount
       FROM settlements WHERE user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];

    // Get fee rate from system settings
    let feeRate = '2.90%';
    try {
      const feeResult = await db.query(
        `SELECT value FROM system_settings WHERE key = 'fee_rate' LIMIT 1`
      );
      if (feeResult.rows.length > 0) {
        feeRate = feeResult.rows[0].value + '%';
      }
    } catch (e) { /* use default */ }

    res.json({
      success: true,
      data: {
        stats: {
          totalProcessed: parseFloat(stats.total_processed),
          totalFees: parseFloat(stats.total_fees),
          netReceived: parseFloat(stats.net_received),
          totalSettlements: parseInt(stats.total_settlements),
          completedCount: parseInt(stats.completed_count),
          pendingCount: parseInt(stats.pending_count),
          pendingAmount: parseFloat(stats.pending_amount),
          feeRate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching settlement stats:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   GET /api/v1/settlements/:id
 * @desc    Get single settlement details
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM settlements WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Settlement not found' } });
    }

    res.json({ success: true, data: { settlement: result.rows[0] } });
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   POST /api/v1/settlements/request
 * @desc    Request a new settlement/payout (pending admin approval)
 * @access  Private
 */
router.post('/request', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { bank_account_id, amount, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
    }

    // Verify bank account belongs to user
    if (bank_account_id) {
      const bankCheck = await db.query(
        `SELECT id, bank_name, account_number, account_name FROM user_bank_accounts WHERE id = $1 AND user_id = $2`,
        [bank_account_id, userId]
      );
      if (bankCheck.rows.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Bank account not found' } });
      }
      var bankInfo = bankCheck.rows[0];
    }

    // Check available balance
    const balanceResult = await db.query(
      `SELECT COALESCE(balance, 0) as balance FROM wallets WHERE user_id = $1 AND currency = 'THB'`,
      [userId]
    );
    const availableBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].balance) : 0;

    if (parseFloat(amount) > availableBalance) {
      return res.status(400).json({
        success: false,
        error: { message: `ยอดเงินไม่เพียงพอ (คงเหลือ: ฿${availableBalance.toFixed(2)})` }
      });
    }

    // Calculate fee (default 0 for settlements — fee already taken at payment time)
    const fee = 0;
    const netAmount = parseFloat(amount) - fee;

    // Generate reference ID
    const refId = 'STL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const result = await db.query(
      `INSERT INTO settlements (user_id, bank_account_id, amount, fee, net_amount, currency, status, reference_id,
        bank_name, account_number, account_name, notes, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, 'THB', 'pending', $6, $7, $8, $9, $10, NOW() - INTERVAL '30 days', NOW())
       RETURNING id, amount, fee, net_amount, status, reference_id, bank_name, account_number, created_at`,
      [
        userId,
        bank_account_id || null,
        parseFloat(amount),
        fee,
        netAmount,
        refId,
        bankInfo ? bankInfo.bank_name : null,
        bankInfo ? bankInfo.account_number : null,
        bankInfo ? bankInfo.account_name : null,
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'คำขอถอนเงินถูกส่งแล้ว รอผู้ดูแลระบบอนุมัติ',
      data: { settlement: result.rows[0] }
    });
  } catch (error) {
    console.error('Error creating settlement request:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   PUT /api/v1/settlements/:id/approve
 * @desc    Approve a settlement (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const result = await db.query(
      `UPDATE settlements SET status = 'processing', approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, adminId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Settlement not found or not pending' } });
    }

    res.json({ success: true, message: 'Settlement approved', data: { settlement: result.rows[0] } });
  } catch (error) {
    console.error('Error approving settlement:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   PUT /api/v1/settlements/:id/reject
 * @desc    Reject a settlement (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      `UPDATE settlements SET status = 'failed', failure_reason = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, reason || 'Rejected by admin']
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Settlement not found or not pending' } });
    }

    res.json({ success: true, message: 'Settlement rejected', data: { settlement: result.rows[0] } });
  } catch (error) {
    console.error('Error rejecting settlement:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

module.exports = router;
