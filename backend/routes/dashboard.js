const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

/**
 * @route GET /api/v1/dashboard
 * @desc  Get dashboard data for current user (role-aware)
 * @access Private (Authenticated)
 */
router.get('/', authenticate, dashboardController.getDashboard);

module.exports = router;
