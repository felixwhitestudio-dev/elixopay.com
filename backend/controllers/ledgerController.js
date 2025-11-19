const db = require('../config/database');

// List ledger entries for current user's primary agency
exports.getMyLedger = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status, type } = req.query;

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

    const params = [agencyId];
    let where = ['agency_id = $1'];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (type) { params.push(type); where.push(`type = $${params.length}`); }
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await db.query(
      `SELECT id, type, direction, amount, currency, status, payment_id, withdrawal_request_id, description, created_at
       FROM ledger_entries
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: { ledger: result.rows } });
  } catch (err) {
    next(err);
  }
};
