#!/bin/bash

# Configuration for OAuth
OAUTH_URL="https://openapi-sandbox.kasikornbank.com/v2/oauth/token"
CLIENT_ID="yD9NWASjxFhwopjFuQeWAnudnJSwzGZr"
CLIENT_SECRET="h3fsoFWcLhBfKMCT"

# Configuration for QR
QR_URL="https://openapi-sandbox.kasikornbank.com/v1/qrpayment/request"
PARTNER_ID="PTR1051673"
PARTNER_SECRET="d4bded59200547bc85903574a293831b"
MERCHANT_ID="KB102057149704"

echo "----------------------------------------"
echo "Step 1: Getting Access Token..."
echo "----------------------------------------"

AUTH_STRING=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64)

TOKEN_RESPONSE=$(curl --silent --location --request POST "$OAUTH_URL" \
--header 'Content-Type: application/x-www-form-urlencoded' \
--header "Authorization: Basic $AUTH_STRING" \
--header 'env-id: OAUTH2' \
--header 'x-test-mode: true' \
--data-urlencode 'grant_type=client_credentials')

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "Error getting access token:"
    echo $TOKEN_RESPONSE
    exit 1
fi

echo "Access Token received: $ACCESS_TOKEN"
echo ""

echo "----------------------------------------"
echo "Step 2: Generating QR Credit Card..."
echo "----------------------------------------"

# Generate ISO8601 Timestamp
REQUEST_DT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Prepare JSON Body
# changes: partnerTxnUid, qrType (4), env-id (QR003)
BODY=$(cat <<EOF
{
  "partnerTxnUid": "PARTNERTEST0001-2",
  "partnerId": "$PARTNER_ID",
  "partnerSecret": "$PARTNER_SECRET",
  "requestDt": "$REQUEST_DT",
  "merchantId": "$MERCHANT_ID",
  "qrType": "4",
  "txnAmount": 100.00,
  "txnCurrencyCode": "THB",
  "reference1": "INV001",
  "reference2": "HELLOWORLD",
  "reference3": "INV001",
  "reference4": "INV001",
  "metadata": ""
}
EOF
)

echo "Request Body:"
echo $BODY | jq .
echo ""

curl --location --request POST "$QR_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "x-test-mode: true" \
--header "env-id: QR003" \
--data-raw "$BODY"

echo ""
echo "----------------------------------------"
echo "Done."
