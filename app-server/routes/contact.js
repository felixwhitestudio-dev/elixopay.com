const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// Anti-spam rate limiting
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { success: false, message: 'คุณส่งข้อความมากเกินไป กรุณาลองอีกครั้งในอีก 1 ชั่วโมง' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Subject labels for email
const SUBJECT_LABELS = {
    sales: '💼 Sales Inquiry',
    support: '🛠️ Technical Support',
    partnership: '🤝 Business Partnership',
    billing: '💳 Billing Question',
    other: '📩 Other',
};

// Mailer setup (reuse same logic as mailer.ts)
let transporter = null;
async function getTransporter() {
    if (transporter) return transporter;
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    } else {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
        });
        console.log('[Mailer] Using Ethereal test account:', testAccount.user);
    }
    return transporter;
}

const FROM = process.env.SMTP_FROM || 'Elixopay <noreply@elixopay.com>';

// POST /api/v1/contact
router.post('/', contactLimiter, async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validate
        if (!name || name.length < 2) return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Invalid email address' });
        if (!['sales', 'support', 'partnership', 'billing', 'other'].includes(subject)) return res.status(400).json({ success: false, message: 'Please select a valid subject' });
        if (!message || message.length < 10) return res.status(400).json({ success: false, message: 'Message must be at least 10 characters' });

        const subjectLabel = SUBJECT_LABELS[subject] || subject;
        console.log(`[CONTACT] New submission from ${email} — ${subjectLabel}`);

        const transport = await getTransporter();
        const adminEmail = process.env.ADMIN_EMAIL || 'support@elixopay.com';

        // Send admin notification (fire-and-forget)
        transport.sendMail({
            from: FROM,
            to: adminEmail,
            replyTo: email,
            subject: `📩 Contact Form: ${subjectLabel} — จาก ${name}`,
            html: `
            <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
                <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
                <h2 style="font-size:18px; color:#1e293b;">📩 New Contact Form Submission</h2>
                <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 12px; color:#64748b; font-weight:600; width:120px;">ชื่อ</td><td style="padding:10px 12px; color:#1e293b;">${name}</td></tr>
                    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 12px; color:#64748b; font-weight:600;">อีเมล</td><td style="padding:10px 12px; color:#1e293b;"><a href="mailto:${email}" style="color:#4f46e5;">${email}</a></td></tr>
                    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 12px; color:#64748b; font-weight:600;">โทรศัพท์</td><td style="padding:10px 12px; color:#1e293b;">${phone || 'N/A'}</td></tr>
                    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 12px; color:#64748b; font-weight:600;">หัวข้อ</td><td style="padding:10px 12px; color:#1e293b;">${subjectLabel}</td></tr>
                </table>
                <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
                    <p style="color:#64748b; font-size:12px; font-weight:600; margin:0 0 8px;">ข้อความ:</p>
                    <p style="color:#1e293b; margin:0; white-space:pre-wrap; line-height:1.6;">${message}</p>
                </div>
                <p style="color:#64748b; font-size:13px;">💡 ตอบกลับอีเมลนี้เพื่อติดต่อลูกค้าโดยตรง (Reply-To: ${email})</p>
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
                <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — Contact Form Notification</p>
            </div>`,
        }).catch(err => console.error('[CONTACT] Failed to send admin email:', err.message));

        // Send auto-reply to customer (fire-and-forget)
        transport.sendMail({
            from: FROM,
            to: email,
            subject: '✅ เราได้รับข้อความของคุณแล้ว — Elixopay',
            html: `
            <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
                <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
                <h2 style="font-size:18px; color:#1e293b;">ขอบคุณที่ติดต่อเรา ✅</h2>
                <p style="color:#475569;">สวัสดีคุณ <strong>${name}</strong>,</p>
                <p style="color:#475569;">เราได้รับข้อความของคุณเรียบร้อยแล้ว ทีมงานของเราจะตรวจสอบและติดต่อกลับภายใน <strong>1 ชั่วโมง</strong></p>
                <div style="background:#eff6ff; border-left:4px solid #4f46e5; padding:12px 16px; border-radius:4px; margin:16px 0;">
                    <p style="color:#4f46e5; margin:0; font-weight:600;">📞 ต้องการความช่วยเหลือเร่งด่วน?</p>
                    <p style="color:#475569; margin:4px 0 0;">ส่งอีเมลถึงเราโดยตรงที่ <a href="mailto:support@elixopay.com" style="color:#4f46e5;">support@elixopay.com</a></p>
                </div>
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
                <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
            </div>`,
        }).catch(err => console.error('[CONTACT] Failed to send auto-reply:', err.message));

        res.status(200).json({ success: true, message: 'ข้อความของคุณถูกส่งเรียบร้อยแล้ว เราจะติดต่อกลับโดยเร็วที่สุด' });
    } catch (err) {
        console.error('[CONTACT] Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to submit contact form. Please try again.' });
    }
});

module.exports = router;
