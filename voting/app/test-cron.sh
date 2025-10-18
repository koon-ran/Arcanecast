#!/bin/bash

# Test script for cron endpoints
# Run this with: bash test-cron.sh [endpoint]

CRON_SECRET="+4POpZLg5ljQ6DhEH4unOAGDh/pKsjswdiRxQoF4nik="
BASE_URL="http://localhost:3000"

echo "🧪 Testing Cron Endpoints"
echo "=========================="
echo ""

if [ "$1" == "promote" ] || [ -z "$1" ]; then
  echo "📊 Testing promote-polls endpoint..."
  echo "Expected: Promotes top 5 nominated polls to voting"
  echo ""
  curl -X GET "${BASE_URL}/api/cron/promote-polls" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\n\nStatus: %{http_code}\n" \
    -s | jq '.'
  echo ""
  echo "---"
  echo ""
fi

if [ "$1" == "reveal" ] || [ -z "$1" ]; then
  echo "🔓 Testing auto-reveal endpoint..."
  echo "Expected: Reveals completed polls past deadline"
  echo ""
  curl -X GET "${BASE_URL}/api/cron/auto-reveal" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\n\nStatus: %{http_code}\n" \
    -s | jq '.'
  echo ""
  echo "---"
  echo ""
fi

if [ "$1" == "archive" ] || [ -z "$1" ]; then
  echo "🗄️  Testing archive-nominations endpoint..."
  echo "Expected: Archives nominations older than 30 days"
  echo ""
  curl -X GET "${BASE_URL}/api/cron/archive-nominations" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\n\nStatus: %{http_code}\n" \
    -s | jq '.'
  echo ""
  echo "---"
  echo ""
fi

echo "✅ Testing complete!"
echo ""
echo "Usage:"
echo "  bash test-cron.sh           # Test all endpoints"
echo "  bash test-cron.sh promote   # Test promote-polls only"
echo "  bash test-cron.sh reveal    # Test auto-reveal only"
echo "  bash test-cron.sh archive   # Test archive-nominations only"
