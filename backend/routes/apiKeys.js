const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const apiKeyController = require('../controllers/apiKeyController');

/**
 * @route   GET /api/v1/api-keys
 * @desc    Get all API keys for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, apiKeyController.getApiKeys);

/**
 * @route   POST /api/v1/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post('/', authenticate, apiKeyController.createApiKey);

/**
 * @route   DELETE /api/v1/api-keys/:id
 * @desc    Revoke an API key
 * @access  Private
 */
router.delete('/:id', authenticate, apiKeyController.revokeApiKey);

module.exports = router;
