const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.update({
    where: { email: 'demo@elixopay.com' },
    data: { password: hash, isEmailVerified: true }
  });
  console.log(`Password reset for ${user.email} complete`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
