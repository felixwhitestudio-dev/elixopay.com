const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Preferred: read JWT from secure HttpOnly cookie
    let token = req.cookies && req.cookies.access_token;

    // Fallback: Authorization header (backward compatibility)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authenticated' }
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load real user from DB
    const db = require('../config/database');
    const result = await db.query('SELECT id, email, name, role, is_active, is_verified FROM users WHERE id = $1 LIMIT 1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: { message: 'User not found' } });
    }
    const row = result.rows[0];
    if (!row.is_active) {
      return res.status(403).json({ success: false, error: { message: 'Account inactive' } });
    }
    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isVerified: row.is_verified
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
