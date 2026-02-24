import * as authService from '../../services/auth.service';
import jwt from 'jsonwebtoken';

// Set a test secret before importing
process.env.JWT_SECRET = 'test-jwt-secret-12345';
process.env.JWT_EXPIRES_IN = '1h';

describe('Auth Service', () => {
    // ============ Password Hashing ============
    describe('hashPassword', () => {
        it('should hash a password and return a different string', async () => {
            const password = 'MySecurePassword123!';
            const hash = await authService.hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(20);
        });

        it('should produce different hashes for the same password', async () => {
            const password = 'TestPassword456!';
            const hash1 = await authService.hashPassword(password);
            const hash2 = await authService.hashPassword(password);

            expect(hash1).not.toBe(hash2); // bcrypt uses random salt
        });
    });

    // ============ Password Comparison ============
    describe('comparePassword', () => {
        it('should return true for matching password', async () => {
            const password = 'CorrectPassword!';
            const hash = await authService.hashPassword(password);

            const result = await authService.comparePassword(password, hash);
            expect(result).toBe(true);
        });

        it('should return false for wrong password', async () => {
            const password = 'CorrectPassword!';
            const hash = await authService.hashPassword(password);

            const result = await authService.comparePassword('WrongPassword!', hash);
            expect(result).toBe(false);
        });

        it('should return false for empty password', async () => {
            const hash = await authService.hashPassword('SomePassword!');

            const result = await authService.comparePassword('', hash);
            expect(result).toBe(false);
        });
    });

    // ============ JWT Token Signing ============
    describe('signToken', () => {
        it('should sign a valid JWT token with user ID', () => {
            const userId = 42;
            const token = authService.signToken(userId);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

            // Decode (without verify) to check payload structure
            const decoded = jwt.decode(token) as any;
            expect(decoded).not.toBeNull();
            expect(decoded.id).toBe(userId);
        });

        it('should set an expiration on the token', () => {
            const token = authService.signToken(1);
            const decoded = jwt.decode(token) as any;

            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp).toBeGreaterThan(decoded.iat);
        });
    });

    // ============ Verification Token ============
    describe('generateVerificationToken', () => {
        it('should generate a token, hashedToken, and expiry date', () => {
            const result = authService.generateVerificationToken();

            expect(result.token).toBeDefined();
            expect(result.hashedToken).toBeDefined();
            expect(result.expires).toBeInstanceOf(Date);
        });

        it('should have token different from hashedToken', () => {
            const result = authService.generateVerificationToken();
            expect(result.token).not.toBe(result.hashedToken);
        });

        it('should set expiry to 24 hours in the future', () => {
            const before = Date.now();
            const result = authService.generateVerificationToken();
            const after = Date.now();

            const twentyFourHours = 24 * 60 * 60 * 1000;
            expect(result.expires.getTime()).toBeGreaterThanOrEqual(before + twentyFourHours - 100);
            expect(result.expires.getTime()).toBeLessThanOrEqual(after + twentyFourHours + 100);
        });

        it('should generate unique tokens each time', () => {
            const result1 = authService.generateVerificationToken();
            const result2 = authService.generateVerificationToken();

            expect(result1.token).not.toBe(result2.token);
            expect(result1.hashedToken).not.toBe(result2.hashedToken);
        });
    });

    // ============ Password Reset Token ============
    describe('generatePasswordResetToken', () => {
        it('should generate a token with 1-hour expiry', () => {
            const before = Date.now();
            const result = authService.generatePasswordResetToken();

            const oneHour = 1 * 60 * 60 * 1000;
            expect(result.token).toBeDefined();
            expect(result.hashedToken).toBeDefined();
            expect(result.expires.getTime()).toBeGreaterThanOrEqual(before + oneHour - 100);
        });
    });
});
