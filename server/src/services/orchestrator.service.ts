import {
    PaymentProvider,
    PaymentMethod,
    ChargeParams,
    ChargeResult,
    ChargeStatusResult,
    RefundResult,
} from '../providers/PaymentProvider';
import { KBankProvider } from '../providers/KBankProvider';
import { OmiseProvider } from '../providers/OmiseProvider';
import { TestProvider } from '../providers/TestProvider';
import logger from '../utils/logger';

/**
 * Payment Orchestrator
 * 
 * Central service that routes payment requests to the correct gateway provider
 * based on payment method and merchant configuration.
 * 
 * Architecture:
 *   Merchant API → Orchestrator → Provider Selection → Gateway API
 */
export class PaymentOrchestrator {
    private providers: Map<string, PaymentProvider> = new Map();
    private testProvider: TestProvider;

    constructor() {
        // Register all available providers
        const kbank = new KBankProvider();
        const omise = new OmiseProvider();
        this.testProvider = new TestProvider();

        this.registerProvider(kbank);
        this.registerProvider(omise);
        this.registerProvider(this.testProvider);

        logger.info(`[Orchestrator] Initialized with ${this.providers.size} providers: ${[...this.providers.keys()].join(', ')}`);
    }

    /**
     * Register a new payment provider
     */
    registerProvider(provider: PaymentProvider): void {
        this.providers.set(provider.name, provider);
    }

    /**
     * Get a specific provider by name
     */
    getProvider(name: string): PaymentProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Get the test provider instance (for simulating payment completions in test mode)
     */
    getTestProvider(): TestProvider {
        return this.testProvider;
    }

    /**
     * List all registered providers and their supported methods
     */
    listProviders(): Array<{ name: string; methods: PaymentMethod[] }> {
        return [...this.providers.values()].map(p => ({
            name: p.name,
            methods: [...p.supportedMethods],
        }));
    }

    /**
     * Select the best provider for a given payment method.
     * 
     * Priority:
     * 1. If `isTestMode` → always use TestProvider
     * 2. If `preferredProvider` specified → use that (if it supports the method)
     * 3. Otherwise → auto-select first provider that supports the method
     */
    selectProvider(
        method: PaymentMethod,
        options: { isTestMode?: boolean; preferredProvider?: string } = {}
    ): PaymentProvider {
        // Test mode always uses TestProvider
        if (options.isTestMode) {
            logger.info(`[Orchestrator] Test mode → using TestProvider`);
            return this.testProvider;
        }

        // Try preferred provider first
        if (options.preferredProvider) {
            const preferred = this.providers.get(options.preferredProvider);
            if (preferred && preferred.supportedMethods.includes(method)) {
                return preferred;
            }
            logger.warn(`[Orchestrator] Preferred provider '${options.preferredProvider}' does not support '${method}', falling back`);
        }

        // Auto-select by method
        for (const provider of this.providers.values()) {
            if (provider.name === 'test') continue; // Skip test provider in live mode
            if (provider.supportedMethods.includes(method)) {
                logger.info(`[Orchestrator] Auto-selected '${provider.name}' for method '${method}'`);
                return provider;
            }
        }

        throw new Error(`No provider available for payment method: ${method}`);
    }

    /**
     * Create a charge through the appropriate provider
     */
    async createCharge(
        params: ChargeParams,
        options: { isTestMode?: boolean; preferredProvider?: string } = {}
    ): Promise<{ provider: string; result: ChargeResult }> {
        const provider = this.selectProvider(params.method, options);

        logger.info(`[Orchestrator] Creating charge via '${provider.name}': ฿${params.amount} (${params.method})`);

        const result = await provider.createCharge(params);

        return {
            provider: provider.name,
            result,
        };
    }

    /**
     * Check charge status from the provider
     */
    async getChargeStatus(
        providerName: string,
        providerChargeId: string
    ): Promise<ChargeStatusResult> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Unknown provider: ${providerName}`);
        }

        return provider.getChargeStatus(providerChargeId);
    }

    /**
     * Refund a charge through the original provider
     */
    async refund(
        providerName: string,
        providerChargeId: string,
        amount: number
    ): Promise<RefundResult> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Unknown provider: ${providerName}`);
        }

        logger.info(`[Orchestrator] Refund ฿${amount} via '${providerName}' for charge: ${providerChargeId}`);

        return provider.refund(providerChargeId, amount);
    }
}

// Singleton instance
export const orchestrator = new PaymentOrchestrator();
