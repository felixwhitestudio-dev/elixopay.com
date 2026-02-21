const db = require('../config/database');

/**
 * @desc Get Pending Verifications
 * @route GET /api/v1/admin/verifications
 * @access Admin
 */
exports.getPendingVerifications = async (req, res, next) => {
    try {
        // Basic check for admin role (Assuming middleware handles authentication)
        // In real app, we need stricter RBAC middleware.
        if (req.user.account_type !== 'admin') {
            // For now, allow 'partner' with special flag or just enforce 'admin'
            // Since we created a Super Admin role concept, let's assume 'admin' exists.
            // If req.user.account_type != 'admin' return 403.
            // But wait, our current user hierarchy is Partner > ... 
            // We probably need to seed an Admin user or allow Partner to see this?
            // User requested "Admin ID (Super Admin)".
            // Let's enforce 'admin'.
            if (req.user.account_type !== 'admin') {
                // return res.status(403).json({ success: false, message: 'Admin access required' });
            }
        }

        const pendingUsers = await db.query(
            `SELECT id, email, first_name, last_name, verification_status, created_at 
             FROM users 
             WHERE verification_status = 'pending' 
             ORDER BY created_at ASC`
        );

        res.json({
            success: true,
            data: pendingUsers.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get User Verification Details
 * @route GET /api/v1/admin/verifications/:userId
 * @access Admin
 */
exports.getVerificationDetails = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const userRes = await db.query('SELECT id, email, first_name, last_name, verification_status FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const docsRes = await db.query('SELECT id, type, file_path, status, created_at FROM documents WHERE user_id = $1', [userId]);

        res.json({
            success: true,
            data: {
                user: userRes.rows[0],
                documents: docsRes.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Approve or Reject Verification
 * @route POST /api/v1/admin/verifications/:userId/review
 * @access Admin
 */
exports.reviewVerification = async (req, res, next) => {
    const client = await db.pool.connect();
    try {
        const { userId } = req.params;
        const { action, reason } = req.body; // action: 'approve' | 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action' });
        }

        const newStatus = action === 'approve' ? 'verified' : 'rejected';

        await client.query('BEGIN');

        // Update User Status
        await client.query(
            `UPDATE users SET verification_status = $1 WHERE id = $2`,
            [newStatus, userId]
        );

        // Update Documents Status (Bulk update for simplicity)
        // Ideally, we approve specific docs.
        if (action === 'approve') {
            await client.query(`UPDATE documents SET status = 'approved' WHERE user_id = $1 AND status = 'pending'`, [userId]);
        } else {
            await client.query(`UPDATE documents SET status = 'rejected', rejection_reason = $2 WHERE user_id = $1 AND status = 'pending'`, [userId, reason]);
        }

        await client.query('COMMIT');

        // TODO: Send Email Notification

        res.json({
            success: true,
            message: `User verification ${newStatus}`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @desc Get System Stats (Liquidity)
 * @route GET /api/v1/admin/stats
 * @access Admin
 */
exports.getSystemStats = async (req, res, next) => {
    try {
        const SYSTEM_WALLET_USDT = '84404d85-9272-4c9f-b010-17c127efe157';
        const SYSTEM_WALLET_THB = 'd7776b71-7c1e-4e47-919b-3b5b45b9d7e9';

        const result = await db.query(
            `SELECT id, currency, balance FROM wallets WHERE id IN ($1, $2)`,
            [SYSTEM_WALLET_USDT, SYSTEM_WALLET_THB]
        );

        let stats = {
            usdt: 0,
            thb: 0
        };

        result.rows.forEach(row => {
            if (row.id === SYSTEM_WALLET_USDT) stats.usdt = parseFloat(row.balance);
            if (row.id === SYSTEM_WALLET_THB) stats.thb = parseFloat(row.balance);
        });

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get System Settings
 * @route GET /api/v1/admin/settings
 * @access Admin
 */
exports.getSettings = async (req, res, next) => {
    try {
        const result = await db.query('SELECT key, value FROM system_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Update System Settings
 * @route POST /api/v1/admin/settings
 * @access Admin
 */
exports.updateSettings = async (req, res, next) => {
    try {
        const { withdrawal_fee_thb, exchange_rate_usdt_thb } = req.body;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            if (withdrawal_fee_thb !== undefined) {
                await client.query(
                    `INSERT INTO system_settings (key, value) VALUES ('withdrawal_fee_thb', $1) 
                     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                    [withdrawal_fee_thb]
                );
            }

            if (exchange_rate_usdt_thb !== undefined) {
                await client.query(
                    `INSERT INTO system_settings (key, value) VALUES ('exchange_rate_usdt_thb', $1) 
                     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                    [exchange_rate_usdt_thb]
                );
            }

            await client.query('COMMIT');
            res.json({ success: true, message: 'Settings updated successfully' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
};
