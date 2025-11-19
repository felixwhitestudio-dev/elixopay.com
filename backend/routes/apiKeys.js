const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/api-keys
 * @desc    Get all API keys for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      apiKeys: [
        {
          id: 'key_1',
          name: 'Production Key',
          key: 'pk_live_****',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'key_2',
          name: 'Test Key',
          key: 'pk_test_****',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ]
    }
  });
});

/**
 * @route   POST /api/v1/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post('/', authenticate, (req, res) => {
  const { name, type } = req.body;
  
  res.status(201).json({
    success: true,
    data: {
      apiKey: {
        id: 'key_' + Date.now(),
        name,
        key: 'pk_' + type + '_' + Math.random().toString(36).substring(7),
        status: 'active',
        createdAt: new Date().toISOString()
      }
    }
  });
});

/**
 * @route   DELETE /api/v1/api-keys/:id
 * @desc    Revoke an API key
 * @access  Private
 */
router.delete('/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'API key revoked successfully'
  });
});

module.exports = router;
