#!/bin/bash

API_URL="http://localhost:5000/api"

echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"$//')

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi
echo "Logged in successfully"

# Check for active shift
echo ""
echo "Checking for active shift..."
ACTIVE_SHIFT=$(curl -s "$API_URL/shifts/active" -H "Authorization: Bearer $TOKEN")
echo "Active shift: $ACTIVE_SHIFT"

# If no active shift, start one
if echo "$ACTIVE_SHIFT" | grep -q '"data":null'; then
  echo ""
  echo "No active shift. Starting a new shift..."
  START_RESPONSE=$(curl -s -X POST "$API_URL/shifts/start" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"openingNotes": "Test shift from script"}')
  echo "Start shift response: $START_RESPONSE"

  # Get the new shift UUID
  SHIFT_UUID=$(echo $START_RESPONSE | grep -o '"uuid":"[^"]*"' | head -1 | sed 's/"uuid":"//;s/"$//')
else
  SHIFT_UUID=$(echo $ACTIVE_SHIFT | grep -o '"uuid":"[^"]*"' | head -1 | sed 's/"uuid":"//;s/"$//')
fi

if [ -z "$SHIFT_UUID" ]; then
  echo "No shift UUID found"
  exit 1
fi

echo ""
echo "Shift UUID: $SHIFT_UUID"

# Now try to end the shift
echo ""
echo "Ending shift..."
END_RESPONSE=$(curl -s -X POST "$API_URL/shifts/$SHIFT_UUID/end" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"closingNotes": "Test end shift from script"}')

echo "End shift response: $END_RESPONSE"

# Check if successful
if echo "$END_RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "SUCCESS! Shift ended successfully."
else
  echo ""
  echo "FAILED to end shift."
fi
