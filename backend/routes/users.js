const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        ...req.user,
        ...req.body
      }
    }
  });
});

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        totalPayments: 135,
        totalRevenue: 99.99,
        activeApiKeys: 2,
        uptime: 99.99
      }
    }
  });
});

module.exports = router;
