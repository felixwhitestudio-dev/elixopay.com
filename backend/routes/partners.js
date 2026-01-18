const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const partnerController = require('../controllers/partnerController');

/**
 * @route   GET /api/v1/partners/stats
 * @desc    Get partner statistics (earnings, referrals, balance)
 * @access  Private
 */
router.get('/stats', authenticate, partnerController.getPartnerStats);

/**
 * @route   GET /api/v1/partners/network
 * @desc    Get partner network (referred merchants)
 * @access  Private
 */
router.get('/network', authenticate, partnerController.getPartnerNetwork);

/**
 * @route   GET /api/v1/partners/payouts
 * @desc    Get payout history
 * @access  Private
 */
router.get('/payouts', authenticate, partnerController.getPayoutHistory);

/**
 * @route   POST /api/v1/partners/withdraw
 * @desc    Request a withdrawal
 * @access  Private
 */
router.post('/withdraw', authenticate, partnerController.requestWithdrawal);

/**
 * @route   GET /api/v1/partners/team
 * @desc    Get team members (downline)
 * @access  Private
 */
router.get('/team', authenticate, partnerController.getTeam);

/**
 * @route   POST /api/v1/partners/team/create
 * @desc    Create a new team member (Direct Creation)
 * @access  Private
 */
router.post('/team/create', authenticate, partnerController.createTeamMember);

/**
 * @route   GET /api/v1/partners/commissions
 * @desc    Get partner commissions history
 * @access  Private
 */
router.get('/commissions', authenticate, partnerController.getCommissions);

/**
 * @route   GET /api/v1/partners
 * @desc    Get all partners (Legacy/Admin potentially - keeping for backward compat stub)
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
 * @desc    Create a new partner (Stub for now)
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
