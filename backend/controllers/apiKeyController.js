const { pool } = require('../config/database');
const crypto = require('crypto');

// Helper to generate secure random string
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Helper to hash key
const hashKey = (key) => {
    return crypto.createHash('sha256').update(key).digest('hex');
};

exports.getApiKeys = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT id, name, public_key, status, last_used_at, created_at 
             FROM api_keys 
             WHERE user_id = $1 AND status = 'active' 
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: {
                apiKeys: result.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createApiKey = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: { message: 'Key name is required' } });
        }

        // Generate Keys
        const publicKey = 'pk_live_' + generateRandomString(16);
        const secretKey = 'sk_live_' + generateRandomString(24);
        const secretKeyHash = hashKey(secretKey);

        await client.query('BEGIN');

        const insertRes = await client.query(
            `INSERT INTO api_keys (user_id, name, public_key, secret_key_hash) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, name, public_key, created_at, status`,
            [userId, name, publicKey, secretKeyHash]
        );

        await client.query('COMMIT');

        const newKey = insertRes.rows[0];

        res.status(201).json({
            success: true,
            data: {
                apiKey: {
                    ...newKey,
                    secret_key: secretKey // Returned ONLY ONCE
                }
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

exports.revokeApiKey = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const keyId = req.params.id;

        const result = await pool.query(
            `UPDATE api_keys 
             SET status = 'revoked' 
             WHERE id = $1 AND user_id = $2 
             RETURNING id`,
            [keyId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: { message: 'API key not found' } });
        }

        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
    } catch (error) {
        next(error);
    }
};
