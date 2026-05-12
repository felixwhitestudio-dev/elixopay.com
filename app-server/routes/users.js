const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
// DISABLED: Crypto features removed for banking compliance
// const { sendUSDT_TRON } = require('../utils/usdt_trc20');

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        ...req.user,
        ...req.body
      }
    }
  });
});

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        totalPayments: 135,
        totalRevenue: 99.99,
        activeApiKeys: 2,
        uptime: 99.99
      }
    }
  });
});

/**
 * @route   GET /api/v1/users/wallet
 * @desc    Get current user's wallet
 * @access  Private
 */
router.get('/wallet', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const currency = req.query.currency;

    // 1. Fetch ALL wallets for this user (ignore currency filter in SQL)
    const query = 'SELECT id, wallet_address, balance, currency, is_active, created_at, updated_at FROM wallets WHERE user_id = $1';
    const params = [userId];

    // Fetch ALL wallets
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Wallet not found' } });
    }

    // 2. Identify distinct wallets
    const allWallets = result.rows;
    const thbWallet = allWallets.find(w => w.currency === 'THB');

    // 3. Determine the primary wallet (THB only — crypto disabled for banking compliance)
    const primaryWallet = thbWallet || allWallets[0];

    // 4. Return
    res.json({ success: true, data: { wallet: primaryWallet } });
  } catch (error) {
    console.error('Wallet Fetch Error:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   GET /api/v1/users/wallet/transactions
 * @desc    Get transaction logs for current user's wallet
 * @access  Private
 */
router.get('/wallet/transactions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Get wallet id
    const walletRes = await db.query('SELECT id FROM wallets WHERE user_id = $1', [userId]);
    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Wallet not found' } });
    }
    const walletId = walletRes.rows[0].id;
    // Get transaction logs (latest first)
    const txRes = await db.query('SELECT id, type, amount, currency, related_wallet_address, description, created_at FROM transaction_logs WHERE wallet_id = $1 ORDER BY created_at DESC', [walletId]);
    res.json({ success: true, data: { transactions: txRes.rows } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/users/wallet/deposit
 * @desc    Deposit money to current user's wallet
 * @access  Private
 */
router.post('/wallet/deposit', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
    }
    // ตรวจสอบ currency
    const walletRes = await db.query('SELECT id, currency FROM wallets WHERE user_id = $1', [userId]);
    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Wallet not found' } });
    }
    const wallet = walletRes.rows[0];
    if (currency && currency !== wallet.currency) {
      return res.status(400).json({ success: false, error: { message: 'Currency mismatch' } });
    }
    const result = await db.query('UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *', [amount, userId]);
    // Log transaction
    await db.query('INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, description) VALUES ($1, $2, $3, $4, $5, $6)', [wallet.id, userId, 'deposit', amount, wallet.currency, 'Deposit to wallet']);
    res.json({ success: true, data: { wallet: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   GET /api/v1/users/bank-accounts
 * @desc    Get user's bank accounts
 * @access  Private
 */
router.get('/bank-accounts', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM user_bank_accounts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, data: { bank_accounts: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/users/bank-accounts
 * @desc    Add a new bank account
 * @access  Private
 */
router.post('/bank-accounts', authenticate, async (req, res) => {
  try {
    const { bank_name, account_name, account_number, is_primary } = req.body;

    if (!bank_name || !account_name || !account_number) {
      return res.status(400).json({ success: false, error: { message: 'All fields are required' } });
    }

    // If setting as primary, unset others first
    if (is_primary) {
      await db.query('UPDATE user_bank_accounts SET is_primary = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await db.query(
      'INSERT INTO user_bank_accounts (user_id, bank_name, account_name, account_number, is_primary) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, bank_name, account_name, account_number, is_primary || false]
    );

    res.json({ success: true, data: { bank_account: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   DELETE /api/v1/users/bank-accounts/:id
 * @desc    Delete a bank account
 * @access  Private
 */
router.delete('/bank-accounts/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM user_bank_accounts WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Bank account not found' } });
    }
    res.json({ success: true, data: { message: 'Deleted successfully' } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/users/wallet/withdraw
 * @desc    Withdraw money from current user's wallet
 * @access  Private
 */
router.post('/wallet/withdraw', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency, bank_account_id } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
    }

    // Check balance and currency
    const walletRes = await db.query('SELECT id, balance, currency FROM wallets WHERE user_id = $1', [userId]);
    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Wallet not found' } });
    }
    const wallet = walletRes.rows[0];
    if (currency && currency !== wallet.currency) {
      return res.status(400).json({ success: false, error: { message: 'Currency mismatch' } });
    }
    if (parseFloat(wallet.balance) < amount) {
      return res.status(400).json({ success: false, error: { message: 'Insufficient balance' } });
    }

    // Get Bank Account Details (if provided)
    let description = 'Withdraw from wallet';
    if (bank_account_id) {
      const bankRes = await db.query('SELECT * FROM user_bank_accounts WHERE id = $1 AND user_id = $2', [bank_account_id, userId]);
      if (bankRes.rows.length > 0) {
        const bank = bankRes.rows[0];
        description = `Withdraw to ${bank.bank_name} (${bank.account_number})`;
      } else {
        return res.status(400).json({ success: false, error: { message: 'Invalid bank account' } });
      }
    }

    const result = await db.query('UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *', [amount, userId]);

    // Log transaction with updated description
    await db.query('INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, description) VALUES ($1, $2, $3, $4, $5, $6)', [wallet.id, userId, 'withdraw', amount, wallet.currency, description]);

    res.json({ success: true, data: { wallet: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/*
 * DISABLED: Crypto features removed for banking compliance
 * The following routes have been disabled:
 * - POST /wallet/withdraw-usdt-onchain (USDT TRC20 withdrawal)
 * - POST /wallet/exchange (THB to USDT exchange)
 * To re-enable, uncomment these routes and restore tronweb dependency.
 */

/*
 * DISABLED: P2P Transfer feature removed for banking compliance
 * This route allowed user-to-user money transfers which constitutes P2P.
 * Route: POST /api/v1/users/wallet/transfer
 * To re-enable, uncomment this route.
 */

module.exports = router;
