const db = require('../config/database');

/**
 * Distribute Commissions for a successful payment
 * @param {string} paymentId - The ID of the successful payment
 * @param {string} merchantUserId - The user ID of the merchant
 * @param {number} amount - The transaction amount
 * @param {string} currency - The transaction currency
 */
exports.distributeCommissions = async (paymentId, merchantUserId, amount, currency) => {
    // We use a new client to ensure commission errors don't rollback the main payment transaction
    // unless strictly required. For now, we keep it separate but ideally it should be same transaction if critical.
    // Given the previous code, it used a separate client & transaction.
    const client = await db.pool.connect();
    try {
        console.log(`[Commission] Starting distribution for Payment ${paymentId}`);

        // 1. Fetch Global Commission Rules
        const rulesRes = await client.query('SELECT role, commission_percent FROM commission_rules WHERE is_active = true');
        const globalRules = {};
        rulesRes.rows.forEach(r => globalRules[r.role] = parseFloat(r.commission_percent));

        // 2. Recursive Upline Lookup
        let currentUserId = merchantUserId;
        let depth = 0;
        const maxDepth = 5;

        await client.query('BEGIN');

        while (depth < maxDepth) {
            // Find parent
            const userRes = await client.query(
                `SELECT u.id, u.parent_id, u.account_type FROM users u WHERE u.id = $1`,
                [currentUserId]
            );

            if (userRes.rows.length === 0 || !userRes.rows[0].parent_id) {
                break; // No more upline
            }

            const parentId = userRes.rows[0].parent_id;

            // Get Parent Details
            const parentRes = await client.query(
                `SELECT id, account_type FROM users WHERE id = $1`,
                [parentId]
            );

            if (parentRes.rows.length > 0) {
                const parent = parentRes.rows[0];
                const parentRole = parent.account_type; // partner, organizer, agent

                // 3. Determine Fee Rate (Custom Config > Global Rule)
                let rate = 0;

                // Check for custom config SPECIFIC to this downline (currentUserId) set by this upline (parentId)
                const configRes = await client.query(
                    `SELECT rate_percent FROM fee_configs WHERE user_id = $1 AND set_by_id = $2`,
                    [currentUserId, parentId]
                );

                if (configRes.rows.length > 0) {
                    rate = parseFloat(configRes.rows[0].rate_percent);
                    console.log(`[Commission] Using custom rate ${rate} for ${parentRole} (${parentId}) -> ${currentUserId}`);
                } else if (globalRules[parentRole]) {
                    rate = globalRules[parentRole];
                    console.log(`[Commission] Using global rate ${rate} for ${parentRole} (${parentId})`);
                }

                // 4. Calculate & Credit Commission
                if (rate > 0) {
                    const commissionAmount = amount * rate;

                    if (commissionAmount > 0) {
                        console.log(`[Commission] Crediting ${commissionAmount} ${currency} to ${parentRole} (${parentId})`);

                        // Find Wallet
                        const walletRes = await client.query(
                            `SELECT id FROM wallets WHERE user_id = $1 AND currency = $2`,
                            [parentId, 'THB'] // Enforce THB coms for now
                        );

                        if (walletRes.rows.length > 0) {
                            const walletId = walletRes.rows[0].id;

                            // Update Balance
                            await client.query(
                                `UPDATE wallets 
                                 SET balance = balance + $1, updated_at = NOW()
                                 WHERE id = $2`,
                                [commissionAmount, walletId]
                            );

                            // Log Commission
                            await client.query(
                                `INSERT INTO commission_logs 
                                 (beneficiary_id, source_payment_id, source_user_id, amount, currency, rate_snapshot)
                                 VALUES ($1, $2, $3, $4, $5, $6)`,
                                [parentId, paymentId, merchantUserId, commissionAmount, currency, rate]
                            );

                            // Transaction Log
                            await client.query(
                                `INSERT INTO transaction_logs 
                                 (user_id, wallet_id, type, amount, currency, description, created_at)
                                 VALUES ($1, $2, 'commission', $3, 'THB', $4, NOW())`,
                                [parentId, walletId, commissionAmount, `Commission from ${paymentId}`]
                            );
                        } else {
                            console.warn(`[Commission] No wallet found for ${parentId}`);
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
    } finally {
        client.release();
    }
};
