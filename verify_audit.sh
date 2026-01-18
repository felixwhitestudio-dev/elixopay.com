#!/bin/bash

# 1. Login
echo "Logging in..."
LOGIN_RES=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elixopay.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*"' | head -n 1 | cut -d'"' -f4 | tr -d '\n\r')

if [ -z "$TOKEN" ]; then
  echo "Login failed"
  echo $LOGIN_RES
  exit 1
fi

echo "Login successful. Token acquired."

# 2. Update Settings (Generate Log)
echo "Updating settings to generate audit log..."
UPDATE_RES=$(curl -v -X POST http://127.0.0.1:3000/api/v1/admin/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"withdrawal_fee_thb": "55"}' 2>&1)

echo "Update response: $UPDATE_RES"

# 3. Fetch Audit Logs
echo "Fetching audit logs..."
LOGS_RES=$(curl -v -X GET http://127.0.0.1:3000/api/v1/admin/audit-logs \
  -H "Authorization: Bearer $TOKEN" 2>&1)

# Check if log exists
echo "$LOGS_RES" | grep "UPDATE_SETTINGS" > /dev/null

if [ $? -eq 0 ]; then
  echo "SUCCESS: Found UPDATE_SETTINGS in audit logs."
  echo "Latest Logs snippet:"
  echo "$LOGS_RES" | head -c 1000
else
  echo "FAILURE: UPDATE_SETTINGS not found in audit logs."
  echo "Full response:"
  echo "$LOGS_RES"
fi
