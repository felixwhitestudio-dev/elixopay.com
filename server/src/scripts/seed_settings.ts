
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding system settings...');

    const settings = [
        {
            key: 'withdrawal_fee_thb',
            value: '15',
            description: 'Withdrawal fee in THB'
        },
        {
            key: 'exchange_rate_usdt_thb',
            value: '34.50',
            description: 'Exchange rate: 1 USDT = ? THB'
        }
    ];

    for (const setting of settings) {
        await prisma.systemSetting.upsert({
            where: { key: setting.key },
            update: {},
            create: setting
        });
    }

    console.log('System settings seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
