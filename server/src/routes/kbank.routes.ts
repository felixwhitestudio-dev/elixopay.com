import express from 'express';
import * as kbankController from '../controllers/kbank.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// Generate QR Code (Protected: User needs to be logged in)
router.post('/qr', protect, kbankController.generateQR);

// Webhook (Public: Called by KBank server)
router.post('/webhook', kbankController.handleWebhook);

export default router;
