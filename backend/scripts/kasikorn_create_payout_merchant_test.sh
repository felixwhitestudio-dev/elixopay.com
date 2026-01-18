#!/bin/bash

# Configuration
# URL for Create Payout to Merchant
PAYOUT_MERCHANT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payout/v1/payout-merchant"
# Reusing known working token (generate new one if expired)
ACCESS_TOKEN="OqbvOtPhilH3Jel4rRGzhqhB4PGF"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make Create Payout to Merchant Request
echo "--- Step 2: Making Create Payout to Merchant Request ---"

curl --location --request POST "$PAYOUT_MERCHANT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-payoutmerc001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-payoutmerchant" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerPayoutMerchantID": "MerchantBatch001",
  "partnerMerchantID": "merchant001",
  "payouts": [
    "BatchM001"
  ]
}'

echo ""
echo "Done."
