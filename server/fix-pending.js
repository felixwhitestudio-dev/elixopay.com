require('dotenv').config();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all PAID checkout sessions and update matching transactions
  const paidSessions = [
    { id: 'cs_live_a10qaxDykZoiTFhulmd7wlNzK9WY73yAX2W3AWmHL69vQ02z5FB2zs9tk2', pi: 'pi_3TsmrDDzFy8OdkHY2JPg1ylD', amount: 100 },
    { id: 'cs_live_a1CO7m6okgsop0gOuG7GM0ZOStL6ezSz36z5500zaxazTrHD4Vd5IItbDR', pi: 'pi_3TsmMoDzFy8OdkHY2hkHGY7j', amount: 5200 },
    { id: 'cs_live_a11i2yjNE4BLLwfMMJrNurMhWllTsaKHEfW3pKZzn08Srbjk83UplZT9Yu', pi: 'pi_3Tsm24DzFy8OdkHY1zNPeU3T', amount: 8500 },
  ];

  for (const s of paidSessions) {
    const tx = await prisma.transaction.findFirst({
      where: { providerChargeId: s.id }
    });

    if (!tx) {
      console.log('❌ No transaction found for session', s.id);
      continue;
    }

    if (tx.status === 'COMPLETED') {
      console.log('⏭️ Already COMPLETED:', tx.id, '(amount:', Number(tx.amount), ')');
      continue;
    }

    console.log('🔄 Updating transaction', tx.id, 'from', tx.status, 'to COMPLETED (amount:', Number(tx.amount), ')');
    
    // Determine if test mode
    let isTestMode = false;
    try {
      if (tx.metadata) {
        const meta = JSON.parse(tx.metadata);
        isTestMode = meta.mode === 'test';
      }
    } catch (e) {}

    await prisma.$transaction(async (txn) => {
      await txn.transaction.update({
        where: { id: tx.id },
        data: { 
          status: 'COMPLETED',
          providerChargeId: s.pi  // Update to PaymentIntent ID for refunds
        }
      });

      const updateData = isTestMode
        ? { testBalance: { increment: tx.amount } }
        : { balance: { increment: tx.amount } };

      await txn.wallet.update({
        where: { userId: tx.userId },
        data: updateData
      });
    });

    console.log('✅ Updated transaction', tx.id, 'to COMPLETED');
  }

  // Show final state
  const allTx = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log('\n=== Current Transactions ===');
  for (const t of allTx) {
    console.log('ID:', t.id, '| Amount:', Number(t.amount), '| Status:', t.status, '| ProviderChargeId:', (t.providerChargeId || '').substring(0, 25));
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
