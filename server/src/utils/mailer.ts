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

// ── Bank Approved ─────────────────────────────────────────
export async function sendBankApprovedEmail(to: string, firstName: string, bankName: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '✅ คำขอเปลี่ยนบัญชีธนาคารได้รับการอนุมัติ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#1e293b;">อัปเดตบัญชีธนาคารสำเร็จ ✅</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">คำขอเปลี่ยนแปลงบัญชีธนาคารเป็นบัญชี <strong>${bankName}</strong> ของคุณได้รับการอนุมัติเรียบร้อยแล้ว
            จากการนี้ยอดเงินทั้งหมดจะถูกถอนไปยังบัญชีใหม่ของคุณในการทำรายการถัดไป</p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Bank Approved email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

// ── Bank Rejected ─────────────────────────────────────────
export async function sendBankRejectedEmail(to: string, firstName: string, reason: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '❌ คำขอเปลี่ยนบัญชีธนาคารไม่ผ่านการอนุมัติ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#dc2626;">คำขอเปลี่ยนบัญชีถูกปฏิเสธ</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">คำขอเปลี่ยนแปลงบัญชีธนาคารของคุณไม่ผ่านเกณฑ์ ด้วยเหตุผลดังนี้:</p>
            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin:16px 0;">
                <p style="color:#dc2626; margin:0; font-weight:600;">${reason}</p>
            </div>
            <p style="color:#475569;">คุณสามารถเข้าสู่ระบบเพื่อแก้ไขและทำการส่งคำขอใหม่ได้ตลอดเวลา</p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Bank Rejected email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

// ── Email Verification ───────────────────────────────────
export async function sendVerificationEmail(to: string, firstName: string, verifyUrl: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '✉️ ยืนยันอีเมลของคุณ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#1e293b;">ยืนยันการตั้งค่าบัญชีของคุณ</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">ยินดีต้อนรับสู่ Elixopay! เพื่อความปลอดภัยและเริ่มต้นใช้งานระบบ กรุณากดยืนยันอีเมลของคุณโดยคลิกที่ปุ่มด้านล่าง:</p>
            <a href="${verifyUrl}"
               style="display:inline-block; margin-top:16px; padding:12px 24px; background:#4f46e5; color:white; border-radius:8px; text-decoration:none; font-weight:bold;">
               ยืนยันอีเมลของฉัน →
            </a>
            <p style="color:#475569; margin-top:24px; font-size:14px;">หรือคัดลอกลิงก์นี้ไปวางเบราว์เซอร์ของคุณ:<br>
            <a href="${verifyUrl}" style="color:#4f46e5; word-break: break-all;">${verifyUrl}</a>
            </p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">ลิงก์นี้จะมีอายุการใช้งาน 24 ชั่วโมง</p>
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Verification email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

export async function sendPasswordResetEmail(to: string, firstName: string, resetUrl: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '🔒 รีเซ็ตรหัสผ่านของคุณ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#1e293b;">คำขอรีเซ็ตรหัสผ่าน</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">เราได้รับคำขอให้รีเซ็ตรหัสผ่านสำหรับบัญชี Elixopay ของคุณ หากคุณเป็นผู้ส่งคำขอนี้ กรุณาคลิกที่ปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
            <a href="${resetUrl}"
               style="display:inline-block; margin-top:16px; padding:12px 24px; background:#4f46e5; color:white; border-radius:8px; text-decoration:none; font-weight:bold;">
               ตั้งรหัสผ่านใหม่ →
            </a>
            <p style="color:#475569; margin-top:24px; font-size:14px;">หรือคัดลอกลิงก์นี้ไปวางเบราว์เซอร์ของคุณ:<br>
            <a href="${resetUrl}" style="color:#4f46e5; word-break: break-all;">${resetUrl}</a>
            </p>
            <p style="color:#ef4444; margin-top:16px; font-size:14px;"><strong>หากคุณไม่ได้ส่งคำขอนี้</strong> กรุณาละเว้นอีเมลฉบับนี้ รหัสผ่านของคุณจะยังคงปลอดภัยตามเดิม</p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">ลิงก์นี้จะมีอายุการใช้งาน 1 ชั่วโมง</p>
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Password reset email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

// ── Payout Approved ───────────────────────────────────────
export async function sendPayoutApprovedEmail(to: string, firstName: string, amount: number) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '✅ การถอนเงินของคุณได้รับการอนุมัติแล้ว — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#1e293b;">อนุมัติการถอนเงินสำเร็จ ✅</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">คำขอถอนเงินจำนวน <strong>฿ ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> ของคุณได้รับการอนุมัติ สำเร็จเรียบร้อยแล้ว
            ยอดเงินจะถูกโอนเข้าบัญชีธนาคารที่คุณระบุไว้ กรุณาตรวจสอบยอดเงินในบัญชีของคุณ</p>
            <a href="${process.env.APP_URL || 'http://localhost:8080'}/dashboard.html"
               style="display:inline-block; margin-top:16px; padding:12px 24px; background:#4f46e5; color:white; border-radius:8px; text-decoration:none; font-weight:bold;">
               ตรวจสอบสถานะในแดชบอร์ด →
            </a>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Payout Approved email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}

// ── Payout Rejected ───────────────────────────────────────
export async function sendPayoutRejectedEmail(to: string, firstName: string, amount: number, reason: string) {
    const transport = await getTransporter();
    const info = await transport.sendMail({
        from: FROM,
        to,
        subject: '❌ การถอนเงินของคุณไม่สำเร็จ — Elixopay',
        html: `
        <div style="font-family:Inter,sans-serif; max-width:600px; margin:auto; padding:32px; background:#f8fafc; border-radius:12px;">
            <h1 style="color:#4f46e5; font-size:24px; margin-bottom:8px;">Elixopay</h1>
            <h2 style="font-size:18px; color:#dc2626;">ระงับการถอนเงิน</h2>
            <p style="color:#475569;">สวัสดีคุณ <strong>${firstName}</strong>,</p>
            <p style="color:#475569;">คำขอถอนเงินจำนวน <strong>฿ ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> ของคุณไม่สามารถดำเนินการได้ ด้วยเหตุผลดังนี้:</p>
            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin:16px 0;">
                <p style="color:#dc2626; margin:0; font-weight:600;">${reason}</p>
            </div>
            <p style="color:#475569;">ยอดเงินดังกล่าวได้ถูกคืนเข้าสู่กระเป๋าเงิน (Wallet) ของคุณเรียบร้อยแล้ว หากมีข้อสงสัยเพิ่มเติมโปรดติดต่อฝ่ายสนับสนุน</p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
            <p style="color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} Elixopay — อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>`,
    });
    console.log('[Mailer] Payout Rejected email sent to', to, nodemailer.getTestMessageUrl(info) || '');
}
