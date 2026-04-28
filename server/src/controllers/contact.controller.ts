import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';
import { sendContactFormEmail, sendContactAutoReply } from '../utils/mailer';
import logger from '../utils/logger';

// ── Validation Schema ─────────────────────────────────────
const contactSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    phone: z.string().max(20).optional().default(''),
    subject: z.enum(['sales', 'support', 'partnership', 'billing', 'other'], {
        message: 'Please select a valid subject',
    }),
    message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

// Subject display names for email
const SUBJECT_LABELS: Record<string, string> = {
    sales: '💼 Sales Inquiry',
    support: '🛠️ Technical Support',
    partnership: '🤝 Business Partnership',
    billing: '💳 Billing Question',
    other: '📩 Other',
};

// ── Submit Contact Form ───────────────────────────────────
export const submitContactForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Validate input
        const parsed = contactSchema.safeParse(req.body);
        if (!parsed.success) {
            const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(', ');
            return next(new AppError(errors, 400));
        }

        const { name, email, phone, subject, message } = parsed.data;
        const subjectLabel = SUBJECT_LABELS[subject] || subject;

        logger.info(`[CONTACT] New submission from ${email} — ${subjectLabel}`);

        // 2. Send notification email to admin (fire-and-forget with error logging)
        sendContactFormEmail({
            name,
            email,
            phone: phone || 'N/A',
            subject: subjectLabel,
            message,
        }).catch(err => {
            logger.error('[CONTACT] Failed to send admin notification:', err.message);
        });

        // 3. Send auto-reply to customer
        sendContactAutoReply({
            name,
            email,
        }).catch(err => {
            logger.error('[CONTACT] Failed to send auto-reply:', err.message);
        });

        // 4. Respond immediately (don't wait for emails)
        res.status(200).json({
            success: true,
            message: 'ข้อความของคุณถูกส่งเรียบร้อยแล้ว เราจะติดต่อกลับโดยเร็วที่สุด',
        });
    } catch (err: any) {
        logger.error('[CONTACT] Unexpected error:', err.message);
        next(new AppError('Failed to submit contact form. Please try again.', 500));
    }
};
