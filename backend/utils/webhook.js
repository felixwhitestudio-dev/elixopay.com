const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

/**
 * Send a webhook to a merchant
 * @param {string} url - The merchant's webhook URL
 * @param {string} event - Event name (e.g. payment.succeeded)
 * @param {object} payload - The data payload
 * @param {string} secret - The webhook signing secret (optional)
 */
async function sendWebhook(url, event, payload, secret) {
    if (!url) {
        logger.warn('⚠️ No webhook URL provided, skipping.');
        return { success: false, message: 'No URL' };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const data = {
        id: `evt_${crypto.randomBytes(12).toString('hex')}`,
        object: 'event',
        created: timestamp,
        type: event,
        data: payload
    };

    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Elixopay-Webhook/1.0',
        'X-Elixopay-Event': event,
        'X-Elixopay-Timestamp': timestamp.toString()
    };

    // Calculate signature if secret is provided
    if (secret) {
        const payloadString = JSON.stringify(data);
        const signedPayload = `${timestamp}.${payloadString}`;
        const signature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        headers['X-Elixopay-Signature'] = `t=${timestamp},v1=${signature}`;
    }

    try {
        logger.info(`🚀 Sending webhook to ${url}`, { event });

        const response = await axios.post(url, data, {
            headers,
            timeout: 5000 // 5s timeout
        });

        logger.info(`✅ Webhook sent successfully`, { status: response.status });
        return { success: true, status: response.status, data: response.data };
    } catch (error) {
        const status = error.response ? error.response.status : 'Network Error';
        logger.error(`❌ Webhook failed`, { url, error: error.message, status });
        return { success: false, error: error.message, status };
    }
}

module.exports = { sendWebhook };
