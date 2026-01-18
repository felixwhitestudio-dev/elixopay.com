const db = require('../config/database');

/**
 * Distribute Commissions for a successful payment
 * @param {string} paymentId - The ID of the successful payment
 * @param {string} merchantUserId - The user ID of the merchant
 * @param {number} amount - The transaction amount
 * @param {string} currency - The transaction currency
 */
exports.distributeCommissions = async (paymentId, merchantUserId, amount, currency) => {
    const client = await db.pool.connect();
    try {
        console.log(`[Commission] Starting distribution for Payment ${paymentId}`);

        // 1. Fetch Commission Rules
        const rulesRes = await client.query('SELECT role, commission_percent FROM commission_rules WHERE is_active = true');
        const rules = {};
        rulesRes.rows.forEach(r => rules[r.role] = parseFloat(r.commission_percent));

        if (Object.keys(rules).length === 0) {
            console.log('[Commission] No active rules found.');
            return;
        }

        // 2. Recursive Upline Lookup
        let currentUserId = merchantUserId;
        let depth = 0;
        const maxDepth = 5; // Prevent infinite loops

        await client.query('BEGIN');

        while (depth < maxDepth) {
            // Find parent
            const userRes = await client.query(
                `SELECT parent_id FROM users WHERE id = $1`,
                [currentUserId]
            );

            if (userRes.rows.length === 0 || !userRes.rows[0].parent_id) {
                break; // No more upline
            }

            const parentId = userRes.rows[0].parent_id;

            // Get Parent Details (Role)
            const parentRes = await client.query(
                `SELECT account_type FROM users WHERE id = $1`,
                [parentId]
            );

            if (parentRes.rows.length > 0) {
                const parentRole = parentRes.rows[0].account_type; // partner, organizer, agent

                // Check if this role earns commission
                if (rules[parentRole]) {
                    const commissionAmount = amount * rules[parentRole];

                    if (commissionAmount > 0) {
                        console.log(`[Commission] Crediting ${commissionAmount} ${currency} to ${parentRole} (${parentId})`);

                        // Find Agency ID for the parent (since wallets are agency-based now?)
                        // Wait, previous code used 'agency_balances'. We need to find the agency associated with the user.
                        // Assuming 1-to-1 or Primary Agency for now.
                        const agencyRes = await client.query(
                            `SELECT agency_id FROM agency_members WHERE user_id = $1 AND is_active = true LIMIT 1`,
                            [parentId]
                        );

                        if (agencyRes.rows.length > 0) {
                            const agencyId = agencyRes.rows[0].agency_id;

                            // Update Balance
                            await client.query(
                                `UPDATE agency_balances 
                                 SET available_amount = available_amount + $1
                                 WHERE agency_id = $2`,
                                [commissionAmount, agencyId]
                            );

                            // Initial Balance Entry if not exists? (Constraint usually handles this, or setup)

                            // Log Commission
                            await client.query(
                                `INSERT INTO commission_logs 
                                 (beneficiary_id, source_payment_id, source_user_id, amount, currency, rate_snapshot)
                                 VALUES ($1, $2, $3, $4, $5, $6)`,
                                [parentId, paymentId, merchantUserId, commissionAmount, currency, rules[parentRole]]
                            );

                            // Create Ledger Entry
                            await client.query(
                                `INSERT INTO ledger_entries 
                                 (agency_id, type, direction, amount, currency, status, payment_id, description)
                                 VALUES ($1, 'COMMISSION', 'C', $2, $3, 'POSTED', $4, 'Commission from Downline')`,
                                [agencyId, commissionAmount, currency, paymentId]
                            );
                        }
                    }
                }
            }

            currentUserId = parentId; // Move up
            depth++;
        }

        await client.query('COMMIT');
        console.log(`[Commission] Distribution complete for ${paymentId}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Commission Error]', error);
        // Don't fail the main transaction if commission fails, just log it.
    } finally {
        client.release();
    }
};
