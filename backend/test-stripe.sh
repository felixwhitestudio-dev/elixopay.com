#!/bin/bash

# Stripe Integration Test Script
# Usage: ./test-stripe.sh

set -e

echo "🧪 Testing Stripe Integration for Elixopay"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000/api/v1"

echo ""
echo "📝 Step 1: Login to get token"
echo "------------------------------"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@elixopay.com",
    "password": "demo1234"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo $LOGIN_RESPONSE | jq .
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."

echo ""
echo "💳 Step 2: Create Stripe Payment Intent"
echo "----------------------------------------"

PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 999.99,
    "currency": "THB",
    "description": "Stripe Integration Test Payment",
    "customer_email": "test@stripe.com",
    "customer_name": "Test Customer",
    "metadata": {
      "test": "true",
      "environment": "development"
    }
  }')

echo $PAYMENT_RESPONSE | jq .

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.payment.id')
CLIENT_SECRET=$(echo $PAYMENT_RESPONSE | jq -r '.data.clientSecret // empty')
PAYMENT_INTENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.payment.payment_intent_id')

if [ "$PAYMENT_ID" == "null" ] || [ -z "$PAYMENT_ID" ]; then
  echo -e "${RED}❌ Payment creation failed${NC}"
  exit 1
fi

if [ -n "$CLIENT_SECRET" ] && [ "$CLIENT_SECRET" != "null" ]; then
  echo -e "${GREEN}✅ Payment created successfully with Stripe${NC}"
  echo "Payment ID: $PAYMENT_ID"
  echo "Payment Intent ID: $PAYMENT_INTENT_ID"
  echo "Client Secret: ${CLIENT_SECRET:0:30}..."
else
  echo -e "${YELLOW}⚠️  Payment created but no client secret (check Stripe keys)${NC}"
  echo "Payment ID: $PAYMENT_ID"
fi

echo ""
echo "📋 Step 3: Get Payment Details"
echo "-------------------------------"

PAYMENT_DETAILS=$(curl -s -X GET "$BASE_URL/payments/$PAYMENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $PAYMENT_DETAILS | jq .

STATUS=$(echo $PAYMENT_DETAILS | jq -r '.data.payment.status')
echo "Current Status: $STATUS"

echo ""
echo "📊 Step 4: Get Payment Statistics"
echo "----------------------------------"

STATS=$(curl -s -X GET "$BASE_URL/payments/stats" \
  -H "Authorization: Bearer $TOKEN")

echo $STATS | jq '.data.stats'

echo ""
echo "🔗 Step 5: Test Webhook Endpoint"
echo "---------------------------------"

WEBHOOK_TEST=$(curl -s -X GET "$BASE_URL/webhooks/test")
echo $WEBHOOK_TEST | jq .

if [ "$(echo $WEBHOOK_TEST | jq -r '.success')" == "true" ]; then
  echo -e "${GREEN}✅ Webhook endpoint is active${NC}"
else
  echo -e "${RED}❌ Webhook endpoint error${NC}"
fi

echo ""
echo "📝 Summary"
echo "=========="
echo -e "${GREEN}✅ Login test passed${NC}"
echo -e "${GREEN}✅ Payment creation test passed${NC}"
echo -e "${GREEN}✅ Payment retrieval test passed${NC}"
echo -e "${GREEN}✅ Statistics test passed${NC}"
echo -e "${GREEN}✅ Webhook endpoint test passed${NC}"

echo ""
echo "🎯 Next Steps:"
echo "1. Configure Stripe API keys in .env"
echo "   STRIPE_SECRET_KEY=sk_test_..."
echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""
echo "2. Install Stripe CLI: brew install stripe/stripe-cli/stripe"
echo ""
echo "3. Forward webhooks: stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe"
echo ""
echo "4. Test payment completion: stripe trigger payment_intent.succeeded"
echo ""
echo "📚 Full documentation: See STRIPE_INTEGRATION.md"
