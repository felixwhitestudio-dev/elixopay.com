import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
                role: 'admin'
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

    console.log('Admin seeded successfully.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
