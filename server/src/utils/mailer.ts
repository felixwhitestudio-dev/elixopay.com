import nodemailer from 'nodemailer';

// ── Transport ──────────────────────────────────────────────
// Uses SMTP env vars. Falls back to Ethereal (test) if not set.
let transporter: nodemailer.Transporter;

async function getTransporter() {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Dev fallback: Ethereal (prints preview URL to console)
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

// ── Sender ────────────────────────────────────────────────
const FROM = process.env.SMTP_FROM || 'Elixopay <noreply@elixopay.com>';

// ── KYC Approved ─────────────────────────────────────────
export async function sendKycApprovedEmail(to: string, firstName: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '✅ KYC ของคุณได้รับการอนุมัติแล้ว — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#1e293b;">ยืนยันตัวตน (KYC) สำเร็จ ✅</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">เอกสาร KYC ของคุณได้รับการตรวจสอบและอนุมัติเรียบร้อยแล้ว
            คุณสามารถใช้งานระบบชำระเงินได้เต็มรูปแบบ และบัญชีธนาคารของคุณได้รับการยืนยันตามมาตรฐาน BOT แล้ว</p>
            <a href="${process.env.APP_URL || 'http://localhost:8080'}/dashboard.html"
               style="display:inline-block; margin-top:16px; padding:12px 24px; background:#4f46e5; color:white; border-radius:8px; text-decoration:none; font-weight:bold;">
               เข้าสู่แดชบอร์ด →
            </a>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] KYC Approved email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

// ── KYC Rejected ─────────────────────────────────────────
export async function sendKycRejectedEmail(to: string, firstName: string, reason: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '❌ KYC ของคุณยังไม่ผ่านการตรวจสอบ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#dc2626;">เอกสาร KYC ยังไม่ผ่านการตรวจสอบ</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">เจ้าหน้าที่ตรวจสอบแล้วพบว่าเอกสารของคุณยังไม่ผ่านเกณฑ์ ด้วยเหตุผลดังนี้:</p>
            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin:16px 0;">
                <p style="color:#dc2626; margin:0; font-weight:600;">${reason}</p>
            </div>
            <p style="color:#475569;">กรุณาแก้ไขตามที่แจ้งและส่งเอกสารใหม่อีกครั้ง</p>
            <a href="${process.env.APP_URL || 'http://localhost:8080'}/kyc.html"
               style="display:inline-block; margin-top:16px; padding:12px 24px; background:#dc2626; color:white; border-radius:8px; text-decoration:none; font-weight:bold;">
               ส่งเอกสารใหม่ →
            </a>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] KYC Rejected email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}
