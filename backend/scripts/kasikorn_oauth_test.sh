#!/bin/bash

# Configuration
URL="https://openapi-sandbox.kasikornbank.com/v2/oauth/token"
CLIENT_ID="zLRJ0ylijnDPiCwZihoHkaj2wMFSRbxs"
CLIENT_SECRET="rdr9KlSe5rApmFjv"

# Step 1: Base64 Encode Credentials
# Note: In a real app, use environment variables.
AUTH_STRING=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64)

echo "Calling Kasikorn OAuth API..."
echo "Client ID: $CLIENT_ID"
echo "Endpoint: $URL"

# Step 2: Call API
curl --location --request POST "$URL" \
--header 'Content-Type: application/x-www-form-urlencoded' \
--header "Authorization: Basic $AUTH_STRING" \
--header 'env-id: OAUTH2' \
--header 'x-test-mode: true' \
--data-urlencode 'grant_type=client_credentials'

echo ""
echo "Done."
