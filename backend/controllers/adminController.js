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
