const nodemailer = require('nodemailer');
const winston = require('winston');

// Create a logger if not already available in global scope or import it
// Assuming basic console logging for now or using the project's logger if I knew where it was.
// Based on package.json, winston is installed.
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email body (HTML)
 */
async function sendEmail(to, subject, html) {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn('⚠️ SMTP not configured. Email suppressed.', { to, subject });
        // In development, you might want to log the content to see what would have been sent
        if (process.env.NODE_ENV !== 'production') {
            console.log('--- EMAIL CONTENT ---');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(html);
            console.log('---------------------');
        }
        return { success: false, message: 'SMTP not configured' };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Elixopay Team" <no-reply@elixopay.com>',
            to,
            subject,
            html,
        });

        logger.info('📧 Email sent', { messageId: info.messageId, to });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        logger.error('❌ Failed to send email', { error: error.message, to });
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail };
