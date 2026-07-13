import express from 'express';
import { protect } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

const router = express.Router();

router.use(protect);

/**
 * GET /api/v1/balances/me
 * Returns the current user's wallet balance.
 * Dashboard calls this endpoint to display the merchant account balance.
 */
router.get('/me', async (req, res) => {
    // @ts-ignore
    const userId = req.user.id;

    const wallet = await prisma.wallet.findUnique({
        where: { userId }
    });

    if (!wallet) {
        return res.status(200).json({
            success: true,
            data: {
                available_amount: 0,
                pending_amount: 0,
                currency: 'THB',
                balance: 0,
                testBalance: 0
            }
        });
    }

    res.status(200).json({
        success: true,
        data: {
            available_amount: Number(wallet.balance),
            pending_amount: 0,
            currency: 'THB',
            balance: Number(wallet.balance),
            testBalance: Number(wallet.testBalance)
        }
    });
});

export default router;
