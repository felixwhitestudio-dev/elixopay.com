import express from 'express';
import * as walletController from '../controllers/wallet.controller';
import { protect } from '../middlewares/auth.middleware';

import * as exchangeController from '../controllers/exchange.controller';

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/', walletController.getMyWallet);
router.get('/transactions', walletController.getMyTransactions);
router.post('/deposit', walletController.deposit);
router.post('/withdraw', walletController.withdraw);
router.post('/transfer', walletController.transfer);

// Exchange Routes
router.get('/exchange/rate', exchangeController.getRate);
router.post('/exchange/swap', exchangeController.swap);

export default router;
