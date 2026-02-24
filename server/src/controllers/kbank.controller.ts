import { Request, Response } from 'express';
import { KBankService } from '../services/kbank.service';
import { WebhookService } from '../services/webhook.service';
import prisma from '../utils/prisma';

export const generateQR = async (req: Request, res: Response) => {
    try {
        const { amount, orderId, description } = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({ message: 'Amount and Order ID are required' });
        }

        const result = await KBankService.generateQR(parseFloat(amount), orderId, description);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error('KBank Controller Error:', error);
        res.status(500).json({ message: error.message || 'Failed to generate QR Code' });
    }
};

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const payload = req.body;

        // In a real system:
        // 1. Verify KBank Signature
        // 2. Find internal Transaction by payload.partnerTxnUid
        // 3. Update DB to COMPLETED
        // 4. Update Merchant Wallet Balance

        // Mock Example: Assuming we found transaction ID 1 for User ID X and updated it
        // const transaction = await prisma.transaction.update({ ... });

        // --- Webhook Dispatch to Merchant ---
        // If the transaction has metadata indicating it was created via API, 
        // OR just unconditionally fire a 'payment.success' for this merchant.
        // await WebhookService.dispatchEvent(transaction.userId, 'payment.success', {
        //     id: transaction.id,
        //     amount: transaction.amount,
        //     currency: 'THB',
        //     reference: transaction.reference,
        //     status: 'COMPLETED'
        // });

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
