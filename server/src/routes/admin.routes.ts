import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictTo('admin'));

router.get('/withdrawals/pending', adminController.getPendingWithdrawals);
router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);

router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);

router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

router.get('/transactions', adminController.getAllTransactions);
router.get('/audit-logs', adminController.getAuditLogs);

export default router;
