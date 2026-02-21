const db = require('../config/database');

// Helper: ensure a balance row exists for agency+currency
async function ensureBalance(client, agencyId, currency) {
  const sel = await client.query(
    `SELECT id FROM agency_balances WHERE agency_id = $1 AND currency = $2 FOR UPDATE`,
    [agencyId, currency]
  );
  if (sel.rows.length === 0) {
    await client.query(
      `INSERT INTO agency_balances (agency_id, currency, available_amount, pending_amount, reserved_amount, updated_at)
       VALUES ($1, $2, 0, 0, 0, CURRENT_TIMESTAMP)`,
      [agencyId, currency]
    );
  }
}

// Resolve primary agency for a user (first active membership)
async function getUserPrimaryAgency(client, userId) {
  const result = await client.query(
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
  return result.rows[0]?.agency_id || null;
}

// Get commission percent for an agency (fallback to default if none)
async function getCommissionPercent(client, agencyId) {
  // Try commission_overrides at agency-level could be extended later
  const rule = await client.query(
    `SELECT percent_value
     FROM commission_rules
     WHERE agency_id = $1 AND is_active = true AND model = 'PERCENT'
     AND level IN ('DIRECT','MERCHANT')
     ORDER BY effective_from DESC
     LIMIT 1`,
    [agencyId]
  );
  const percent = rule.rows[0]?.percent_value;
  if (percent && Number(percent) >= 0) return Number(percent);
  // Default commission percent if not configured
  return 0.05; // 5%
}

// Public: accrue commission for a payment to the user's primary agency
async function accrueCommissionForPayment({ userId, paymentId, amount, currency = 'THB', description }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const agencyId = await getUserPrimaryAgency(client, userId);
    if (!agencyId) {
      await client.query('ROLLBACK');
      return { success: false, error: 'No agency membership found for user' };
    }

    // Compute commission
    const percent = await getCommissionPercent(client, agencyId);
    const commissionAmt = Math.max(0, Number((Number(amount) * percent).toFixed(2)));
    if (commissionAmt <= 0) {
      await client.query('ROLLBACK');
      return { success: true, skipped: true, message: 'Commission is 0; no accrual created' };
    }

    // Ensure balance row and add PENDING ledger entry
    await ensureBalance(client, agencyId, currency);

    const insertLedger = await client.query(
      `INSERT INTO ledger_entries (
         agency_id, type, direction, amount, currency, status,
         payment_id, related_agency_id, description, created_at
       ) VALUES ($1, $2, 'C', $3, $4, 'PENDING', $5, NULL, $6, CURRENT_TIMESTAMP)
       RETURNING id`,
      [agencyId, 'COMMISSION', commissionAmt, currency, paymentId, description || 'Commission accrual']
    );

    // Increase pending balance
    await client.query(
      `UPDATE agency_balances
       SET pending_amount = pending_amount + $1, updated_at = CURRENT_TIMESTAMP
       WHERE agency_id = $2 AND currency = $3`,
      [commissionAmt, agencyId, currency]
    );

    await client.query('COMMIT');
    return { success: true, data: { ledgerEntryId: insertLedger.rows[0].id, agencyId, commissionAmt, percent } };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Accrual error:', err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

module.exports = {
  accrueCommissionForPayment,
};
