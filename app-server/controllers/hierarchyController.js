const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');

/**
 * @route   GET /api/v1/hierarchy
 * @desc    Get full hierarchy tree for the current user (Partner/Organizer)
 * @access  Private
 */
exports.getHierarchy = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Recursive query to fetch entire subtree
        const result = await pool.query(`
            WITH RECURSIVE bfs_tree AS (
                SELECT id, first_name, last_name, email, account_type, status, parent_id, created_at, 0 as depth
                FROM users
                WHERE id = $1
                UNION ALL
                SELECT u.id, u.first_name, u.last_name, u.email, u.account_type, u.status, u.parent_id, u.created_at, bt.depth + 1
                FROM users u
                INNER JOIN bfs_tree bt ON u.parent_id = bt.id
                WHERE bt.depth < 10 -- Safety limit
            )
            SELECT * FROM bfs_tree WHERE id != $1 ORDER BY depth, created_at DESC;
        `, [userId]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/v1/hierarchy/create
 * @desc    Create a direct sub-account (e.g., Partner creates Organizer/Agent)
 * @access  Private
 */
exports.createSubAccount = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { email, password, firstName, lastName, role, feeRate } = req.body;
        const parentId = req.user.id;

        // Validation: Ensure Role is allowed (Partner -> Organizer -> Agent -> Merchant)
        const parentRole = req.user.role; // Assuming middleware populates this

        // Simple hierarchy check
        const allowed = {
            'partner': ['organizer', 'agent'],
            'organizer': ['agent', 'merchant'],
            'agent': ['merchant']
        };

        if (req.user.email === 'demo@elixopay.com') {
            // Bypass for demo user allow creating any role
        } else if (!allowed[parentRole] || !allowed[parentRole].includes(role)) {
            return res.status(403).json({ success: false, error: { message: `Cannot create ${role} from ${parentRole}` } });
        }

        const hashedPassword = await argon2.hash(password);

        await client.query('BEGIN');

        // 1. Create User
        const insertUser = await client.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id, created_at)
             VALUES ($1, $2, $3, $4, $5, 'active', true, $6, NOW())
             RETURNING id, email`,
            [email, hashedPassword, firstName, lastName, role, parentId]
        );
        const newUser = insertUser.rows[0];

        // 2. Create Wallet
        const walletAddress = uuidv4();
        await client.query(
            `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
             VALUES ($1, $2, 0.00, 'THB', true, NOW())`,
            [newUser.id, walletAddress]
        );

        // 3. Set Fee Config (if provided)
        if (feeRate !== undefined) {
            await client.query(
                `INSERT INTO fee_configs (user_id, set_by_id, rate_percent)
                 VALUES ($1, $2, $3)`,
                [newUser.id, parentId, feeRate]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: { user: newUser } });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ success: false, error: { message: 'Email already exists' } });
        }
        next(error);
    } finally {
        client.release();
    }
};

/**
 * @route   PUT /api/v1/hierarchy/user/:id
 * @desc    Update sub-account (Status, Fee)
 * @access  Private
 */
exports.updateSubAccount = async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const parentId = req.user.id;
        const { status, feeRate } = req.body;

        // Verify ownership (Must be in subtree)
        // Simplified: Check if direct parent OR use recursive check. 
        // For performance/security, strict direct parent is safest for "management", 
        // but Requirement says "Master Account... manage all 10 levels".
        // Let's do a quick check if this parent is an ancestor.
        const pathRes = await pool.query(`
            WITH RECURSIVE ancestors AS (
                SELECT id, parent_id FROM users WHERE id = $1
                UNION ALL
                SELECT u.id, u.parent_id FROM users u INNER JOIN ancestors a ON u.id = a.parent_id
            )
            SELECT id FROM ancestors WHERE id = $2
        `, [targetId, parentId]);

        if (pathRes.rows.length === 0) {
            return res.status(403).json({ success: false, error: { message: 'Not authorized to manage this user' } });
        }

        // Update Status
        if (status) { // 'active', 'disabled'
            await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, targetId]);
        }

        // Update Fee (Upsert)
        if (feeRate !== undefined) {
            await pool.query(`
                INSERT INTO fee_configs (user_id, set_by_id, rate_percent, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, set_by_id) 
                DO UPDATE SET rate_percent = $3, updated_at = NOW()
            `, [targetId, parentId, feeRate]);
        }

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        next(error);
    }
};
