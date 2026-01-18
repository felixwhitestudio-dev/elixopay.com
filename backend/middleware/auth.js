const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * Authentication middleware
 * Verifies JWT token OR API Key and attaches user to request
 */
exports.authenticate = async (req, res, next) => {
  try {
    let token = req.cookies && req.cookies.access_token;

    // Fallback: Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // 1. Check for API Key (Starts with sk_)
    if (token && token.startsWith('sk_')) {
      const hash = crypto.createHash('sha256').update(token).digest('hex');

      // Find key and join user
      const result = await pool.query(
        `SELECT ak.id as key_id, ak.user_id, u.email, u.first_name, u.account_type, u.status 
             FROM api_keys ak
             JOIN users u ON ak.user_id = u.id
             WHERE ak.secret_key_hash = $1 AND ak.status = 'active'`,
        [hash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: { message: 'Invalid API Key' } });
      }

      const row = result.rows[0];

      // Update last used
      await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.key_id]);

      req.user = {
        id: row.user_id,
        email: row.email,
        name: (row.first_name || 'Merchant').trim(),
        role: row.account_type,
        isApiKey: true,
        keyId: row.key_id
      };
      return next();
    }

    // 2. Standard JWT Check
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authenticated' }
      });
    }

    const secret = process.env.JWT_SECRET || 'dev_secret_key_123';
    const decoded = jwt.verify(token, secret);

    // Load real user from DB
    // Use pool from config instead of requiring again
    const result = await pool.query('SELECT id, email, first_name, last_name, account_type, status, email_verified FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: { message: 'User not found' } });
    }
    const row = result.rows[0];
    if (row.status !== 'active') {
      return res.status(403).json({ success: false, error: { message: 'Account inactive' } });
    }
    req.user = {
      id: row.id,
      email: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      role: row.account_type,
      isVerified: row.email_verified
    };

    next();
  } catch (error) {
    const base = {
      success: false,
      error: { message: 'Authentication failed' }
    };
    if (error.name === 'JsonWebTokenError') {
      base.error.message = 'Invalid token';
      return res.status(401).json(base);
    }
    if (error.name === 'TokenExpiredError') {
      base.error.message = 'Token expired';
      return res.status(401).json(base);
    }
    console.error('Auth Middleware Error:', error);
    return res.status(500).json(base);
  }
};

/**
 * Role-based authorization middleware
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Not authenticated'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized to access this resource'
        }
      });
    }

    next();
  };
};
