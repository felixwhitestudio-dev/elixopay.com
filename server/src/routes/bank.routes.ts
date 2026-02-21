import express from 'express';
import * as bankController from '../controllers/bank.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = express.Router();

// ── User Routes ──
router.get('/me', protect, bankController.getMyBankInfo);
router.post('/change-request', protect, bankController.submitChangeRequest);

// ── Admin Routes ──
router.get('/change-requests', protect, restrictTo('admin'), bankController.listChangeRequests);
router.put('/change-requests/:id/approve', protect, restrictTo('admin'), bankController.approveChangeRequest);
router.put('/change-requests/:id/reject', protect, restrictTo('admin'), bankController.rejectChangeRequest);

export default router;
