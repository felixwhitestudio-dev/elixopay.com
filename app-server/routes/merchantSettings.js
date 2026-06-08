const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route   GET /api/v1/merchant-settings
 * @desc    Get merchant settings for authenticated user (auto-creates defaults if not exists)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Upsert: create default row if not exists, then return
    const result = await db.query(
      `INSERT INTO merchant_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const settings = await db.query(
      `SELECT
        business_name, business_type, business_email, business_phone,
        business_website, business_address,
        default_currency, auto_payout, payment_description, test_mode, auto_capture,
        notify_email_success, notify_email_fail, notify_email_payout,
        notify_daily_summary, notify_sms_high_value, notify_sms_security,
        timezone, date_format, number_format,
        updated_at
       FROM merchant_settings WHERE user_id = $1`,
      [userId]
    );

    if (settings.rows.length === 0) {
      return res.status(500).json({ success: false, error: { message: 'Failed to create settings' } });
    }

    const row = settings.rows[0];

    // Map flat DB columns → structured frontend format
    res.json({
      success: true,
      data: {
        settings: {
          profile: {
            bizName: row.business_name || '',
            bizType: row.business_type || '',
            bizEmail: row.business_email || '',
            bizPhone: row.business_phone || '',
            bizWebsite: row.business_website || '',
            bizAddress: row.business_address || ''
          },
          payment: {
            currency: row.default_currency || 'THB',
            autoPayout: row.auto_payout || 'manual',
            desc: row.payment_description || '',
            testMode: row.test_mode,
            autoCapture: row.auto_capture
          },
          notifications: {
            emailSuccess: row.notify_email_success,
            emailFail: row.notify_email_fail,
            emailPayout: row.notify_email_payout,
            dailySummary: row.notify_daily_summary,
            smsHighValue: row.notify_sms_high_value,
            smsSecurity: row.notify_sms_security
          },
          display: {
            timezone: row.timezone || 'Asia/Bangkok',
            dateFormat: row.date_format || 'DD/MM/YYYY',
            numberFormat: row.number_format || 'th-TH'
          },
          updatedAt: row.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching merchant settings:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

/**
 * @route   PUT /api/v1/merchant-settings
 * @desc    Update merchant settings (partial update)
 * @access  Private
 */
router.put('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    // Ensure row exists
    await db.query(
      `INSERT INTO merchant_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // Build dynamic SET clause from provided fields
    const fieldMap = {
      // Profile
      'profile.bizName': 'business_name',
      'profile.bizType': 'business_type',
      'profile.bizEmail': 'business_email',
      'profile.bizPhone': 'business_phone',
      'profile.bizWebsite': 'business_website',
      'profile.bizAddress': 'business_address',
      // Payment
      'payment.currency': 'default_currency',
      'payment.autoPayout': 'auto_payout',
      'payment.desc': 'payment_description',
      'payment.testMode': 'test_mode',
      'payment.autoCapture': 'auto_capture',
      // Notifications
      'notifications.emailSuccess': 'notify_email_success',
      'notifications.emailFail': 'notify_email_fail',
      'notifications.emailPayout': 'notify_email_payout',
      'notifications.dailySummary': 'notify_daily_summary',
      'notifications.smsHighValue': 'notify_sms_high_value',
      'notifications.smsSecurity': 'notify_sms_security',
      // Display
      'display.timezone': 'timezone',
      'display.dateFormat': 'date_format',
      'display.numberFormat': 'number_format'
    };

    const updates = [];
    const values = [userId]; // $1 = user_id
    let paramIndex = 2;

    // Flatten nested body: { profile: { bizName: 'X' } } → 'profile.bizName' = 'X'
    for (const [section, sectionData] of Object.entries(body)) {
      if (typeof sectionData === 'object' && sectionData !== null) {
        for (const [key, value] of Object.entries(sectionData)) {
          const path = `${section}.${key}`;
          const column = fieldMap[path];
          if (column) {
            updates.push(`${column} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No valid fields to update' } });
    }

    updates.push('updated_at = NOW()');

    await db.query(
      `UPDATE merchant_settings SET ${updates.join(', ')} WHERE user_id = $1`,
      values
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating merchant settings:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

module.exports = router;
