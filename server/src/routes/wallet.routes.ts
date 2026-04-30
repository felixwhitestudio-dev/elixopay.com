import express from 'express';
import * as walletController from '../controllers/wallet.controller';
import { protect } from '../middlewares/auth.middleware';

// import * as exchangeController from '../controllers/exchange.controller';

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/', walletController.getMyWallet);
router.get('/transactions', walletController.getMyTransactions);
router.post('/deposit', walletController.deposit);
router.post('/withdraw', walletController.withdraw);

// ============================================================
// 🚫 P2P Transfer — DISABLED for banking compliance
// Requires e-Money license from Bank of Thailand (ธปท.)
// under Payment Systems Act B.E. 2560 (พ.ร.บ. ระบบการชำระเงิน)
// Re-enable ONLY after obtaining proper licensing.
// ============================================================
// router.post('/transfer', walletController.transfer);

// ============================================================
// 🚫 Crypto Exchange/Swap — DISABLED for banking compliance
// Could be classified as Digital Asset Exchange
// which requires SEC Thailand license.
// Re-enable ONLY after obtaining proper licensing.
// ============================================================
// router.get('/exchange/rate', exchangeController.getRate);
// router.post('/exchange/swap', exchangeController.swap);

export default router;
