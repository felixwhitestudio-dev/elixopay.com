#!/bin/bash

# Generates a random fee between 10-99 to make the test unique
RANDOM_FEE=$((10 + RANDOM % 90))

echo "========================================"
echo "   ELIXOPAY LIVE SYSTEM TEST (CLI)   "
echo "========================================"
echo "1. Authenticating as Admin..."
LOGIN_RES=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elixopay.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*"' | head -n 1 | cut -d'"' -f4 | tr -d '\n\r')

if [ -z "$TOKEN" ]; then
  echo "❌ Login Failed"
  exit 1
fi
echo "✅ Login Successful"

echo "----------------------------------------"
echo "2. Updating System Settings..."
echo "   -> Setting 'withdrawal_fee_thb' to $RANDOM_FEE THB"

UPDATE_RES=$(curl -s -X POST http://127.0.0.1:3000/api/v1/admin/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"withdrawal_fee_thb\": \"$RANDOM_FEE\"}")

# Simply check if response contains success:true
if [[ $UPDATE_RES == *"true"* ]]; then
    echo "✅ Settings Updated"
else
    echo "❌ Update Failed: $UPDATE_RES"
fi

echo "----------------------------------------"
echo "3. Verifying Audit Logs..."
LOGS_RES=$(curl -s -X GET http://127.0.0.1:3000/api/v1/admin/audit-logs \
  -H "Authorization: Bearer $TOKEN")

# Verify the log contains the random fee we just set
if [[ $LOGS_RES == *"$RANDOM_FEE"* ]] && [[ $LOGS_RES == *"UPDATE_SETTINGS"* ]]; then
    echo "✅ Audit Log Found: UPDATE_SETTINGS"
    echo "   -> Details verified: Fee changed to $RANDOM_FEE"
else
    echo "❌ Audit Log NOT Found or Incorrect"
    echo "   (Checked for fee: $RANDOM_FEE in logs)"
fi

echo "========================================"
echo "   TEST COMPLETE "
echo "========================================"
