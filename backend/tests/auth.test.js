const request = require('supertest');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

// Mock database module
jest.mock('../config/database', () => ({
  query: jest.fn()
}));
const db = require('../config/database');

// Mock auth middleware to allow protected routes in tests
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    // Simulate authenticated user
    req.user = { id: 'u4', email: 'test@example.com', role: 'user' };
    next();
  }
}));

// Ensure env secrets
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.API_VERSION = 'v1';
process.env.MAX_SESSIONS_PER_USER = '5';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

// Import app AFTER env + mocks
const app = require('../server');

// Helper to extract cookie by name
function getCookie(res, name) {
  const raw = res.headers['set-cookie'] || [];
  const found = raw.find(c => c.startsWith(name + '='));
  return found || null;
}

beforeEach(() => {
  db.query.mockReset();
});

describe('Auth Flow', () => {
  test('Register success sets cookies and returns user', async () => {
    // Query chain for register
    // 1: SELECT existing email
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    // 2: INSERT user
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 'u1', email: 'new@example.com', name: 'New User', role: 'user', is_verified: false, created_at: new Date().toISOString() }] }));
    // 3: INSERT session
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    // 4: Session limit SELECT
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'Password123!', name: 'New User' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new@example.com');
    expect(getCookie(res, 'access_token')).toBeTruthy();
    expect(getCookie(res, 'refresh_token')).toBeTruthy();
    expect(getCookie(res, 'csrf_token')).toBeTruthy();
  });

  test('Login with bcrypt hash upgrades to Argon2 and sets cookies', async () => {
    const bcrypt = require('bcryptjs');
    const legacyHash = bcrypt.hashSync('Password123!', 10);

    // 1: SELECT user
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 'u2', email: 'legacy@example.com', password: legacyHash, name: 'Legacy', role: 'user', is_active: true, is_verified: true }] }));
    // Upgrade password UPDATE (from verifyPassword)
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    // last_login UPDATE
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    // INSERT session
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    // Session limit SELECT
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'legacy@example.com', password: 'Password123!' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE users SET password/); // upgrade call
    const upgradedHash = db.query.mock.calls[1][1][0];
    expect(upgradedHash.startsWith('$argon2id$')).toBe(true);
    expect(getCookie(res, 'access_token')).toBeTruthy();
  });

  test('Refresh rotates session and returns new access token', async () => {
    // Create a valid refresh JWT
    const refreshToken = jwt.sign({ userId: 'u3' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // 1: SELECT session by hashed token
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 's1', expires_at: new Date(Date.now()+3600_000).toISOString() }] }));
    // 2: UPDATE rotated session
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${refreshToken}`])
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(getCookie(res, 'access_token')).toBeTruthy();
    expect(getCookie(res, 'refresh_token')).toBeTruthy();
  });

  test('Logout clears cookies and deletes session', async () => {
    // Step 1: call refresh to obtain a csrf_token cookie
    const refreshToken = jwt.sign({ userId: 'u4' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    // 1: SELECT session by hashed token
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 's2', expires_at: new Date(Date.now()+3600_000).toISOString() }] }));
    // 2: UPDATE rotated session
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${refreshToken}`])
      .send({})
      .expect(200);

    const csrfCookieRaw = getCookie(refreshRes, 'csrf_token');
    expect(csrfCookieRaw).toBeTruthy();
    const csrfValue = csrfCookieRaw.split(';')[0].split('=')[1];

    // Step 2: now logout with CSRF header and keep cookies
    // Prepare DELETE query mock for session removal
    db.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshRes.headers['set-cookie'])
      .set('X-CSRF-Token', csrfValue)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(db.query.mock.calls[2][0]).toMatch(/DELETE FROM sessions/);
  });
});
