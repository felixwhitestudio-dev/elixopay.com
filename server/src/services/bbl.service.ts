import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export class BBLService {
    // These should be loaded from environment variables or secure storage in production
    // For this implementation, we will allow passing them in or read from process.env
    private static get merchantPrivateKey() {
        return process.env.BBL_MERCHANT_PRIVATE_KEY || '';
    }

    private static get bankPublicKey() {
        return process.env.BBL_BANK_PUBLIC_KEY || '';
    }

    private static get merchantUsername() {
        return process.env.BBL_USERNAME || 'bbl-sandbox';
    }

    private static get merchantPassword() {
        return process.env.BBL_PASSWORD || 'BBL_Sandbox';
    }

    /**
     * Generates a signed JWT for the request payload.
     * Uses RS256 algorithm with the Merchant's Private Key.
     */
    static generateJWT(payload: any): string {
        if (!this.merchantPrivateKey) {
            throw new Error('BBL_MERCHANT_PRIVATE_KEY is missing');
        }

        // Ensure the key is formatted correctly for JWT library (PEM format)
        // If it's a raw string, it might need header/footer added, but we assume valid PEM here for now.
        const privateKey = this.merchantPrivateKey;

        const options: jwt.SignOptions = {
            algorithm: 'RS256',
            // BBL might require specific headers or claims, typically standard JWT is fine along with custom payload
        };

        return jwt.sign(payload, privateKey, options);
    }

    /**
     * Verifies a JWT received from Bangkok Bank.
     * Uses RS256 algorithm with the Bank's Public Key.
     */
    static verifyJWT(token: string): any {
        if (!this.bankPublicKey) {
            throw new Error('BBL_BANK_PUBLIC_KEY is missing');
        }

        const publicKey = this.bankPublicKey;

        try {
            return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
        } catch (error: any) {
            throw new Error(`JWT Verification Failed: ${error.message}`);
        }
    }

    /**
     * Validates Basic Authentication credentials.
     */
    static validateBasicAuth(authHeader: string): boolean {
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return false;
        }

        const token = authHeader.split(' ')[1];
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');

        return username === this.merchantUsername && password === this.merchantPassword;
    }

    /**
     * Helper to generate a new RSA Key Pair for testing purposes.
     * Returns keys in PEM format.
     */
    static generateKeyPair(): { publicKey: string; privateKey: string } {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        return { publicKey, privateKey };
    }
}
