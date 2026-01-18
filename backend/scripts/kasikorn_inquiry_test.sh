#!/bin/bash

# Configuration
# URL for Inquiry Payment
INQUIRY_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payment/v1/inquiry"
# Reusing known working token (generate new one if expired)
ACCESS_TOKEN="OqbvOtPhilH3Jel4rRGzhqhB4PGF"

echo "Using Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make Inquiry Request
echo "--- Step 2: Making Inquiry Request ---"

curl --location --request POST "$INQUIRY_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-inqpayment001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-inquirypayment" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerPaymentID": "PAYMENTQR00000001"
}'

echo ""
echo "Done."
