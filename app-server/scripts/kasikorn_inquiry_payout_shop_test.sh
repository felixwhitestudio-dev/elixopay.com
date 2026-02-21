#!/bin/bash

# Configuration
# URL for Inquiry Payout to Shop
INQUIRY_PAYOUT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payout/v1/inquiry"
# Reusing known working token (generate new one if expired)
ACCESS_TOKEN="OqbvOtPhilH3Jel4rRGzhqhB4PGF"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make Inquiry Payout to Shop Request
echo "--- Step 2: Making Inquiry Payout to Shop Request ---"

curl --location --request POST "$INQUIRY_PAYOUT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-inqoutshop001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-inquirypayout" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerBatchID": "BatchS001"
}'

echo ""
echo "Done."
