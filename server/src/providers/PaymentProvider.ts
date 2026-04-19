/**
 * Payment Provider Interface
 * 
 * ทุก Payment Gateway ต้อง implement interface นี้
 * เพื่อให้ PaymentOrchestrator เลือกใช้ได้อัตโนมัติ
 */

// ========================
// Types & Enums
// ========================

export type PaymentMethod = 'qr' | 'card' | 'bank_transfer' | 'wallet';

export type ChargeStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface ChargeParams {
    amount: number;
    currency: string;
    method: PaymentMethod;
    description?: string;
    metadata?: Record<string, any>;
    returnUrl?: string;
    /** Tokenized card data (from Omise.js / 2C2P SDK) — never raw card numbers */
    token?: string;
    /** Unique order/reference ID from the merchant */
    orderId?: string;
}

export interface ChargeResult {
    /** Charge ID from the gateway provider */
    providerChargeId: string;
    /** Current status of the charge */
    status: ChargeStatus;
    /** QR code data string (for QR payments) */
    qrCode?: string;
    /** Redirect URL (for 3D Secure / hosted checkout) */
    redirectUrl?: string;
    /** Authorize URI for customer (Omise) */
    authorizeUri?: string;
    /** Raw response from the gateway (for debugging) */
    rawResponse?: any;
}

export interface RefundResult {
    /** Refund ID from the gateway */
    providerRefundId: string;
    /** Refund status */
    status: 'pending' | 'completed' | 'failed';
    /** Amount refunded */
    amount: number;
    rawResponse?: any;
}

export interface ChargeStatusResult {
    providerChargeId: string;
    status: ChargeStatus;
    amount: number;
    paidAt?: Date;
    rawResponse?: any;
}

// ========================
// Provider Interface
// ========================

export interface PaymentProvider {
    /** Provider name identifier (e.g., 'kbank', 'omise', 'test') */
    readonly name: string;

    /** Payment methods this provider supports */
    readonly supportedMethods: PaymentMethod[];

    /**
     * Create a new charge/payment
     * @returns ChargeResult with provider-specific charge ID and status
     */
    createCharge(params: ChargeParams): Promise<ChargeResult>;

    /**
     * Get the current status of a charge from the gateway
     * @param providerChargeId - The charge ID returned by createCharge
     */
    getChargeStatus(providerChargeId: string): Promise<ChargeStatusResult>;

    /**
     * Refund a charge (partial or full)
     * @param providerChargeId - The charge ID to refund
     * @param amount - Amount to refund
     */
    refund(providerChargeId: string, amount: number): Promise<RefundResult>;
}
