const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMyAgencyBalance } = require('../controllers/balanceController');

// Get balance for current user's primary agency
router.get('/me', authenticate, getMyAgencyBalance);

module.exports = router;
