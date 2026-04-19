// Mock modules that have ESM dependencies (uuid in KBankService)
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../services/kbank.service', () => ({
    KBankService: {
        generateQR: jest.fn().mockResolvedValue({
            qrCode: 'MOCK_QR_CODE',
            txnId: 'MOCK_TXN_ID',
            refId: 'MOCK_REF_ID',
        }),
    },
}));

import { PaymentOrchestrator } from '../../services/orchestrator.service';
import { TestProvider } from '../../providers/TestProvider';
import { PaymentProvider, PaymentMethod, ChargeParams, ChargeResult, ChargeStatusResult, RefundResult } from '../../providers/PaymentProvider';

// A simple stub provider for testing
class StubProvider implements PaymentProvider {
    readonly name: string;
    readonly supportedMethods: PaymentMethod[];
    public createChargeCalled = false;
    public getChargeStatusCalled = false;
    public refundCalled = false;

    constructor(name: string, methods: PaymentMethod[]) {
        this.name = name;
        this.supportedMethods = methods;
    }

    async createCharge(params: ChargeParams): Promise<ChargeResult> {
        this.createChargeCalled = true;
        return {
            providerChargeId: `${this.name}_chrg_123`,
            status: 'pending',
            qrCode: this.supportedMethods.includes('qr') ? 'QR_DATA' : undefined,
        };
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        this.getChargeStatusCalled = true;
        return { providerChargeId, status: 'pending', amount: 100 };
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        this.refundCalled = true;
        return { providerRefundId: `${this.name}_rfnd_123`, status: 'completed', amount };
    }
}

describe('PaymentOrchestrator', () => {
    let orchestrator: PaymentOrchestrator;

    beforeEach(() => {
        orchestrator = new PaymentOrchestrator();
    });

    describe('Provider Registration', () => {
        it('should initialize with default providers (kbank, omise, test)', () => {
            const providers = orchestrator.listProviders();
            const names = providers.map(p => p.name);
            expect(names).toContain('kbank');
            expect(names).toContain('omise');
            expect(names).toContain('test');
        });

        it('should register a new custom provider', () => {
            const custom = new StubProvider('custom_gateway', ['wallet']);
            orchestrator.registerProvider(custom);

            const providers = orchestrator.listProviders();
            const names = providers.map(p => p.name);
            expect(names).toContain('custom_gateway');
        });

        it('should override an existing provider when re-registered', () => {
            const providers1 = orchestrator.listProviders();
            const kbankMethods1 = providers1.find(p => p.name === 'kbank')?.methods;
            expect(kbankMethods1).toEqual(['qr']);

            const customKbank = new StubProvider('kbank', ['qr', 'bank_transfer']);
            orchestrator.registerProvider(customKbank);

            const providers2 = orchestrator.listProviders();
            const kbankMethods2 = providers2.find(p => p.name === 'kbank')?.methods;
            expect(kbankMethods2).toEqual(['qr', 'bank_transfer']);
        });
    });

    describe('Provider Selection', () => {
        it('should always use TestProvider in test mode', () => {
            const provider = orchestrator.selectProvider('qr', { isTestMode: true });
            expect(provider.name).toBe('test');
        });

        it('should always use TestProvider in test mode even for card', () => {
            const provider = orchestrator.selectProvider('card', { isTestMode: true });
            expect(provider.name).toBe('test');
        });

        it('should select kbank for qr method in live mode', () => {
            const provider = orchestrator.selectProvider('qr');
            expect(provider.name).toBe('kbank');
        });

        it('should select omise for card method in live mode', () => {
            const provider = orchestrator.selectProvider('card');
            expect(provider.name).toBe('omise');
        });

        it('should respect preferred provider if it supports the method', () => {
            const custom = new StubProvider('custom_qr', ['qr']);
            orchestrator.registerProvider(custom);

            const provider = orchestrator.selectProvider('qr', { preferredProvider: 'custom_qr' });
            expect(provider.name).toBe('custom_qr');
        });

        it('should fall back if preferred provider does not support the method', () => {
            const provider = orchestrator.selectProvider('qr', { preferredProvider: 'omise' });
            // Omise doesn't support QR, should fall back to kbank
            expect(provider.name).toBe('kbank');
        });

        it('should throw if no provider supports the method', () => {
            expect(() => orchestrator.selectProvider('wallet')).toThrow(
                'No provider available for payment method: wallet'
            );
        });
    });

    describe('createCharge', () => {
        it('should route qr charges to kbank in live mode', async () => {
            const stub = new StubProvider('kbank', ['qr']);
            orchestrator.registerProvider(stub);

            const result = await orchestrator.createCharge({
                amount: 100,
                currency: 'THB',
                method: 'qr',
            });

            expect(result.provider).toBe('kbank');
            expect(stub.createChargeCalled).toBe(true);
            expect(result.result.providerChargeId).toBe('kbank_chrg_123');
        });

        it('should route card charges to omise in live mode', async () => {
            const stub = new StubProvider('omise', ['card']);
            orchestrator.registerProvider(stub);

            const result = await orchestrator.createCharge({
                amount: 500,
                currency: 'THB',
                method: 'card',
                token: 'tokn_test_123',
            });

            expect(result.provider).toBe('omise');
            expect(stub.createChargeCalled).toBe(true);
        });

        it('should use TestProvider when isTestMode is true', async () => {
            const result = await orchestrator.createCharge(
                { amount: 100, currency: 'THB', method: 'qr' },
                { isTestMode: true }
            );

            expect(result.provider).toBe('test');
            expect(result.result.providerChargeId).toContain('test_chrg_');
            expect(result.result.status).toBe('pending');
        });

        it('should include QR code in test QR response', async () => {
            const result = await orchestrator.createCharge(
                { amount: 250, currency: 'THB', method: 'qr' },
                { isTestMode: true }
            );

            expect(result.result.qrCode).toBeDefined();
            expect(result.result.qrCode).toContain('250.00');
        });

        it('should include redirect URL in test card response', async () => {
            const result = await orchestrator.createCharge(
                { amount: 1000, currency: 'THB', method: 'card', token: 'tok_test' },
                { isTestMode: true }
            );

            expect(result.result.redirectUrl).toBeDefined();
        });
    });

    describe('getChargeStatus', () => {
        it('should call the correct provider for status check', async () => {
            const stub = new StubProvider('kbank', ['qr']);
            orchestrator.registerProvider(stub);

            await orchestrator.getChargeStatus('kbank', 'chrg_123');

            expect(stub.getChargeStatusCalled).toBe(true);
        });

        it('should throw for unknown provider', async () => {
            await expect(orchestrator.getChargeStatus('nonexistent', 'chrg_123'))
                .rejects.toThrow('Unknown provider: nonexistent');
        });
    });

    describe('refund', () => {
        it('should call the correct provider for refund', async () => {
            const stub = new StubProvider('omise', ['card']);
            orchestrator.registerProvider(stub);

            const result = await orchestrator.refund('omise', 'chrg_123', 50);

            expect(stub.refundCalled).toBe(true);
            expect(result.amount).toBe(50);
        });

        it('should throw for unknown provider', async () => {
            await expect(orchestrator.refund('nonexistent', 'chrg_123', 50))
                .rejects.toThrow('Unknown provider: nonexistent');
        });
    });

    describe('TestProvider specific', () => {
        it('should simulate payment completion', async () => {
            const testProvider = orchestrator.getTestProvider();

            const charge = await testProvider.createCharge({
                amount: 100, currency: 'THB', method: 'qr'
            });

            // Before completion
            let status = await testProvider.getChargeStatus(charge.providerChargeId);
            expect(status.status).toBe('pending');

            // Complete it
            testProvider.completeCharge(charge.providerChargeId);

            // After completion
            status = await testProvider.getChargeStatus(charge.providerChargeId);
            expect(status.status).toBe('completed');
        });

        it('should support all payment methods', () => {
            const testProvider = orchestrator.getTestProvider();
            expect(testProvider.supportedMethods).toEqual(['qr', 'card', 'bank_transfer', 'wallet']);
        });

        it('should process test refunds instantly as completed', async () => {
            const testProvider = orchestrator.getTestProvider();
            const result = await testProvider.refund('test_chrg_123', 99);
            expect(result.status).toBe('completed');
            expect(result.amount).toBe(99);
        });
    });
});
