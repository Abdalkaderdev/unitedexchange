#!/bin/bash

API_URL="http://localhost:5000/api"

echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

echo "Login response: $LOGIN_RESPONSE"

# Extract token using grep and sed
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"$//')

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Token obtained"

echo ""
echo "Fetching active shift..."
SHIFT_RESPONSE=$(curl -s "$API_URL/shifts/active" \
  -H "Authorization: Bearer $TOKEN")

echo "Active shift response: $SHIFT_RESPONSE"

# Extract shift UUID
SHIFT_UUID=$(echo $SHIFT_RESPONSE | grep -o '"uuid":"[^"]*"' | head -1 | sed 's/"uuid":"//;s/"$//')

if [ -z "$SHIFT_UUID" ]; then
  echo "No active shift found"
  exit 0
fi

echo "Found active shift: $SHIFT_UUID"

echo ""
echo "Ending shift..."
END_RESPONSE=$(curl -s -X POST "$API_URL/shifts/$SHIFT_UUID/end" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"closingNotes": "Test end shift"}')

echo "End shift response: $END_RESPONSE"
