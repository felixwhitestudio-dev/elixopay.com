import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.transaction.count();
  const txs = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log('Total transactions:', count);
  console.log(txs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
