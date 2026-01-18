#!/bin/bash
set -e

# Base URL - update if different
API_URL="http://localhost:3000/api/v1"

# 1. Register User
TIMESTAMP=$(date +%s)
EMAIL="exchange_${TIMESTAMP}@test.com"
PASSWORD="password123"

echo "1. Registering User: $EMAIL"
REGISTER_RES=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\", \"firstName\":\"Exchange\", \"lastName\":\"Tester\"}")

TOKEN=$(echo $REGISTER_RES | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
  echo "Failed to register/login"
  echo $REGISTER_RES
  exit 1
fi

echo "Token received."

# 2. Deposit THB
echo "\n2. Depositing 5000 THB"
curl -s -X POST $API_URL/users/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 5000, "reference": "INIT_DEP"}' > /dev/null

# 3. Get Exchange Rate
echo "\n3. Fetching Exchange Rate"
RATE_RES=$(curl -s -H "Authorization: Bearer $TOKEN" $API_URL/users/wallet/exchange/rate)
# echo "Rate Response: $RATE_RES"
BUY_RATE=$(echo $RATE_RES | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['buy'])")
SELL_RATE=$(echo $RATE_RES | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['sell'])")
echo "Buy Rate (THB->USDT): $BUY_RATE"
echo "Sell Rate (USDT->THB): $SELL_RATE"

# 4. Buy USDT (Swap 3500 THB)
echo "\n4. Buying USDT with 3500 THB..."
BUY_RES=$(curl -s -X POST $API_URL/users/wallet/exchange/swap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "BUY", "amount": 3500}')

# Validate
echo $BUY_RES | grep "success" > /dev/null && echo "Buy Successful" || echo "Buy Failed: $BUY_RES"

# Check Balance
echo "\n   Checking Balance after BUY..."
WALLET_RES=$(curl -s -H "Authorization: Bearer $TOKEN" $API_URL/users/wallet)
echo $WALLET_RES | python3 -c "import sys, json; wallet=json.load(sys.stdin)['data']['wallet']; print(f\"THB: {wallet['balance']}, USDT: {wallet['usdtBalance']}\")"

# 5. Sell USDT (Swap 50 USDT)
echo "\n5. Selling 50 USDT..."
SELL_RES=$(curl -s -X POST $API_URL/users/wallet/exchange/swap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "SELL", "amount": 50}')

# Validate
echo $SELL_RES | grep "success" > /dev/null && echo "Sell Successful" || echo "Sell Failed: $SELL_RES"

# Check Final Balance
echo "\n   Checking Final Balance..."
WALLET_RES=$(curl -s -H "Authorization: Bearer $TOKEN" $API_URL/users/wallet)
echo $WALLET_RES | python3 -c "import sys, json; wallet=json.load(sys.stdin)['data']['wallet']; print(f\"THB: {wallet['balance']}, USDT: {wallet['usdtBalance']}\")"
