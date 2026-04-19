/**
 * Multi-Currency Configuration
 * 
 * Defines supported currencies and their properties for Elixopay.
 */

export interface CurrencyConfig {
    code: string;
    name: string;
    nameTh: string;
    symbol: string;
    decimals: number;
    minAmount: number;
    maxAmount: number;
    isDefault: boolean;
    isActive: boolean;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
    THB: {
        code: 'THB',
        name: 'Thai Baht',
        nameTh: 'บาทไทย',
        symbol: '฿',
        decimals: 2,
        minAmount: 1,
        maxAmount: 2_000_000,
        isDefault: true,
        isActive: true,
    },
    USDT: {
        code: 'USDT',
        name: 'Tether (USDT)',
        nameTh: 'เทเธอร์',
        symbol: '₮',
        decimals: 6,
        minAmount: 0.01,
        maxAmount: 100_000,
        isDefault: false,
        isActive: true,
    },
    USD: {
        code: 'USD',
        name: 'US Dollar',
        nameTh: 'ดอลลาร์สหรัฐ',
        symbol: '$',
        decimals: 2,
        minAmount: 0.01,
        maxAmount: 50_000,
        isDefault: false,
        isActive: false, // Not yet active — ready for future
    },
};

/**
 * Get active currencies
 */
export function getActiveCurrencies(): CurrencyConfig[] {
    return Object.values(SUPPORTED_CURRENCIES).filter(c => c.isActive);
}

/**
 * Check if a currency is supported and active
 */
export function isCurrencySupported(code: string): boolean {
    const currency = SUPPORTED_CURRENCIES[code.toUpperCase()];
    return !!currency?.isActive;
}

/**
 * Validate amount for a given currency
 */
export function validateAmount(amount: number, currencyCode: string): { valid: boolean; error?: string } {
    const currency = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
    if (!currency || !currency.isActive) {
        return { valid: false, error: `สกุลเงิน ${currencyCode} ไม่รองรับ` };
    }
    if (amount < currency.minAmount) {
        return { valid: false, error: `จำนวนเงินขั้นต่ำ ${currency.symbol}${currency.minAmount}` };
    }
    if (amount > currency.maxAmount) {
        return { valid: false, error: `จำนวนเงินสูงสุด ${currency.symbol}${currency.maxAmount.toLocaleString()}` };
    }
    return { valid: true };
}
