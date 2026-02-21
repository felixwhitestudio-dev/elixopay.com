#!/bin/bash

# Configuration
# URL for Payout to Shop (same endpoint, different level/env)
PAYOUT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payout/v1/payout"
# Reusing known working token (generate new one if expired)
ACCESS_TOKEN="OqbvOtPhilH3Jel4rRGzhqhB4PGF"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make Payout to Merchant Request
echo "--- Step 2: Making Payout to Merchant Request ---"

curl --location --request POST "$PAYOUT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-payoutshop002" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-payoutm" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerBatchID": "BatchM001",
  "partnerShopID": "shop001",
  "payoutLevel": "M",
  "payments": [
    {
      "partnerPaymentID": "PAYMENT0000000001",
      "distribution": {
        "shopAmount": 50.00,
        "partners": [
          {
            "partnerID": "Partner0001",
            "amount": 30.00
          },
          {
            "partnerID": "Partner0002",
            "amount": 20.00
          }
        ]
      }
    },
    {
      "partnerPaymentID": "PAYMENT0000000002",
      "distribution": {
        "shopAmount": 100.00
      }
    }
  ]
}'

echo ""
echo "Done."
