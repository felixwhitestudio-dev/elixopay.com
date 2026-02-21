#!/bin/bash

# Configuration
# URL for K+ App Switch
PAYMENT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payment/v1/appswitch/kplus"
# Reusing known working token to avoid rate limits
ACCESS_TOKEN="m10Baw51ErXXSfQwexW6srhi77f5"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make K+ Payment Request
echo "--- Step 2: Making K+ Payment Request ---"

curl --location --request POST "$PAYMENT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-paykplus001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-paykplus" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerShopID": "shop001",
  "partnerOrderID": "ORDER000000000001",
  "partnerPaymentID": "PAYMENT0000000001",
  "amount": 100.00,
  "currencyCode": "THB",
  "payoutType": "DELAY",
  "switchBackURL": "https://mpp-kgptest.web.app",
  "sourceOfFundMerchantID": "MERCHANT001",
  "sourceOfFundShopID": "SHOP001"
}'

echo ""
echo "Done."
