const Stripe = require('stripe');

// Initialize Stripe with secret key
const ensureStripeKey = () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) {
    console.warn('⚠️ STRIPE_SECRET_KEY missing; Stripe calls will fail. Stripe features will be disabled.');
    // Return dummy key to prevent Stripe from throwing error
    return 'sk_test_dummy';
  }
  return key;
};

let stripe = null;
const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
if (hasStripeKey) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

/**
 * Create a Payment Intent in Stripe
 */
exports.createPaymentIntent = async ({ amount, currency, metadata = {} }) => {
    const allowRedirects = (process.env.STRIPE_ALLOW_REDIRECTS || 'never').toLowerCase();
    const allowValue = allowRedirects === 'always' ? 'always' : 'never';
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: Object.assign({ platform: 'elixopay' }, metadata),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: allowValue,
      },
    });
    return {
      success: true,
      data: paymentIntent
    };
  } catch (error) {
    console.error('Stripe Payment Intent Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Retrieve a Payment Intent
 */
exports.retrievePaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      success: true,
      data: paymentIntent
    };
  } catch (error) {
    console.error('Stripe Retrieve Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Confirm a Payment Intent
 */
exports.confirmPaymentIntent = async (paymentIntentId, paymentMethodId = null) => {
  try {
    const options = {};
    if (paymentMethodId) {
      options.payment_method = paymentMethodId;
    }
    // If redirects are allowed, supply a return_url when confirming
    const allowRedirects = (process.env.STRIPE_ALLOW_REDIRECTS || 'never').toLowerCase();
    if (allowRedirects === 'always') {
      const returnUrl = process.env.STRIPE_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080/test-api.html';
      options.return_url = returnUrl;
    }

    const paymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId,
      options
    );

    return {
      success: true,
      data: paymentIntent
    };
  } catch (error) {
    console.error('Stripe Confirm Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Cancel a Payment Intent
 */
exports.cancelPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return {
      success: true,
      data: paymentIntent
    };
  } catch (error) {
    console.error('Stripe Cancel Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create a Refund
 */
exports.createRefund = async (paymentIntentId, amount = null) => {
  try {
    const refundData = {
      payment_intent: paymentIntentId,
    };

    // If amount specified, do partial refund
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundData);

    return {
      success: true,
      data: refund
    };
  } catch (error) {
    console.error('Stripe Refund Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create a Customer
 */
exports.createCustomer = async ({ email, name, metadata = {} }) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata
    });

    return {
      success: true,
      data: customer
            metadata: { platform: 'elixopay', ...metadata },
  } catch (error) {
    console.error('Stripe Create Customer Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get Customer
 */
exports.getCustomer = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return {
      success: true,
      data: customer
    };
  } catch (error) {
    console.error('Stripe Get Customer Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify Webhook Signature
 */
exports.verifyWebhookSignature = (payload, signature) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      const msg = 'STRIPE_WEBHOOK_SECRET not set';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(msg);
      }
      console.warn('Warning:', msg);
      return { success: false, error: 'Webhook secret not configured' };
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      try {
        const allowRedirects = (process.env.STRIPE_ALLOW_REDIRECTS || 'never').toLowerCase();
        const allowValue = allowRedirects === 'always' ? 'always' : 'never';
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          metadata: {
            ...metadata,
            platform: 'elixopay'
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: allowValue,
          },
        });
        return {
          success: true,
          data: paymentIntent
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || error
        };
      }
    return {
      success: true,
      data: paymentMethods.data
    };
  } catch (error) {
    console.error('Stripe List Payment Methods Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get Account Balance
 */
exports.getBalance = async () => {
  try {
    const balance = await stripe.balance.retrieve();
    return {
      success: true,
      data: balance
    };
  } catch (error) {
    console.error('Stripe Get Balance Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  stripe, // Export stripe instance for direct access if needed
  ...exports
};
