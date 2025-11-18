# Stripe Integration Guide - Elixopay

## 🎯 Overview
Elixopay has integrated Stripe as the payment processor. This guide covers setup, testing, and production deployment.

---

## 📋 Prerequisites

1. **Stripe Account** - Sign up at [stripe.com](https://stripe.com)
2. **API Keys** - Get from Stripe Dashboard → Developers → API Keys
3. **Webhook Secret** - Get from Stripe Dashboard → Developers → Webhooks

---

## 🔧 Setup Instructions

### 1. Configure Environment Variables

Update `.env` file with your Stripe keys:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...    # Test mode secret key
STRIPE_PUBLISHABLE_KEY=pk_test_51... # Test mode publishable key
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook signing secret
```

**Get API Keys:**
- Navigate to: https://dashboard.stripe.com/test/apikeys
- Copy **Secret key** (starts with `sk_test_`)
- Copy **Publishable key** (starts with `pk_test_`)

### 2. Setup Webhook Endpoint

**Local Development (using Stripe CLI):**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe
```

The CLI will output your webhook signing secret:
```
> Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
```

**Production:**

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Set URL: `https://yourdomain.com/api/v1/webhooks/stripe`
4. Select events to listen:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
5. Copy the webhook signing secret and add to `.env`

---

## 💳 Payment Flow

### 1. Create Payment Intent

**Endpoint:** `POST /api/v1/payments`

**Request:**
```json
{
  "amount": 1000,
  "currency": "THB",
  "description": "Order #12345",
  "customer_email": "customer@example.com",
  "customer_name": "John Doe",
  "metadata": {
    "order_id": "12345",
    "product": "Premium Plan"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 1000,
      "currency": "THB",
      "status": "pending",
      "payment_intent_id": "pi_xxx"
    },
    "clientSecret": "pi_xxx_secret_yyy"
  }
}
```

### 2. Complete Payment on Frontend

Use the `clientSecret` with Stripe.js or Stripe Elements:

```javascript
// Frontend code example
const stripe = Stripe('pk_test_your_publishable_key');

const {error} = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Customer Name'
    }
  }
});

if (error) {
  console.error('Payment failed:', error);
} else {
  console.log('Payment succeeded!');
}
```

### 3. Webhook Updates Status

Stripe sends webhook events to your server when payment status changes:

- ✅ `payment_intent.succeeded` → Updates payment to "succeeded"
- ❌ `payment_intent.payment_failed` → Updates payment to "failed"
- 🚫 `payment_intent.canceled` → Updates payment to "cancelled"
- 💸 `charge.refunded` → Updates payment to "refunded"

---

## 🧪 Testing

### Test Card Numbers

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | ✅ Successful payment |
| `4000 0000 0000 9995` | ❌ Payment declined |
| `4000 0025 0000 3155` | 🔐 Requires authentication |

- **Expiry:** Any future date (e.g., 12/34)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any 5 digits (e.g., 12345)

### Test Webhooks Locally

```bash
# Terminal 1: Start your server
npm run dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe

# Terminal 3: Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

### Test Payments via API

```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@elixopay.com","password":"demo1234"}' \
  | jq -r '.data.token')

# Create payment
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "THB",
    "description": "Test Payment"
  }'
```

---

## 🔐 Security Best Practices

### 1. Webhook Signature Verification
- ✅ **Always verify** webhook signatures
- ✅ Currently implemented in `webhookController.js`
- ❌ Never process webhooks without verification

### 2. API Key Security
- ✅ Store keys in `.env` (never commit to git)
- ✅ Use test keys for development
- ✅ Use live keys only in production
- ✅ Rotate keys if compromised

### 3. Amount Handling
- ✅ Stripe uses **cents** (multiply by 100)
- ✅ We handle conversion automatically in `stripe.js`
- ✅ Always validate amounts server-side

---

## 📊 Supported Features

### ✅ Implemented
- [x] Create Payment Intent
- [x] Confirm Payment
- [x] Cancel Payment
- [x] Refund Payment (full & partial)
- [x] Webhook event handling
- [x] Payment status synchronization
- [x] Customer creation
- [x] Payment method storage

### 🚧 Coming Soon
- [ ] Subscription billing
- [ ] Payment method management UI
- [ ] Automatic payment retries
- [ ] Dispute handling
- [ ] Multi-currency support
- [ ] Payment analytics dashboard

---

## 📝 API Endpoints

### Payments
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments` - List payments
- `GET /api/v1/payments/:id` - Get payment details
- `POST /api/v1/payments/:id/confirm` - Confirm payment
- `POST /api/v1/payments/:id/cancel` - Cancel payment
- `POST /api/v1/payments/:id/refund` - Refund payment
- `GET /api/v1/payments/stats` - Payment statistics

### Webhooks
- `POST /api/v1/webhooks/stripe` - Stripe webhook handler
- `GET /api/v1/webhooks/logs` - View webhook logs
- `GET /api/v1/webhooks/test` - Test webhook endpoint

---

## 🐛 Troubleshooting

### Issue: Webhook signature verification fails

**Solution:**
```bash
# Check your webhook secret matches
echo $STRIPE_WEBHOOK_SECRET

# Get new secret from Stripe CLI
stripe listen --print-secret
```

### Issue: Payment remains in "pending" status

**Possible causes:**
1. Webhook not configured correctly
2. Webhook secret mismatch
3. Server not receiving webhook events

**Debug:**
```bash
# Check webhook logs
curl http://localhost:3000/api/v1/webhooks/logs \
  -H "Authorization: Bearer $TOKEN"

# Manually trigger webhook
stripe trigger payment_intent.succeeded
```

### Issue: "No such payment_intent" error

**Cause:** Using test/live key mismatch

**Solution:**
- Use `sk_test_*` keys with `pi_test_*` payment intents
- Use `sk_live_*` keys with `pi_live_*` payment intents

---

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)

---

## 🚀 Production Checklist

- [ ] Switch to live API keys (`sk_live_*`, `pk_live_*`)
- [ ] Configure production webhook endpoint
- [ ] Test webhook delivery in production
- [ ] Enable HTTPS (required for webhooks)
- [ ] Set up webhook monitoring/alerting
- [ ] Review Stripe Dashboard settings
- [ ] Enable fraud detection (Stripe Radar)
- [ ] Set up email receipts
- [ ] Configure dispute notifications
- [ ] Review PCI compliance requirements

---

## 💬 Support

For Stripe-related issues:
- Stripe Support: https://support.stripe.com
- Stripe Community: https://github.com/stripe

For Elixopay integration issues:
- Contact: support@elixopay.com
- Documentation: /docs
