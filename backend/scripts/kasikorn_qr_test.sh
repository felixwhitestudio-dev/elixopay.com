#!/bin/bash

# Configuration
# URL for BOT QR Payment
PAYMENT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payment/v1/qr"
# Reusing known working token to avoid rate limits
ACCESS_TOKEN="OqbvOtPhilH3Jel4rRGzhqhB4PGF"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make BOT QR Payment Request
echo "--- Step 2: Making BOT QR Payment Request ---"

curl --location --request POST "$PAYMENT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-payqr001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-payqr" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerShopID": "shop001",
  "partnerOrderID": "ORDERQR0000000001",
  "partnerPaymentID": "PAYMENTQR00000001",
  "amount": 1000.50,
  "currencyCode": "THB",
  "payoutType": "DELAY",
  "sourceOfFundMerchantID": "MERCHANT001",
  "sourceOfFundShopID": "SHOP001"
}'

echo ""
echo "Done."
