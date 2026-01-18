const request = require('supertest');

// Mock database module
const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

jest.mock('../config/database', () => ({
    query: jest.fn(),
    getClient: jest.fn(() => Promise.resolve(mockClient))
}));

const db = require('../config/database');

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'sender_id', email: 'sender@example.com', role: 'user' };
        next();
    }
}));

process.env.API_VERSION = 'v1';
const app = require('../server');

beforeEach(() => {
    db.query.mockReset();
    db.getClient.mockClear();
    mockClient.query.mockReset();
    mockClient.release.mockClear();
});

describe('Transfer Flow', () => {

    test('Transfer via Email Success', async () => {
        // 1. BEGIN
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 2. Select Sender Wallet
        mockClient.query.mockResolvedValueOnce({
            rows: [{ id: 'w1', balance: '1000', currency: 'USDT', wallet_address: 'Tsender' }]
        });
        // 3. Find Recipient via Email
        mockClient.query.mockResolvedValueOnce({
            rows: [{ id: 'w2', user_id: 'recipient_id', currency: 'USDT', wallet_address: 'Trecipient' }]
        });
        // 4. Update Sender
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 5. Update Recipient
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 6. Log Sender
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 7. Log Recipient
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 8. COMMIT
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/v1/users/wallet/transfer')
            .send({
                to_wallet_address: 'recipient@example.com',
                amount: 100,
                currency: 'USDT'
            })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(mockClient.query).toHaveBeenCalledTimes(8);
    });

    test('Transfer via Address Success', async () => {
        // 1. BEGIN
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 2. Select Sender Wallet
        mockClient.query.mockResolvedValueOnce({
            rows: [{ id: 'w1', balance: '1000', currency: 'USDT', wallet_address: 'Tsender' }]
        });
        // 3. Find Recipient via Address
        mockClient.query.mockResolvedValueOnce({
            rows: [{ id: 'w2', user_id: 'recipient_id', currency: 'USDT', wallet_address: 'Trecipient' }]
        });
        // 4. Update Sender
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 5. Update Recipient
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 6. Log Sender
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 7. Log Recipient
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 8. COMMIT
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/v1/users/wallet/transfer')
            .send({
                to_wallet_address: 'Trecipient',
                amount: 100,
                currency: 'USDT'
            })
            .expect(200);

        expect(res.body.success).toBe(true);
    });

    test('Transfer fail insufficient balance', async () => {
        // 1. BEGIN
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        // 2. Select Sender Wallet
        mockClient.query.mockResolvedValueOnce({
            rows: [{ id: 'w1', balance: '50', currency: 'USDT', wallet_address: 'Tsender' }]
        });
        // 3. ROLLBACK (implied in catch/logic)
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/v1/users/wallet/transfer')
            .send({
                to_wallet_address: 'Trecipient',
                amount: 100,
                currency: 'USDT'
            })
            .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toBe('Insufficient balance');
    });

});
