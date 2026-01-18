const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Request a withdrawal
 * @route   POST /api/v1/wallet/withdraw
 * @access  Private
 */
exports.requestWithdrawal = async (req, res, next) => {
    let client;
    try {
        const { amount, bankName, accountName, accountNumber } = req.body;
        const userId = req.user.id;

        // Validation
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
        }
        if (!bankName || !accountName || !accountNumber) {
            return res.status(400).json({ success: false, error: { message: 'Bank details are required' } });
        }

        // Use a transaction
        client = await db.pool.connect();
        await client.query('BEGIN');

        // 1. Check Balance
        // We assume 'THB' for now as per dashboard default, or we can take currency from body
        const currency = 'THB';

        const walletRes = await client.query(
            'SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
            [userId, currency]
        );

        if (walletRes.rows.length === 0) {
            throw new Error('Wallet not found');
        }

        const wallet = walletRes.rows[0];
        if (parseFloat(wallet.balance) < parseFloat(amount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: { message: 'Insufficient balance' } });
        }

        // 2. Deduct Balance
        const newBalance = parseFloat(wallet.balance) - parseFloat(amount);
        await client.query(
            'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newBalance, wallet.id]
        );

        // 3. Create Pending Withdrawal Record in Payments
        // We treat withdrawal as a "payment" with status pending, type/method = withdrawal
        const metadata = {
            bankName,
            accountName,
            accountNumber,
            type: 'withdrawal_request'
        };

        const token = uuidv4();

        const paymentRes = await client.query(
            `INSERT INTO payments (
                user_id, amount, currency, status, payment_method, metadata, description, token
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [userId, amount, currency, 'pending', 'bank_transfer', metadata, `Withdrawal request to ${bankName} (${accountNumber})`, token]
        );

        // 4. Create Transaction Log (Outgoing)
        await client.query(
            `INSERT INTO transaction_logs (
                wallet_id, user_id, type, amount, currency, description, related_wallet_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [wallet.id, userId, 'withdraw', amount, currency, 'Withdrawal Request', 'External Bank']
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                message: 'Withdrawal requested successfully',
                withdrawalId: paymentRes.rows[0].id,
                remainingBalance: newBalance
            }
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        next(error);
    } finally {
        if (client) client.release();
    }
};

/**
 * @desc    Process an instant deposit (Dev/Demo purpose)
 * @route   POST /api/v1/wallet/deposit
 * @access  Private
 */
exports.processDeposit = async (req, res, next) => {
    let client;
    try {
        const { amount, channel } = req.body;
        const userId = req.user.id;

        // Validation
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
        }

        client = await db.pool.connect();
        await client.query('BEGIN');

        const currency = 'THB';

        // 1. Get Wallet
        const walletRes = await client.query(
            'SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
            [userId, currency]
        );

        if (walletRes.rows.length === 0) {
            throw new Error('Wallet not found');
        }

        const wallet = walletRes.rows[0];

        // 2. Increase Balance
        const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
        await client.query(
            'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newBalance, wallet.id]
        );

        // 3. Create Completed Payment Record
        const metadata = {
            channel: channel || 'bank',
            type: 'instant_deposit'
        };

        // Map channel to valid payment_method
        let paymentMethod = 'internet_banking';
        if (channel === 'promptpay') paymentMethod = 'promptpay';
        if (channel === 'card') paymentMethod = 'card';

        const token = uuidv4();

        const paymentRes = await client.query(
            `INSERT INTO payments (
                user_id, amount, currency, status, payment_method, metadata, description, token
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [userId, amount, currency, 'succeeded', paymentMethod, metadata, `Deposit via ${channel || 'Bank'}`, token]
        );

        // 4. Create Transaction Log (Incoming)
        await client.query(
            `INSERT INTO transaction_logs (
                wallet_id, user_id, type, amount, currency, description, related_wallet_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [wallet.id, userId, 'deposit', amount, currency, 'Instant Deposit', 'System']
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                message: 'Deposit successful',
                paymentId: paymentRes.rows[0].id,
                balance: newBalance
            }
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        next(error);
    } finally {
        if (client) client.release();
    }
};
