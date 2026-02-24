const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireKyc = require('../middleware/kyc');
const apiKeyController = require('../controllers/apiKeyController');

// All API Key routes require both authentication and verified KYC
router.use(authenticate);
router.use(requireKyc);

/**
 * @route   GET /api/v1/api-keys
 * @desc    Get all API keys for the authenticated user
 * @access  Private
 */
router.get('/', apiKeyController.getApiKeys);

/**
 * @route   POST /api/v1/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post('/', apiKeyController.createApiKey);

/**
 * @route   DELETE /api/v1/api-keys/:id
 * @desc    Revoke an API key
 * @access  Private
 */
router.delete('/:id', apiKeyController.revokeApiKey);

module.exports = router;

