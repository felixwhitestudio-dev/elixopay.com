const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get admin statistics
 * @access  Private (Admin only)
 */
router.get('/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        totalUsers: 10,
        totalPayments: 135,
        totalRevenue: 99999,
        activePartners: 5
      }
    }
  });
});

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users (admin)
 * @access  Private (Admin only)
 */
router.get('/users', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      users: []
    }
  });
});

module.exports = router;
