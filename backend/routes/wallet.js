const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const walletController = require('../controllers/walletController');
const exchangeController = require('../controllers/exchangeController');

/**
 * @route   POST /api/v1/wallet/withdraw
 * @desc    Request a withdrawal
 * @access  Private
 */
router.post('/withdraw', authenticate, walletController.requestWithdrawal);
router.post('/deposit', authenticate, walletController.processDeposit);

/**
 * @route   POST /api/v1/wallet/exchange
 * @desc    Exchange funds (THB -> USDT)
 * @access  Private
 */
router.post('/exchange', authenticate, exchangeController.processExchange);

/**
 * @route   GET /api/v1/wallet/exchange-rate
 * @desc    Get exchange rates
 * @access  Private
 */
router.get('/exchange-rate', authenticate, exchangeController.getExchangeRate);

module.exports = router;
