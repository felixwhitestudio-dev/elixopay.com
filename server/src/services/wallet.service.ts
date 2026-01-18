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
            usdtBalance: 0.0,
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

        // 2. Update Wallet Balance
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
        // 0. Get Withdrawal Fee
        const feeSetting = await tx.systemSetting.findUnique({ where: { key: 'withdrawal_fee_thb' } });
        const fee = feeSetting ? Number(feeSetting.value) : 0;
        const totalDeduction = amount + fee;

        // 1. Check Balance
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < totalDeduction) {
            throw new AppError(`Insufficient funds (Amount: ${amount} + Fee: ${fee})`, 400);
        }

        // 2. Create Transaction Record (Withdrawal)
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

        // 3. Update Wallet Balance
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

export const transfer = async (senderId: number, recipientIdentifier: string, amount: number) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Validate Sender & Balance
        const senderWallet = await tx.wallet.findUnique({ where: { userId: senderId } });
        if (!senderWallet || Number(senderWallet.balance) < amount) {
            throw new AppError('Insufficient funds', 400);
        }

        // 2. Find Recipient (Email or Wallet ID)
        let recipientUser;
        const isEmail = recipientIdentifier.includes('@');

        if (isEmail) {
            recipientUser = await tx.user.findUnique({
                where: { email: recipientIdentifier },
                include: { wallet: true },
            });
        } else {
            // Assume format WALLET-123 or just 123
            // Extract numeric ID
            const walletIdStr = recipientIdentifier.toUpperCase().replace('WALLET-', '');
            const walletId = parseInt(walletIdStr, 10);

            if (isNaN(walletId)) {
                throw new AppError('Invalid Wallet ID format', 400);
            }

            const recipientWallet = await tx.wallet.findUnique({
                where: { id: walletId },
                include: { user: true }
            });

            if (recipientWallet) {
                recipientUser = { ...recipientWallet.user, wallet: recipientWallet };
            }
        }

        if (!recipientUser || !recipientUser.wallet) {
            throw new AppError('Recipient not found', 404);
        }

        if (recipientUser.id === senderId) {
            throw new AppError('Cannot transfer to yourself', 400);
        }

        // 3. Create Sender Transaction (Debit)
        const senderTx = await tx.transaction.create({
            data: {
                userId: senderId,
                amount: -amount,
                type: 'TRANSFER_OUT',
                status: 'COMPLETED',
                reference: `TO: ${recipientUser.email}`,
                metadata: JSON.stringify({ recipientId: recipientUser.id }),
            },
        });

        // 4. Create Recipient Transaction (Credit)
        const recipientTx = await tx.transaction.create({
            data: {
                userId: recipientUser.id,
                amount: amount,
                type: 'TRANSFER_IN',
                status: 'COMPLETED',
                reference: `FROM: User ${senderId}`, // You might want to show email here but need extra query
                metadata: JSON.stringify({ senderId: senderId }),
            },
        });

        // 5. Update Balances
        const updatedSenderWallet = await tx.wallet.update({
            where: { userId: senderId },
            data: { balance: { decrement: amount } },
        });

        await tx.wallet.update({
            where: { userId: recipientUser.id },
            data: { balance: { increment: amount } },
        });

        return {
            senderTx,
            recipientTx,
            senderWallet: updatedSenderWallet,
        };
    });
};

export const getTransactions = async (userId: number, limit = 20) => {
    return await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
};
