const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMyLedger } = require('../controllers/ledgerController');

router.get('/me', authenticate, getMyLedger);

module.exports = router;
