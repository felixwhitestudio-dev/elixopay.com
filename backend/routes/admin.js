const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Verification Routes
router.get('/verifications', authenticate, adminController.getPendingVerifications);
router.get('/verifications/:userId', authenticate, adminController.getVerificationDetails);
router.post('/verifications/:userId/review', authenticate, adminController.reviewVerification);

module.exports = router;
