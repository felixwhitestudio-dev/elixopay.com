import {
    PaymentProvider,
    PaymentMethod,
    ChargeParams,
    ChargeResult,
    ChargeStatusResult,
    RefundResult,
} from './PaymentProvider';
import { KBankService } from '../services/kbank.service';
import logger from '../utils/logger';

/**
 * KBank Payment Provider
 * 
 * Wraps the existing KBankService to implement the PaymentProvider interface.
 * Supports PromptPay QR code payments via KBank Open API.
 */
export class KBankProvider implements PaymentProvider {
    readonly name = 'kbank';
    readonly supportedMethods: PaymentMethod[] = ['qr'];

    async createCharge(params: ChargeParams): Promise<ChargeResult> {
        logger.info(`[KBankProvider] Creating charge: ฿${params.amount}`);

        try {
            const qrResponse = await KBankService.generateQR(
                params.amount,
                params.orderId || `ORD-${Date.now()}`,
                params.description || 'Payment'
            );

            return {
                providerChargeId: qrResponse.txnId || qrResponse.refId,
                status: 'pending',
                qrCode: qrResponse.qrCode,
                rawResponse: qrResponse,
            };
        } catch (error: any) {
            logger.error('[KBankProvider] createCharge failed:', error.message);
            throw new Error(`KBank charge failed: ${error.message}`);
        }
    }

    async getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult> {
        // KBank sandbox does not have a status check API readily available
        // In production, this would call KBank's inquiry API
        logger.info(`[KBankProvider] getChargeStatus: ${providerChargeId}`);

        return {
            providerChargeId,
            status: 'pending',
            amount: 0,
            rawResponse: { message: 'KBank status check not yet implemented — use webhook callback instead' },
        };
    }

    async refund(providerChargeId: string, amount: number): Promise<RefundResult> {
        // KBank QR refunds are handled via a separate bank process
        // For now, we record the refund in our system (handled by orchestrator)
        logger.info(`[KBankProvider] Refund ฿${amount} for charge: ${providerChargeId}`);

        return {
            providerRefundId: `RFND-KB-${Date.now()}`,
            status: 'pending',
            amount,
            rawResponse: { message: 'KBank QR refunds processed via bank settlement' },
        };
    }
}
