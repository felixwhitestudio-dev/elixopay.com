import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.time('findUnique');
    const price = await prisma.price.findUnique({
        where: { id: '40acb128-e8e5-45f0-b576-b44ab5c616be' },
        include: { product: { include: { merchant: true } } }
    });
    console.timeEnd('findUnique');
    console.log(price ? 'Found' : 'Not found');
}
main().catch(console.error).finally(() => prisma.$disconnect());
