import { Router } from 'express';
import * as refundController from '../controllers/refund.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// All refund routes require authentication
router.use(protect);

// POST   /api/v1/refund       — Create a refund
router.post('/', refundController.createRefund);

// GET    /api/v1/refund       — List all refunds
router.get('/', refundController.listRefunds);

// GET    /api/v1/refund/:id   — Get refund by ID
router.get('/:id', refundController.getRefund);

export default router;
