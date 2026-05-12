import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export const getWalletByUserId = async (userId: number) => {
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
    });
    return wallet;
};

export const createWallet = async (userId: number) => {
    return await prisma.wallet.create({
        data: {
            userId,
            balance: 0.0,
            // @ts-ignore
            // usdtBalance removed for banking compliance
            currency: 'THB',
        },
    });
};

export const deposit = async (userId: number, amount: number, reference?: string) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Create Transaction Record
        const transaction = await tx.transaction.create({
            data: {
                userId,
                amount,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                reference,
                metadata: JSON.stringify({ method: 'manual_api' }),
            },
        });

        // 2. Update Merchant Account Balance
        const wallet = await tx.wallet.update({
            where: { userId },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });

        return { transaction, wallet };
    });
};

export const withdraw = async (userId: number, amount: number, bankAccount?: string) => {
    return await prisma.$transaction(async (tx) => {
        // 0. Get Transfer Fee
        const feeSetting = await tx.systemSetting.findUnique({ where: { key: 'withdrawal_fee_thb' } });
        const fee = feeSetting ? Number(feeSetting.value) : 0;
        const totalDeduction = amount + fee;

        // 1. Check Merchant Account Balance
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < totalDeduction) {
            throw new AppError(`Insufficient funds (Amount: ${amount} + Fee: ${fee})`, 400);
        }

        // 2. Create Transaction Record (Transfer Request)
        const transaction = await tx.transaction.create({
            data: {
                userId,
                amount: -amount, // Negative for withdrawal
                type: 'WITHDRAW',
                status: 'PENDING', // Wait for admin approval
                reference: bankAccount,
                metadata: JSON.stringify({ bank_account: bankAccount, fee_charged: fee }),
            },
        });

        // 2.1 Create Transaction Record (Fee) - Only if fee > 0
        if (fee > 0) {
            await tx.transaction.create({
                data: {
                    userId,
                    amount: -fee,
                    type: 'WITHDRAWAL_FEE',
                    status: 'COMPLETED', // Fees are deducted immediately and final
                    reference: `Fee for Tx #${transaction.id}`,
                    metadata: JSON.stringify({ related_transaction_id: transaction.id }),
                },
            });
        }

        // 3. Update Merchant Account Balance
        const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: {
                balance: {
                    decrement: totalDeduction,
                },
            },
        });

        return { transaction, wallet: updatedWallet, fee };
    });
};

/*
 * DISABLED: P2P Transfer function removed for banking compliance
 * This function allowed user-to-user money transfers (sender → recipient)
 * which constitutes P2P money transfer services.
 * To re-enable, uncomment this function.
 */

export const getTransactions = async (userId: number, limit = 20) => {
    return await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
};
