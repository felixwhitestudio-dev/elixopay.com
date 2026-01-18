import axios from 'axios';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

// Cache rate to avoid spamming Bitkub
let cachedRate: { buy: number; sell: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

export const getRate = async () => {
    const now = Date.now();
    if (cachedRate && now - cachedRate.timestamp < CACHE_DURATION) {
        return cachedRate;
    }

    try {
        // Fetch from Bitkub
        const response = await axios.get('https://api.bitkub.com/api/market/ticker?sym=THB_USDT');
        const data = (response.data as any)['THB_USDT'];

        if (!data) {
            throw new Error('Invalid response from Bitkub');
        }

        const marketPrice = data.last; // Last traded price
        const FEE_PERCENT = 0.01; // 1%

        // Buy USDT: User pays THB. Price = Market * (1 + fee)
        // Sell USDT: User gets THB. Price = Market * (1 - fee)
        cachedRate = {
            buy: marketPrice * (1 + FEE_PERCENT),
            sell: marketPrice * (1 - FEE_PERCENT),
            timestamp: now,
        };

        return cachedRate;
    } catch (error) {
        console.error('Error fetching rate:', error);
        // Fallback or re-throw
        throw new AppError('Unable to fetch exchange rates', 503);
    }
};

export const executeExchange = async (userId: number, type: 'BUY' | 'SELL', amountIn: number) => {
    // type BUY: THB -> USDT (amountIn is THB)
    // type SELL: USDT -> THB (amountIn is USDT)

    const rates = await getRate();
    if (!rates) throw new AppError('Exchange unavailable', 503);

    return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new AppError('Wallet not found', 404);

        let amountOut = 0;
        let rateUsed = 0;
        let currencyIn = '';
        let currencyOut = '';

        if (type === 'BUY') {
            // THB -> USDT
            // amountIn is THB
            currencyIn = 'THB';
            currencyOut = 'USDT';
            rateUsed = rates.buy;

            if (Number(wallet.balance) < amountIn) {
                throw new AppError('Insufficient THB balance', 400);
            }

            // Calculate USDT received: THB / Rate
            // e.g. 1000 THB / 35 = 28.57 USDT
            amountOut = amountIn / rateUsed;

            // Update Wallet
            await tx.wallet.update({
                where: { userId },
                data: {
                    balance: { decrement: amountIn },
                    // @ts-ignore
                    usdtBalance: { increment: amountOut }
                }
            });

        } else {
            // USDT -> THB
            // amountIn is USDT
            currencyIn = 'USDT';
            currencyOut = 'THB';
            rateUsed = rates.sell;

            // @ts-ignore
            if (Number(wallet.usdtBalance) < amountIn) {
                throw new AppError('Insufficient USDT balance', 400);
            }

            // Calculate THB received: USDT * Rate
            // e.g. 10 USDT * 33 = 330 THB
            amountOut = amountIn * rateUsed;

            // Update Wallet
            await tx.wallet.update({
                where: { userId },
                data: {
                    // @ts-ignore
                    usdtBalance: { decrement: amountIn },
                    balance: { increment: amountOut }
                }
            });
        }

        // Create Transaction Record
        const transaction = await tx.transaction.create({
            data: {
                userId,
                amount: type === 'BUY' ? -amountIn : amountIn, // This is tricky for exchange. Let's stick to standard logging
                // Maybe better to log the "Principal" movement or just 0 and use metadata
                // Using 0 for main amount to avoid messing up total flow, or use the THB value?
                // Let's use the THB value involved (negative if spent, positive if gained)
                // BUY: Spent THB -> amount = -amountIn
                // SELL: Gained THB -> amount = +amountOut

                // Correction: Let's follow the standard.
                // If BUY (THB->USDT), we spent THB. 
                // If SELL (USDT->THB), we gained THB.
                type: 'EXCHANGE', // We added this to type comments
                status: 'COMPLETED',
                reference: `${type} ${amountIn} ${currencyIn} -> ${curr(amountOut)} ${currencyOut} @ ${rateUsed.toFixed(2)}`,
                metadata: JSON.stringify({
                    type,
                    amountIn,
                    currencyIn,
                    amountOut,
                    currencyOut,
                    rate: rateUsed
                })
            }
        });

        return {
            success: true,
            transaction,
            exchanged: {
                from: { amount: amountIn, currency: currencyIn },
                to: { amount: amountOut, currency: currencyOut },
                rate: rateUsed
            }
        };
    });
};

function curr(num: number) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
