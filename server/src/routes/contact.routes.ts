import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitContactForm } from '../controllers/contact.controller';

const router = Router();

// Strict rate limiting for contact form (anti-spam)
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 submissions per hour per IP
    message: {
        success: false,
        message: 'คุณส่งข้อความมากเกินไป กรุณาลองอีกครั้งในอีก 1 ชั่วโมง',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /api/v1/contact — Public (no auth required)
router.post('/', contactLimiter, submitContactForm);

export default router;
