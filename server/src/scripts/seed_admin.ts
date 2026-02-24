import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateMerchantIdSync(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const PREFIX = 'ELXP';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `${PREFIX}-${code}`;
}

async function main() {
    const email = 'admin@elixopay.com';
    const password = 'admin123';

    console.log(`Seeding admin: ${email}`);

    const hash = await bcrypt.hash(password, 12);

    // Check if exists
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        console.log('Admin already exists. Updating role to admin...');
        await prisma.user.update({
            where: { email },
            data: { role: 'admin', password: hash }
        });
    } else {
        console.log('Creating new admin...');
        const user = await prisma.user.create({
            data: {
                email,
                password: hash,
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin',
                merchantId: generateMerchantIdSync(),
            }
        });

        // Create wallet
        await prisma.wallet.create({
            data: {
                userId: user.id,
                balance: 1000000.00,
                currency: 'THB'
            }
        });
    }

    // Backfill merchantId for any existing users who don't have one
    const usersWithoutMerchantId = await prisma.user.findMany({
        where: { merchantId: '' }
    });
    for (const user of usersWithoutMerchantId) {
        const newId = generateMerchantIdSync();
        await prisma.user.update({
            where: { id: user.id },
            data: { merchantId: newId }
        });
        console.log(`Backfilled merchantId for ${user.email}: ${newId}`);
    }

    console.log('Admin seeded successfully.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

