import { Request, Response } from 'express';
import { KBankService } from '../services/kbank.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const generateQR = async (req: Request, res: Response) => {
    try {
        const { amount, orderId, description } = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({ message: 'Amount and Order ID are required' });
        }

        const result = await KBankService.generateQR(parseFloat(amount), orderId, description);

        // Ideally, we might want to save this transaction state here, but for now we return the QR
        // The actual Transaction record might be created before calling this endpoint

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
        // KBank sends payment notification here
        const payload = req.body;
        console.log('Received KBank Webhook:', JSON.stringify(payload, null, 2));

        // Validate valid signature (omitted for brevity in sandbox, but critical for prod)

        // Find transaction by refId (partnerTxnUid)
        // const transaction = await prisma.transaction.findFirst({ ... });

        // Update status
        // await prisma.transaction.update({ ... });

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
