const Stripe = require('stripe');

// Initialize Stripe instance if key is present
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY missing. Stripe features will be disabled.');
}

/**
 * Create a Payment Intent
 */
exports.createPaymentIntent = async ({ amount, currency, metadata = {} }) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const allowRedirects = (process.env.STRIPE_ALLOW_REDIRECTS || 'never').toLowerCase();
    const allowValue = allowRedirects === 'always' ? 'always' : 'never';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: { platform: 'elixopay', ...metadata },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: allowValue,
      },
    });
    return { success: true, data: paymentIntent };
  } catch (error) {
    console.error('Stripe Payment Intent Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Retrieve a Payment Intent
 */
exports.retrievePaymentIntent = async (paymentIntentId) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { success: true, data: paymentIntent };
  } catch (error) {
    console.error('Stripe Retrieve Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Confirm a Payment Intent
 */
exports.confirmPaymentIntent = async (paymentIntentId, paymentMethodId = null) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const options = {};
    if (paymentMethodId) {
      options.payment_method = paymentMethodId;
    }
    const allowRedirects = (process.env.STRIPE_ALLOW_REDIRECTS || 'never').toLowerCase();
    if (allowRedirects === 'always') {
      options.return_url = process.env.STRIPE_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080/test-api.html';
    }

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, options);
    return { success: true, data: paymentIntent };
  } catch (error) {
    console.error('Stripe Confirm Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a Payment Intent
 */
exports.cancelPaymentIntent = async (paymentIntentId) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return { success: true, data: paymentIntent };
  } catch (error) {
    console.error('Stripe Cancel Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a Refund
 */
exports.createRefund = async (paymentIntentId, amount = null) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const refundData = { payment_intent: paymentIntentId };
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }
    const refund = await stripe.refunds.create(refundData);
    return { success: true, data: refund };
  } catch (error) {
    console.error('Stripe Refund Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a Customer
 */
exports.createCustomer = async ({ email, name, metadata = {} }) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { platform: 'elixopay', ...metadata }
    });
    return { success: true, data: customer };
  } catch (error) {
    console.error('Stripe Create Customer Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get Customer
 */
exports.getCustomer = async (customerId) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return { success: true, data: customer };
  } catch (error) {
    console.error('Stripe Get Customer Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify Webhook Signature
 */
exports.verifyWebhookSignature = (payload, signature) => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return { success: false, error: 'Webhook secret not configured' };
    }
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return { success: true, data: event };
  } catch (error) {
    console.error('Stripe Webhook Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get Account Balance
 */
exports.getBalance = async () => {
  if (!stripe) return { success: false, error: 'Stripe not configured' };
  try {
    const balance = await stripe.balance.retrieve();
    return { success: true, data: balance };
  } catch (error) {
    console.error('Stripe Get Balance Error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  stripe,
  ...exports
};
