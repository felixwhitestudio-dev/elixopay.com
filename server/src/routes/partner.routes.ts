import express from 'express';
import { protect } from '../middlewares/auth.middleware';
import * as partnerController from '../controllers/partner.controller';

const router = express.Router();

/**
 * @route   GET /api/v1/partners/stats
 * @desc    Get partner statistics (earnings, referrals, balance)
 * @access  Private
 */
router.get('/stats', protect, partnerController.getPartnerStats);

/**
 * @route   GET /api/v1/partners/network
 * @desc    Get partner network (referred merchants)
 * @access  Private
 */
router.get('/network', protect, partnerController.getPartnerNetwork);

/**
 * @route   GET /api/v1/partners/payouts
 * @desc    Get payout history
 * @access  Private
 */
router.get('/payouts', protect, partnerController.getPayoutHistory);

/**
 * @route   POST /api/v1/partners/withdraw
 * @desc    Request a withdrawal
 * @access  Private
 */
router.post('/withdraw', protect, partnerController.requestWithdrawal);

/**
 * @route   GET /api/v1/partners/team
 * @desc    Get team members (downline)
 * @access  Private
 */
router.get('/team', protect, partnerController.getTeam);

/**
 * @route   POST /api/v1/partners/team/create
 * @desc    Create a new team member (Direct Creation)
 * @access  Private
 */
router.post('/team/create', protect, partnerController.createTeamMember);

/**
 * @route   GET /api/v1/partners/commissions
 * @desc    Get partner commissions history
 * @access  Private
 */
router.get('/commissions', protect, partnerController.getCommissions);

/**
 * @route   GET /api/v1/partners
 * @desc    Get all partners (Legacy/Admin potentially - keeping for backward compat stub)
 * @access  Private
 */
router.get('/', protect, (req, res) => {
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
router.post('/', protect, (req, res) => {
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

export default router;
