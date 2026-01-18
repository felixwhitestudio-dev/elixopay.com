const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// --- Configuration ---
// In a real production app, fetch these from an external API (e.g. Binance, CoinGecko)
// and cache them in Redis/Memory for a minute.
// For this demo, we simulate a fluctuating market rate.
const BASE_RATE_THB = 34.50; // Reference Market Price
const SPREAD_PERCENT = 0.005; // 0.5% Profit Margin (Standard crypto spread)

// HARDCODED SYSTEM WALLETS (Admin Wallets)
// In production, these should be in ENV or a specific config table
const SYSTEM_WALLET_USDT = '84404d85-9272-4c9f-b010-17c127efe157';
const SYSTEM_WALLET_THB = 'd7776b71-7c1e-4e47-919b-3b5b45b9d7e9';
const SYSTEM_USER_ID = 'eb1c3772-8f0c-4dd4-a0c0-3494e83bf9d7';

const getDynamicRates = () => {
    // Simulate slight market fluctuation (+/- 0.05 THB)
    const fluctuation = (Math.random() * 0.10) - 0.05;
    const marketRate = BASE_RATE_THB + fluctuation;

    // We SELL USDT to user (User Buys) at Market + Spread (Higher Price)
    // Ask Price
    const buyRate = parseFloat((marketRate * (1 + SPREAD_PERCENT)).toFixed(2));

    // We BUY USDT from user (User Sells) at Market - Spread (Lower Price)
    // Bid Price
    const sellRate = parseFloat((marketRate * (1 - SPREAD_PERCENT)).toFixed(2));

    return { buyRate, sellRate, marketRate };
};

/**
 * @route   GET /api/v1/wallet/exchange-rate
 * @desc    Get current exchange rates
 * @access  Private
 */
exports.getExchangeRate = async (req, res, next) => {
    try {
        const rates = getDynamicRates();
        res.json({
            success: true,
            data: {
                currency: 'USDT',
                base: 'THB',
                ...rates,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/v1/wallet/exchange
 * @desc    Exchange currency (THB <-> USDT) with SYSTEM RESERVE Check
 * @access  Private
 */
exports.processExchange = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { amount, from_currency, to_currency } = req.body;
        const userId = req.user.id;

        // 1. Basic Validation
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: { message: 'Invalid amount' } });
        }

        const from = from_currency ? from_currency.toUpperCase() : 'THB';
        const to = to_currency ? to_currency.toUpperCase() : 'USDT';

        // Validate Pairs
        const isBuy = from === 'THB' && to === 'USDT';
        const isSell = from === 'USDT' && to === 'THB';

        if (!isBuy && !isSell) {
            return res.status(400).json({ success: false, error: { message: 'Invalid exchange pair. Only THB <-> USDT supported.' } });
        }

        // 2. Get Dynamic Rate and Calculate
        const rates = getDynamicRates();
        const inputAmount = parseFloat(amount);
        let outputAmount, exchangeRate, logDescription;

        if (isBuy) {
            // BUY USDT: User gives THB, System gives USDT
            exchangeRate = rates.buyRate;
            outputAmount = inputAmount / exchangeRate;
            logDescription = `Exchanged ${inputAmount} THB for ${outputAmount.toFixed(6)} USDT @ ${exchangeRate}`;
        } else {
            // SELL USDT: User gives USDT, System gives THB
            exchangeRate = rates.sellRate;
            outputAmount = inputAmount * exchangeRate;
            logDescription = `Exchanged ${inputAmount} USDT for ${outputAmount.toFixed(2)} THB @ ${exchangeRate}`;
        }

        // --- TRANSACTION START ---
        await client.query('BEGIN');

        // 3. User Wallet Check & Lock (Lock Source Wallet)
        // User pays the 'inputAmount' in 'from' currency
        const userWalletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [userId, from]);
        const userWallet = userWalletRes.rows[0];

        if (!userWallet) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: { message: `Your ${from} Wallet not found` } });
        }

        if (parseFloat(userWallet.balance) < inputAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: { message: `Insufficient ${from} balance` } });
        }

        // 4. SYSTEM RESERVE CHECK (Liquidity Check)
        // Whatever the user is BUYING (to), the System must PAY out.
        // User gets 'outputAmount' in 'to' currency FROM System.

        let systemWalletIdToCheck = isBuy ? SYSTEM_WALLET_USDT : SYSTEM_WALLET_THB; // If User Buys USDT, System Pays USDT.

        const systemWalletRes = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [systemWalletIdToCheck]);
        const systemWallet = systemWalletRes.rows[0];

        if (!systemWallet) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false, error: { message: 'System Wallet Error: Wallet not found' } });
        }

        if (parseFloat(systemWallet.balance) < outputAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    message: isBuy ? 'System Out of Stock: Not enough USDT available.' : 'System Error: Not enough THB liquidity.'
                }
            });
        }


        // 5. EXECUTE TRANSFERS

        // A. Deduct from User Source
        const newUserSourceBalance = parseFloat(userWallet.balance) - inputAmount;
        await client.query('UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newUserSourceBalance, userWallet.id]);

        // B. Credit User Destination (Create if needed)
        let userDestWalletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 AND currency = $2', [userId, to]);
        let userDestWallet = userDestWalletRes.rows[0];

        if (!userDestWallet) {
            const walletAddr = '0x' + require('crypto').randomBytes(20).toString('hex');
            userDestWalletRes = await client.query(
                'INSERT INTO wallets (user_id, balance, currency, wallet_address) VALUES ($1, $2, $3, $4) RETURNING *',
                [userId, 0.00, to, walletAddr]
            );
            userDestWallet = userDestWalletRes.rows[0];
        }
        const newUserDestBalance = parseFloat(userDestWallet.balance) + outputAmount;
        await client.query('UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newUserDestBalance, userDestWallet.id]);


        // C. Update System Wallets
        // System PAYS 'outputAmount' (Deduct)
        const newSystemPayBalance = parseFloat(systemWallet.balance) - outputAmount;
        await client.query('UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newSystemPayBalance, systemWallet.id]);

        // System RECEIVES 'inputAmount' (Credit user's payment)
        // If User buys with THB, System gets THB.
        const systemReceiveId = isBuy ? SYSTEM_WALLET_THB : SYSTEM_WALLET_USDT;

        // Optimize: If we just locked/updated the same wallet, reuse/re-lock? 
        // Logic: 
        // Buy USDT: System Pays USDT (Locked above), System Gets THB. Different wallets.
        // Sell USDT: System Pays THB (Locked above), System Gets USDT. Different wallets.
        // So we need to fetch/lock the RECEIVING system wallet too.

        const systemReceiveWalletRes = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [systemReceiveId]);
        const systemReceiveWallet = systemReceiveWalletRes.rows[0];
        if (!systemReceiveWallet) {
            // Should not happen if configured correctly
            throw new Error('System Receiving Wallet Not Found');
        }
        const newSystemReceiveBalance = parseFloat(systemReceiveWallet.balance) + inputAmount;
        await client.query('UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newSystemReceiveBalance, systemReceiveId]);


        // 6. Logs
        const logId = uuidv4();
        await client.query(
            `INSERT INTO transaction_logs (id, wallet_id, user_id, type, amount, currency, description, created_at)
             VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, CURRENT_TIMESTAMP)`,
            [logId, userWallet.id, userId, inputAmount, from, logDescription]
        );

        const logIdIn = uuidv4();
        await client.query(
            `INSERT INTO transaction_logs (id, wallet_id, user_id, type, amount, currency, description, created_at)
             VALUES ($1, $2, $3, 'transfer_in', $4, $5, $6, CURRENT_TIMESTAMP)`,
            [logIdIn, userDestWallet.id, userId, outputAmount, to, logDescription]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                message: 'Exchange successful',
                sent: { amount: inputAmount, currency: from },
                received: { amount: outputAmount, currency: to },
                rate: exchangeRate,
                newBalance: {
                    [from]: newUserSourceBalance,
                    [to]: newUserDestBalance
                }
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Exchange error:', error);
        next(error);
    } finally {
        if (client) client.release();
    }
};
