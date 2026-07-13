import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import { syncPendingPayments } from '../controllers/stripe-sync.controller';

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictTo('admin'));

// DISABLED: Withdrawal management removed — Direct Payment Model
// router.get('/withdrawals/pending', adminController.getPendingWithdrawals);
// router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
// router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);

router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);

router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

router.get('/transactions', adminController.getAllTransactions);
router.get('/audit-logs', adminController.getAuditLogs);

router.get('/dashboard-overview', adminController.getDashboardOverview);

router.get('/stats', adminController.getStats);
router.get('/liquidity', adminController.getLiquidity);
router.post('/liquidity/add', adminController.addLiquidity);
router.get('/liquidity/history', adminController.getLiquidityHistory);

// Sync pending Stripe payments — checks Stripe and updates PENDING → COMPLETED
router.post('/sync-pending-payments', syncPendingPayments);

export default router;
