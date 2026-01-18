#!/bin/bash
set -e

TIMESTAMP=$(date +%s)
SENDER_EMAIL="sender_${TIMESTAMP}@test.com"
RECEIVER_EMAIL="receiver_${TIMESTAMP}@test.com"
PASSWORD="password123"

echo "1. Registering Sender: $SENDER_EMAIL"
REGISTER_RES=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SENDER_EMAIL\", \"password\":\"$PASSWORD\", \"firstName\":\"Sender\", \"lastName\":\"One\"}")

TOKEN=$(echo $REGISTER_RES | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ "$TOKEN" == "None" ] || [ -z "$TOKEN" ]; then
  echo "Failed to register sender"
  echo $REGISTER_RES
  exit 1
fi
echo "Sender Token: Is Set"

echo "\n2. Initial Wallet Check (Should be 0)"
WALLET_RES=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/users/wallet)
echo "Raw Wallet Response: $WALLET_RES"
echo $WALLET_RES | python3 -c "import sys, json; print('Balance:', json.load(sys.stdin)['data']['wallet']['balance'])"

echo "\n3. Depositing 1000 THB"
curl -s -X POST http://localhost:3000/api/v1/users/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 1000, "reference": "INIT_DEP"}' > /dev/null

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/users/wallet | python3 -c "import sys, json; print('Balance after deposit:', json.load(sys.stdin)['data']['wallet']['balance'])"

echo "\n4. Dispersing (Transferring) 250 THB to Receiver: $RECEIVER_EMAIL"
# Note: Transfer endpoint takes email, so we need to register receiver first if logic requires it, 
# BUT my transfer logic checks if receiver exists. So I MUST register receiver first.

echo "   - Registering Receiver..."
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RECEIVER_EMAIL\", \"password\":\"$PASSWORD\", \"firstName\":\"Receiver\", \"lastName\":\"Two\"}" > /dev/null

echo "   - Sending Transfer..."
TRANSFER_RES=$(curl -s -X POST http://localhost:3000/api/v1/users/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"email\":\"$RECEIVER_EMAIL\", \"amount\": 250}")

echo $TRANSFER_RES | grep "success" > /dev/null && echo "Transfer Successful" || echo "Transfer Failed: $TRANSFER_RES"

echo "\n5. Verifying Sender Balance (Should be 750)"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/users/wallet | python3 -c "import sys, json; print('Balance before withdraw:', json.load(sys.stdin)['data']['wallet']['balance'])"

echo "\n6. Withdrawing 250 THB"
WITHDRAW_RES=$(curl -s -X POST http://localhost:3000/api/v1/users/wallet/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 250, "bankName": "KBank", "accountNumber": "1234567890"}')

echo $WITHDRAW_RES | grep "success" > /dev/null && echo "Withdrawal Successful" || echo "Withdrawal Failed: $WITHDRAW_RES"

echo "\n7. Verifying Sender Balance (Should be 500)"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/users/wallet | python3 -c "import sys, json; print('Final Balance:', json.load(sys.stdin)['data']['wallet']['balance'])"
