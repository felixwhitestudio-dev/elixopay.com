#!/bin/bash

# Configuration
OAUTH_URL="https://openapi-sandbox.kasikornbank.com/v2/oauth/token"
PAYMENT_URL="https://openapi-sandbox.kasikornbank.com/v1/mpp/payment/v1/card/charge"
CLIENT_ID="zLRJ0ylijnDPiCwZihoHkaj2wMFSRbxs"
CLIENT_SECRET="rdr9KlSe5rApmFjv"

# Step 1: Get Access Token
# Skipped to avoid rate limit
ACCESS_TOKEN="m10Baw51ErXXSfQwexW6srhi77f5"

# AUTH_STRING=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64)
# 
# echo "--- Step 1: Requesting Access Token ---"
# TOKEN_RESPONSE=$(curl -s --location --request POST "$OAUTH_URL" \
# --header 'Content-Type: application/x-www-form-urlencoded' \
# --header "Authorization: Basic $AUTH_STRING" \
# --header 'env-id: OAUTH2' \
# --header 'x-test-mode: true' \
# --data-urlencode 'grant_type=client_credentials')
# 
# # Extract access token using grep and cut (simple parsing)
# # Response format: {"... "access_token":"VALUE", ...}
# ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
# 
# if [ -z "$ACCESS_TOKEN" ]; then
#   echo "Error: Failed to retrieve access token."
#   echo "Response: $TOKEN_RESPONSE"
#   exit 1
# fi

echo "Using Hardcoded Access Token: $ACCESS_TOKEN"
echo ""

# Step 2: Make Payment Request
echo "--- Step 2: Making Payment Request ---"

curl --location --request POST "$PAYMENT_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "RequestID: req-paycard001" \
--header "PartnerID: 0001" \
--header "ProjectID: 999" \
--header "ProjectKey: d4bded59200547bc85903574a293831b" \
--header "env-id: mpp-paycard" \
--header "x-test-mode: true" \
--data-raw '{
  "partnerShopID": "shop001",
  "partnerOrderID": "ORDER000000000001",
  "partnerPaymentID": "PAYMENT0000000001",
  "amount": 100.00,
  "currencyCode": "THB",
  "payoutType": "DELAY",
  "mode": "TOKEN",
  "token": "tokn_prod_12345678",
  "saveCard": {
    "name": "test",
    "email": "test@test.com"
  },
  "saveFlag": true,
  "threeDSFlag": true,
  "switchBackURL": "https://mpp-kgptest.web.app",
  "sourceOfFundMerchantID": "MERCHANT001",
  "sourceOfFundShopID": "SHOP001"
}'

echo ""
echo "Done."
