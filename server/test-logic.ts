import { PrismaClient } from '@prisma/client';
import { orchestrator } from './src/services/orchestrator.service';
const QRCode = require('qrcode');

const prisma = new PrismaClient();

async function main() {
    console.time('total');
    
    console.time('findUnique');
    const price = await prisma.price.findUnique({
        where: { id: '40acb128-e8e5-45f0-b576-b44ab5c616be' },
        include: { product: { include: { merchant: true } } }
    });
    console.timeEnd('findUnique');

    if (!price) {
        console.log('Price not found');
    } else {
        console.time('createCharge');
        const chargeResult = await orchestrator.createCharge(
            {
                amount: Number(price.amount),
                currency: price.currency,
                method: 'qr',
                description: price.product.name,
                orderId: `LINK_${Date.now()}`,
                stripeAccountId: price.product.merchant.stripeAccountId || undefined,
            },
            { isTestMode: true }
        );
        console.timeEnd('createCharge');

        console.time('transaction.create');
        const transaction = await prisma.transaction.create({
            data: {
                userId: price.product.merchant.id,
                amount: price.amount,
                type: 'DEPOSIT',
                status: chargeResult.result.status === 'completed' ? 'COMPLETED' : 'PENDING',
                reference: `LINK_${Date.now()}`,
                provider: chargeResult.provider,
                providerChargeId: chargeResult.result.providerChargeId,
                paymentMethod: 'qr',
                metadata: JSON.stringify({
                    description: price.product.name,
                    mode: 'test',
                    clientSecret: chargeResult.result.rawResponse?.clientSecret,
                    qrCodeBase64: chargeResult.result.qrCode,
                    stripeAccountId: price.product.merchant.stripeAccountId || undefined
                }),
            }
        });
        console.timeEnd('transaction.create');
        console.log(transaction.id);
    }
    
    console.timeEnd('total');
}

main().catch(console.error).finally(() => prisma.$disconnect());
