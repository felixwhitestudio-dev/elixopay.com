const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

// Account lockout tracking (in-memory for now, move to Redis in production)
const loginAttempts = new Map(); // { email: { attempts: number, lockedUntil: timestamp } }

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_MS) || 30 * 60 * 1000; // 30 minutes

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your_jwt_secret_here_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Check if account is locked
 */
const isAccountLocked = (email) => {
  const attempt = loginAttempts.get(email);
  if (!attempt) return false;
  
  if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    return true;
  }
  
  // Unlock if lockout period has passed
  if (attempt.lockedUntil && attempt.lockedUntil <= Date.now()) {
    loginAttempts.delete(email);
    return false;
  }
  
  return false;
};

/**
 * Record failed login attempt
 */
const recordFailedAttempt = (email) => {
  const attempt = loginAttempts.get(email) || { attempts: 0, lockedUntil: null };
  attempt.attempts += 1;
  
  if (attempt.attempts >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  
  loginAttempts.set(email, attempt);
  return attempt;
};

/**
 * Reset login attempts on successful login
 */
const resetLoginAttempts = (email) => {
  loginAttempts.delete(email);
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'User with this email already exists'
        }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status, email_verified, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id, email, first_name, last_name, status, email_verified, created_at`,
      [email, hashedPassword, name, '', 'active', false]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.first_name,
          role: 'user',
          isVerified: user.email_verified,
          createdAt: user.created_at
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if account is locked
    if (isAccountLocked(email)) {
      const attempt = loginAttempts.get(email);
      const remainingTime = Math.ceil((attempt.lockedUntil - Date.now()) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: {
          message: `Account temporarily locked due to too many failed login attempts. Try again in ${remainingTime} minutes.`,
          lockedUntil: new Date(attempt.lockedUntil).toISOString()
        }
      });
    }

    // Get user from database
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      recordFailedAttempt(email);
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password'
        }
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Account is not active. Please contact support.'
        }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const attempt = recordFailedAttempt(email);
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempt.attempts;
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password',
          remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
          warning: remainingAttempts <= 0 ? 'Account will be locked' : null
        }
      });
    }

    // Successful login - reset attempts
    resetLoginAttempts(email);
    
    // Update last login and reset failed attempts
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE email = $1',
      [email]
    );

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          role: 'user'
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Refresh token is required'
        }
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your_refresh_token_secret_here'
    );

    // Generate new access token
    const token = generateToken(decoded.userId);

    res.json({
      success: true,
      data: {
        token
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid refresh token'
      }
    });
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // In a real application, you would invalidate the token here
    // For now, just return success
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/2fa/enable
 * @desc    Enable 2FA
 * @access  Private
 */
exports.enable2FA = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        secret: 'mock_2fa_secret'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/2fa/verify
 * @desc    Verify 2FA code
 * @access  Private
 */
exports.verify2FA = async (req, res, next) => {
  try {
    const { code } = req.body;

    res.json({
      success: true,
      message: '2FA verified successfully'
    });
  } catch (error) {
    next(error);
  }
};
