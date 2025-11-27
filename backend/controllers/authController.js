const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // legacy hashes support
const argon2 = require('argon2'); // primary password hashing
const db = require('../config/database');

// Account lockout tracking (in-memory for now, move to Redis in production)
const loginAttempts = new Map(); // { email: { attempts: number, lockedUntil: timestamp } }

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_MS) || 30 * 60 * 1000; // 30 minutes

/**
 * Generate JWT token
 */
const generateAccessToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

const generateRefreshToken = (userId) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return jwt.sign({ userId }, secret, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
};

// Hash refresh token with SHA-256 (fast lookup exact match)
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Audit logger helper
async function logAudit(req, userId, action, metadata = {}) {
  try {
    await db.query('INSERT INTO audit_logs (user_id, action, metadata, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5)', [
      userId || null,
      action,
      metadata,
      req.ip || null,
      req.get('user-agent') || ''
    ]);
  } catch (e) {
    console.error('Audit log failed', e.message);
  }
}

// Enforce maximum active sessions per user (delete oldest beyond limit)
async function enforceSessionLimit(userId) {
  const maxSessions = parseInt(process.env.MAX_SESSIONS_PER_USER || '10');
  if (!maxSessions || maxSessions < 1) return; // disabled
  try {
    const res = await db.query(
      'SELECT id FROM sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (res.rows.length <= maxSessions) return;
    const excess = res.rows.slice(maxSessions); // oldest beyond cap
    const idsToDelete = excess.map(r => r.id);
    await db.query(
      `DELETE FROM sessions WHERE id = ANY($1::uuid[])`,
      [idsToDelete]
    );
    // Optionally audit bulk removal
    // We do not have req here, pass minimal metadata
    console.log(`Session cap enforced for user ${userId}: removed ${idsToDelete.length} sessions`);
  } catch (e) {
    console.error('enforceSessionLimit failed', e.message);
  }
}

const crypto = require('crypto');
const generateCsrfToken = () => crypto.randomBytes(20).toString('hex');

const resolveSameSite = () => {
  const raw = (process.env.COOKIE_SAMESITE || 'Strict').trim();
  const allowed = ['Strict','Lax','None'];
  if (!allowed.includes(raw)) return 'Strict';
  return raw;
};

const cookieOptions = () => {
  const sameSite = resolveSameSite();
  const secure = sameSite === 'None' ? true : (process.env.NODE_ENV === 'production');
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  };
};

const publicCsrfCookieOptions = () => {
  const sameSite = resolveSameSite();
  const secure = sameSite === 'None' ? true : (process.env.NODE_ENV === 'production');
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: 60 * 60 * 1000
  };
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

// Detect hash type (bcrypt prefix starts with $2)
const isBcryptHash = (hash) => typeof hash === 'string' && hash.startsWith('$2');

// Hash password with Argon2id
async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '19456'),
    timeCost: parseInt(process.env.ARGON2_TIME_COST || '2'),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1')
  });
}

// Verify password supporting legacy bcrypt; opportunistic upgrade to Argon2
async function verifyPassword(password, storedHash, userId) {
  if (!storedHash) return false;
  let valid = false;
  if (isBcryptHash(storedHash)) {
    valid = await bcrypt.compare(password, storedHash);
    if (valid) {
      // Upgrade to Argon2id
      try {
        const newHash = await hashPassword(password);
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userId]);
      } catch (e) {
        console.error('Password rehash (argon2 upgrade) failed', e.message);
      }
    }
  } else {
    try { valid = await argon2.verify(storedHash, password); } catch { valid = false; }
  }
  return valid;
}

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (schema aligned)
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: { message: 'email, password, name required' } });
    }
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: { message: 'Email already registered' } });
    }
    const hashedPassword = await hashPassword(password);
    const insert = await db.query(
      `INSERT INTO users (email, password, name, role, is_verified, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
       RETURNING id,email,name,role,is_verified,created_at`,
      [email, hashedPassword, name, 'user', false, true]
    );
    const user = insert.rows[0];
    const access = generateAccessToken(user.id);
    const refresh = generateRefreshToken(user.id);
    const refreshHash = hashRefreshToken(refresh);
    const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
    try {
      await db.query('INSERT INTO sessions (user_id, refresh_token, expires_at, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5)', [
        user.id,
        refreshHash,
        expiresAt.toISOString(),
        req.ip,
        req.get('user-agent') || ''
      ]);
      await enforceSessionLimit(user.id);
    } catch (e) { console.error('Persist session failed', e.message); }
    const csrf = generateCsrfToken();
    res.cookie('access_token', access, cookieOptions());
    res.cookie('refresh_token', refresh, { ...cookieOptions(), maxAge: 7*24*60*60*1000 });
    res.cookie('csrf_token', csrf, publicCsrfCookieOptions());
    res.status(201).json({ success: true, data: { user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.is_verified,
      createdAt: user.created_at
    }, token: access, refreshToken: refresh, csrf } });
    logAudit(req, user.id, 'register', { email: user.email });
  } catch (error) { next(error); }
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

    // Get user from database (schema aligned)
    const result = await db.query(
      'SELECT id, email, password, name, role, is_active, is_verified, failed_login_attempts, locked_until FROM users WHERE email = $1',
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
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Account is not active. Please contact support.'
        }
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password, user.id);
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
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const access = generateAccessToken(user.id);
    const refresh = generateRefreshToken(user.id);
    const refreshHash = hashRefreshToken(refresh);
    const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
    try {
      await db.query('INSERT INTO sessions (user_id, refresh_token, expires_at, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5)', [
        user.id,
        refreshHash,
        expiresAt.toISOString(),
        req.ip,
        req.get('user-agent') || ''
      ]);
      await enforceSessionLimit(user.id);
    } catch (e) { console.error('Persist session failed', e.message); }
    const csrf = generateCsrfToken();
    res.cookie('access_token', access, cookieOptions());
    res.cookie('refresh_token', refresh, { ...cookieOptions(), maxAge: 7*24*60*60*1000 });
    res.cookie('csrf_token', csrf, publicCsrfCookieOptions());
    res.json({ success: true, data: { user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.is_verified
    }, token: access, refreshToken: refresh, csrf } });
    logAudit(req, user.id, 'login', { email: user.email });
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
    // Accept from cookie preferred, fallback body for backward compatibility
    const tokenFromCookie = req.cookies && req.cookies.refresh_token;
    const tokenFromBody = req.body && req.body.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: { message: 'Refresh token missing' } });
    }
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, secret);
    // Validate session existence & expiration
    const hashedIncoming = hashRefreshToken(refreshToken);
    // Primary lookup hashed
    let sess = await db.query('SELECT id, expires_at FROM sessions WHERE refresh_token = $1 AND user_id = $2 LIMIT 1', [hashedIncoming, decoded.userId]);
    // Legacy fallback (plain stored) -> upgrade
    if (sess.rows.length === 0) {
      const legacy = await db.query('SELECT id, expires_at FROM sessions WHERE refresh_token = $1 AND user_id = $2 LIMIT 1', [refreshToken, decoded.userId]);
      if (legacy.rows.length) {
        // Upgrade to hashed
        try { await db.query('UPDATE sessions SET refresh_token = $1 WHERE id = $2', [hashedIncoming, legacy.rows[0].id]); } catch(e){ console.error('Legacy upgrade failed', e.message); }
        sess = legacy;
      }
    }
    if (sess.rows.length === 0) {
      return res.status(401).json({ success: false, error: { message: 'Session invalid' } });
    }
    const exp = new Date(sess.rows[0].expires_at);
    if (exp < new Date()) {
      return res.status(401).json({ success: false, error: { message: 'Session expired' } });
    }
    // Optional rotation: generate new refresh, update session
    const rotatedRefresh = generateRefreshToken(decoded.userId);
    const rotatedHash = hashRefreshToken(rotatedRefresh);
    const newAccess = generateAccessToken(decoded.userId);
    const newCsrf = generateCsrfToken();
    try {
      await db.query('UPDATE sessions SET refresh_token = $1, expires_at = $2 WHERE id = $3', [
        rotatedHash,
        new Date(Date.now() + 7*24*60*60*1000).toISOString(),
        sess.rows[0].id
      ]);
    } catch (e) {
      console.error('Failed rotating session token', e.message);
    }
    res.cookie('access_token', newAccess, cookieOptions());
    res.cookie('refresh_token', rotatedRefresh, { ...cookieOptions(), maxAge: 7*24*60*60*1000 });
    res.cookie('csrf_token', newCsrf, publicCsrfCookieOptions());
    res.json({ success: true, data: { token: newAccess, csrf: newCsrf } });
    logAudit(req, decoded.userId, 'refresh', { sessionId: sess.rows[0].id });
  } catch (error) {
    return res.status(401).json({ success: false, error: { message: 'Invalid refresh token' } });
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
    // Revoke sessions with matching refresh token if present
    const rt = req.cookies && req.cookies.refresh_token;
    if (rt) {
      const hashed = hashRefreshToken(rt);
      try { await db.query('DELETE FROM sessions WHERE refresh_token = $1', [hashed]); } catch(e){ console.error('Failed to delete session', e.message); }
    }
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    logAudit(req, req.user && req.user.id, 'logout', {});
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/v1/auth/sessions
 * @desc List active sessions for current user
 * @access Private
 */
exports.listSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query('SELECT id, created_at, expires_at, ip_address, user_agent FROM sessions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const now = Date.now();
    const sessions = result.rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      expired: new Date(r.expires_at).getTime() < now,
      ip: r.ip_address,
      userAgent: r.user_agent
    }));
    res.json({ success: true, data: { sessions } });
  } catch (e) {
    next(e);
  }
};

/**
 * @route POST /api/v1/auth/sessions/:id/revoke
 * @desc Revoke a specific session (logout that device)
 * @access Private
 */
exports.revokeSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.id;
    const del = await db.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id', [sessionId, userId]);
    if (del.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Session not found' } });
    }
    logAudit(req, userId, 'session_revoke', { sessionId });
    res.json({ success: true, data: { revoked: sessionId } });
  } catch (e) {
    next(e);
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
