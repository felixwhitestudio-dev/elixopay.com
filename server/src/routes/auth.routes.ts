import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// --- Strict Rate Limiters for Brute-Force Protection ---

// Login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: { message: 'Too many login attempts. Please try again after 15 minutes.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Verify Password (re-auth): 5 attempts per 15 minutes per IP
const sensitiveActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, error: { message: 'Too many verification attempts. Please try again after 15 minutes.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Forgot Password: 3 attempts per hour per IP
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { success: false, error: { message: 'Too many password reset requests. Please try again after 1 hour.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Routes ---
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/google', authController.googleLogin);
router.post('/google/complete', authController.completeGoogleProfile);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/me', protect, authController.me);
router.post('/verify-password', protect, sensitiveActionLimiter, authController.verifyPassword);

export default router;
