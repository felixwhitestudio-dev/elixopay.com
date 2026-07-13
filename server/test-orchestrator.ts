import dotenv from 'dotenv';
dotenv.config();

import { orchestrator } from './src/services/orchestrator.service';
import prisma from './src/utils/prisma';
import { ApiKeyService } from './src/services/apikey.service';

async function test() {
    try {
        console.log("Validating API key...");
        const authData = await ApiKeyService.validateKey('ep_live_bae1b09d6183de4b3d537ec9539b0b42285d9d2e6c014002e92387349866a417');
        if (!authData) {
            console.error("API Key invalid");
            return;
        }

        console.log("Creating charge...");
        const chargeResult = await orchestrator.createCharge(
            {
                amount: 8900,
                currency: 'THB',
                method: 'card',
                description: 'Carat Store Order 123',
                returnUrl: 'https://example.com/success',
                orderId: 'ORD-123',
                metadata: { referenceId: 'ORD-123' },
                stripeAccountId: authData.user.stripeAccountId || undefined,
            },
            {
                isTestMode: false,
                preferredProvider: 'stripe',
            }
        );
        console.log("Charge created:", chargeResult);

        console.log("Creating transaction...");
        const transaction = await prisma.transaction.create({
            data: {
                userId: authData.user.id,
                amount: 8900,
                type: 'DEPOSIT',
                status: chargeResult.result.status === 'completed' ? 'COMPLETED' : 'PENDING',
                reference: 'ORD-123',
                provider: chargeResult.provider,
                providerChargeId: chargeResult.result.providerChargeId,
                paymentMethod: 'card',
                metadata: JSON.stringify({
                    description: 'Carat Store Order 123',
                    returnUrl: 'https://example.com/success',
                    mode: 'live',
                    clientSecret: chargeResult.result.rawResponse?.clientSecret,
                    qrCodeBase64: chargeResult.result.qrCode,
                    stripeAccountId: authData.user.stripeAccountId || undefined
                }),
            }
        });
        console.log("Transaction created:", transaction.id);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
