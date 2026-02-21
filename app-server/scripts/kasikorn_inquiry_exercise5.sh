#!/bin/bash

# Configuration for OAuth
OAUTH_URL="https://openapi-sandbox.kasikornbank.com/v2/oauth/token"
CLIENT_ID="yD9NWASjxFhwopjFuQeWAnudnJSwzGZr"
CLIENT_SECRET="h3fsoFWcLhBfKMCT"

# Configuration for Inquiry
INQUIRY_URL="https://openapi-sandbox.kasikornbank.com/v1/qrpayment/v4/inquiry"
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
echo "Step 2: Inquiry Payment Status (Cancelled)..."
echo "----------------------------------------"

# Generate ISO8601 Timestamp
REQUEST_DT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Prepare JSON Body
# changes: env-id (QR005), partnerTxnUid (PARTNERTEST0003), origPartnerTxnUid (TESTCANCELQR001)
BODY=$(cat <<EOF
{
  "partnerTxnUid": "PARTNERTEST0003",
  "partnerId": "$PARTNER_ID",
  "partnerSecret": "$PARTNER_SECRET",
  "requestDt": "$REQUEST_DT",
  "merchantId": "$MERCHANT_ID",
  "origPartnerTxnUid": "TESTCANCELQR001"
}
EOF
)

echo "Request Body:"
echo $BODY | jq .
echo ""

curl --location --request POST "$INQUIRY_URL" \
--header "Authorization: Bearer $ACCESS_TOKEN" \
--header "Content-Type: application/json" \
--header "x-test-mode: true" \
--header "env-id: QR005" \
--data-raw "$BODY"

echo ""
echo "----------------------------------------"
echo "Done."
