#!/bin/bash
# Test backend endpoints after deployment

SERVER="${1:-http://45.76.161.48}"
ADMIN_EMAIL="${2:-admin@elixopay.com}"
ADMIN_PASS="${3:-Admin123!@#}"

echo "🧪 Testing Elixopay Backend"
echo "Server: $SERVER"
echo "================================"
echo ""

# Test 1: Health check
echo "✅ Test 1: Health Check"
curl -s "$SERVER/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: CORS preflight
echo "✅ Test 2: CORS Preflight (OPTIONS)"
curl -X OPTIONS "$SERVER/api/v1/auth/login" \
  -H "Origin: https://elixopay.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i -s | head -20
echo ""

# Test 3: Login
echo "✅ Test 3: Login"
RESPONSE=$(curl -X POST "$SERVER/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://elixopay.com" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  -c /tmp/cookies.txt \
  -s)

echo "$RESPONSE" | jq '.'

# Extract token for next test
TOKEN=$(echo "$RESPONSE" | jq -r '.data.token // empty')
echo ""

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token received"
  exit 1
fi

echo "✅ Token received"
echo ""

# Test 4: Dashboard (with cookie)
echo "✅ Test 4: Dashboard Endpoint"
curl "$SERVER/api/v1/dashboard" \
  -b /tmp/cookies.txt \
  -s | jq '.'
echo ""

# Test 5: Sessions list
echo "✅ Test 5: List Sessions"
curl "$SERVER/api/v1/auth/sessions" \
  -b /tmp/cookies.txt \
  -s | jq '.data.sessions | length'
echo " active sessions"
echo ""

echo "================================"
echo "✅ All tests completed!"
echo ""
echo "Manual browser test:"
echo "1. Open https://elixopay.com/login.html"
echo "2. Login with: $ADMIN_EMAIL / $ADMIN_PASS"
echo "3. Check DevTools → Network for:"
echo "   - Set-Cookie headers (access_token, refresh_token, csrf_token)"
echo "   - Access-Control-Allow-Origin: https://elixopay.com"
echo "4. Should redirect to /admin-dashboard.html"
