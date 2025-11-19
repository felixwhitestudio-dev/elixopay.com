const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/partners
 * @desc    Get all partners
 * @access  Private
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      partners: []
    }
  });
});

/**
 * @route   POST /api/v1/partners
 * @desc    Create a new partner
 * @access  Private
 */
router.post('/', authenticate, (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      partner: {
        id: 'partner_' + Date.now(),
        name: req.body.name,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    }
  });
});

module.exports = router;
