import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const apiKey = await prisma.apiKey.updateMany({
            where: { isActive: false },
            data: { isActive: true }
        });
        console.log('Updated API Keys:', apiKey);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
