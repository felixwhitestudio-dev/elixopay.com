const request = require('supertest');
const db = require('../config/database');
const app = require('../server');
const authController = require('../controllers/authController');

// Mock DB
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Mock Auth Middleware if needed (dev-login is public, but let's be safe)
jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => next()
}));

describe('Dev Login', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('dev-login returns token for existing user', async () => {
        // Mock finding user
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 'u_dev',
                email: 'admin@elixopay.com',
                account_type: 'admin',
                first_name: 'Admin',
                last_name: 'User',
                email_verified: true,
                created_at: new Date()
            }]
        });

        const res = await request(app).post('/api/v1/auth/dev-login');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
        // Check cookie
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
    });

    test('dev-login fails in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const res = await request(app).post('/api/v1/auth/dev-login');
        expect(res.status).toBe(403);

        process.env.NODE_ENV = originalEnv;
    });
});
