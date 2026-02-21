const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Verification Routes
router.get('/verifications', authenticate, adminController.getPendingVerifications);
router.get('/verifications/:userId', authenticate, adminController.getVerificationDetails);
router.post('/verifications/:userId/review', authenticate, adminController.reviewVerification);

// System Stats
router.get('/stats', authenticate, adminController.getSystemStats);

// System Settings
router.get('/settings', authenticate, adminController.getSettings);
router.post('/settings', authenticate, adminController.updateSettings);

module.exports = router;
