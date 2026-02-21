const db = require('../config/database');

// Get current user's primary agency balance (creates zero row if missing)
exports.getMyAgencyBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currency = (req.query.currency || 'THB').toUpperCase();

    // Find primary agency
    const agencyRes = await db.query(
      `SELECT agency_id FROM agency_members
       WHERE user_id = $1 AND is_active = true
       ORDER BY CASE role_in_agency
                  WHEN 'owner' THEN 1
                  WHEN 'manager' THEN 2
                  WHEN 'finance' THEN 3
                  WHEN 'support' THEN 4
                  ELSE 5
                END ASC
       LIMIT 1`,
      [userId]
    );

    if (agencyRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'No agency membership found' }});
    }
    const agencyId = agencyRes.rows[0].agency_id;

    // Ensure balance row exists
    await db.query('BEGIN');
    const sel = await db.query(
      `SELECT available_amount, pending_amount, reserved_amount
       FROM agency_balances WHERE agency_id = $1 AND currency = $2 FOR UPDATE`,
      [agencyId, currency]
    );
    if (sel.rows.length === 0) {
      await db.query(
        `INSERT INTO agency_balances (agency_id, currency, available_amount, pending_amount, reserved_amount, updated_at)
         VALUES ($1, $2, 0, 0, 0, CURRENT_TIMESTAMP)`,
        [agencyId, currency]
      );
    }
    await db.query('COMMIT');

    const out = await db.query(
      `SELECT agency_id, currency, available_amount, pending_amount, reserved_amount
       FROM agency_balances WHERE agency_id = $1 AND currency = $2`,
      [agencyId, currency]
    );

    res.json({ success: true, data: out.rows[0] });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    next(err);
  }
};
