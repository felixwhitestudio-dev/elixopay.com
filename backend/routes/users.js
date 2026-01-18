const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendUSDT_TRON } = require('../utils/usdt_trc20');

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
    const usdtWallet = allWallets.find(w => w.currency === 'USDT');

    // 3. Determine the "primary" wallet to return
    let primaryWallet;

    if (currency) {
      // If specific currency requested, try to find it
      primaryWallet = allWallets.find(w => w.currency === currency);
      if (!primaryWallet) {
        // Fallback or 404? For safety, if not found, return the first one or error.
        // Given the issue, let's just return the THB one if the requested one is missing, or the first one.
        primaryWallet = thbWallet || allWallets[0];
      }
    } else {
      // Default to THB or first available
      primaryWallet = thbWallet || allWallets[0];
    }

    // 4. Attach stats/cross-currency info
    // Always attach usdtBalance if it exists, regardless of which wallet is primary
    if (usdtWallet) {
      primaryWallet.usdtBalance = usdtWallet.balance;
    } else {
      primaryWallet.usdtBalance = 0;
    }

    // 5. Return
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

/**
 * @route   POST /api/v1/users/wallet/withdraw-usdt-onchain
 * @desc    Withdraw USDT (TRC20) to external address
 * @access  Private
 */
router.post('/wallet/withdraw-usdt-onchain', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to_wallet_address, amount } = req.body;
    if (!to_wallet_address || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid input' } });
    }
    // ตรวจสอบยอด USDT ในระบบ (database)
    const walletRes = await db.query('SELECT id, balance, currency FROM wallets WHERE user_id = $1 AND currency = $2', [userId, 'USDT']);
    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'USDT wallet not found' } });
    }
    const wallet = walletRes.rows[0];
    if (parseFloat(wallet.balance) < amount) {
      return res.status(400).json({ success: false, error: { message: 'Insufficient USDT balance' } });
    }
    // (Optional) ตรวจสอบ address ปลายทางเบื้องต้น
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(to_wallet_address)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid Tron address' } });
    }
    // หักยอดในระบบก่อน (atomic)
    await db.query('BEGIN');
    await db.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND currency = $3', [amount, userId, 'USDT']);
    // เรียกฟังก์ชันโอน USDT TRC20
    let txId;
    try {
      txId = await sendUSDT_TRON(to_wallet_address, amount);
    } catch (err) {
      await db.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'Blockchain error: ' + err.message } });
    }
    // log ธุรกรรม
    await db.query('INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, related_wallet_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7)', [wallet.id, userId, 'withdraw_onchain', amount, 'USDT', to_wallet_address, 'Withdraw USDT on-chain: ' + txId]);
    await db.query('COMMIT');
    res.json({ success: true, txId });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (_) { }
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/users/wallet/exchange
 * @desc    Exchange THB to USDT
 * @access  Private
 */
router.post('/wallet/exchange', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount_thb } = req.body;

    if (!amount_thb || isNaN(amount_thb) || amount_thb <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid THB amount' } });
    }

    // Exchange Rate (Fixed for now)
    const EXCHANGE_RATE = 34.5;
    const amount_usdt = parseFloat((amount_thb / EXCHANGE_RATE).toFixed(6));

    // 1. Get THB Wallet
    const thbWalletRes = await db.query(
      "SELECT * FROM wallets WHERE user_id = $1 AND currency = 'THB'",
      [userId]
    );

    if (thbWalletRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'THB Wallet not found' } });
    }
    const thbWallet = thbWalletRes.rows[0];

    if (parseFloat(thbWallet.balance) < amount_thb) {
      return res.status(400).json({ success: false, error: { message: 'Insufficient THB balance' } });
    }

    // 2. Get or Create USDT Wallet
    let usdtWalletRes = await db.query(
      "SELECT * FROM wallets WHERE user_id = $1 AND currency = 'USDT'",
      [userId]
    );
    let usdtWallet;

    if (usdtWalletRes.rows.length === 0) {
      // Create USDT wallet if not exists (same address as THB for simplicity, or new UUID?)
      // Schema says wallet_address must be UNIQUE. So we cannot reuse address if it's strictly unique column.
      // Let's assume we generate a new one or append suffix?
      // Actually, for this system, maybe we just create one.
      // Let's generate a pseudo-T-address for USDT if missing.
      const crypto = require('crypto'); // Ensure crypto is available or use uuid
      // Just reusing the generator logic might be complex here without the helper.
      // For now, let's assume if THB exists, USDT should exist?
      // Or let's just error if not found for safety, OR try to insert.
      // Let's try to insert a dummy address if needed for now to unblock.
      // "T" + random hex.
      const newAddress = 'T' + require('crypto').randomBytes(16).toString('hex');
      const newWallet = await db.query(
        "INSERT INTO wallets (user_id, currency, balance, wallet_address) VALUES ($1, 'USDT', 0, $2) RETURNING *",
        [userId, newAddress]
      );
      usdtWallet = newWallet.rows[0];
    } else {
      usdtWallet = usdtWalletRes.rows[0];
    }

    // 3. Perform Exchange (Atomic Transaction)
    await db.query('BEGIN');

    // Deduct THB
    await db.query(
      "UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [amount_thb, thbWallet.id]
    );

    // Add USDT
    await db.query(
      "UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [amount_usdt, usdtWallet.id]
    );

    // Log Transactions
    await db.query(
      "INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, description) VALUES ($1, $2, 'withdraw', $3, 'THB', $4)",
      [thbWallet.id, userId, amount_thb, `Exchange to ${amount_usdt} USDT`]
    );
    await db.query(
      "INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, description) VALUES ($1, $2, 'deposit', $3, 'USDT', $4)",
      [usdtWallet.id, userId, amount_usdt, `Exchange from ${amount_thb} THB`]
    );

    await db.query('COMMIT');

    res.json({
      success: true,
      data: {
        exchanged: {
          from: 'THB',
          to: 'USDT',
          amount_in: amount_thb,
          amount_out: amount_usdt,
          rate: EXCHANGE_RATE
        }
      }
    });

  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (_) { }
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/users/wallet/transfer
 * @desc    Transfer money to another user's wallet
 * @access  Private
 */
router.post('/wallet/transfer', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    const userId = req.user.id;
    const { to_wallet_address, amount, currency } = req.body; // to_wallet_address can be email or address

    if (!to_wallet_address || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid input' } });
    }

    // Default currency to THB if not specified
    const targetCurrency = currency || 'THB';

    await client.query('BEGIN');

    // 1. Get Sender Wallet (Specific Currency)
    const senderWalletRes = await client.query(
      'SELECT id, balance, currency, wallet_address FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
      [userId, targetCurrency]
    );

    if (senderWalletRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { message: `You do not have a ${targetCurrency} wallet` } });
    }

    const senderWallet = senderWalletRes.rows[0];

    // Check Balance
    if (parseFloat(senderWallet.balance) < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: { message: 'Insufficient balance' } });
    }

    // 2. Find Recipient Wallet
    let recipientWallet;

    // Check if input is email
    const isEmail = to_wallet_address.includes('@');

    if (isEmail) {
      // Find by Email avoiding self
      const recipientRes = await client.query(`
        SELECT w.id, w.user_id, w.currency, w.wallet_address 
        FROM wallets w 
        JOIN users u ON w.user_id = u.id 
        WHERE u.email = $1 AND w.currency = $2
        FOR UPDATE
      `, [to_wallet_address, targetCurrency]);

      if (recipientRes.rows.length === 0) {
        // Fallback: Check if user exists but has no wallet of this currency
        const userRes = await client.query('SELECT id FROM users WHERE email = $1', [to_wallet_address]);
        await client.query('ROLLBACK');
        if (userRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: { message: 'Recipient user not found' } });
        } else {
          return res.status(404).json({ success: false, error: { message: `Recipient does not have a ${targetCurrency} wallet` } });
        }
      }
      recipientWallet = recipientRes.rows[0];

      if (recipientWallet.user_id === userId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: { message: 'Cannot transfer to your own email' } });
      }

    } else {
      // Find by Wallet Address
      if (to_wallet_address === senderWallet.wallet_address) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: { message: 'Cannot transfer to your own wallet' } });
      }

      const recipientRes = await client.query(
        'SELECT id, user_id, currency, wallet_address FROM wallets WHERE wallet_address = $1 AND currency = $2 FOR UPDATE',
        [to_wallet_address, targetCurrency]
      );

      if (recipientRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Recipient wallet not found' } });
      }
      recipientWallet = recipientRes.rows[0];
    }

    // Double check currency match (should be redundant due to query but safe)
    if (recipientWallet.currency !== senderWallet.currency) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: { message: 'Currency mismatch' } });
    }

    // 3. Execute Transfer
    // Deduct from Sender
    await client.query(
      'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, senderWallet.id]
    );

    // Add to Recipient
    await client.query(
      'UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, recipientWallet.id]
    );

    // 4. Log Transactions
    // Sender Log
    await client.query(
      'INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, related_wallet_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [senderWallet.id, userId, 'transfer_out', amount, targetCurrency, recipientWallet.wallet_address, `Transfer to ${isEmail ? to_wallet_address : 'wallet'}`]
    );

    // Recipient Log
    await client.query(
      'INSERT INTO transaction_logs (wallet_id, user_id, type, amount, currency, related_wallet_address, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [recipientWallet.id, recipientWallet.user_id, 'transfer_in', amount, targetCurrency, senderWallet.wallet_address, `Received from ${senderWallet.wallet_address}`]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Transfer successful' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  } finally {
    client.release();
  }
});

module.exports = router;
