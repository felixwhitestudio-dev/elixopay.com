const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const verificationController = require('../controllers/verificationController');

router.post('/upload', authenticate, verificationController.uploadDocument);
router.post('/submit', authenticate, verificationController.submitVerification);
router.get('/status', authenticate, verificationController.getVerificationStatus);

module.exports = router;
