const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireKyc = require('../middleware/kyc');
const walletController = require('../controllers/walletController');
// const exchangeController = require('../controllers/exchangeController'); // DISABLED: crypto exchange removed

/*
 * DISABLED: Withdraw route removed — Direct Payment Model
 * Elixopay does NOT hold merchant funds. Money flows directly to merchant bank.
 * router.post('/withdraw', authenticate, requireKyc, walletController.requestWithdrawal);
 */
// router.post('/deposit', authenticate, walletController.processDeposit); // DISABLED FOR LICENSE-FREE MODE

/**
 * @route   POST /api/v1/wallet/exchange
 * @desc    Exchange funds (THB -> USDT)
 * @access  Private
 */
// router.post('/exchange', authenticate, exchangeController.processExchange); // DISABLED FOR LICENSE-FREE MODE

/**
 * @route   GET /api/v1/wallet/exchange-rate
 * @desc    Get exchange rates
 * @access  Private
 */
// router.get('/exchange-rate', authenticate, exchangeController.getExchangeRate); // DISABLED FOR LICENSE-FREE MODE

module.exports = router;
