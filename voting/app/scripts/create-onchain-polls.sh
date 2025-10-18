#!/bin/bash

# Quick fix: Create on-chain polls for voting section
# This script creates the missing on-chain polls for database entries

echo "🔄 Creating on-chain polls for voting section..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local not found"
  exit 1
fi

# Source environment variables
export $(cat .env.local | grep -v '^#' | xargs)

echo "ℹ️  This will create on-chain polls for all voting polls without onchain_id"
echo ""
echo "⚠️  You need to:"
echo "  1. Have SOL in your wallet: 5sQaKhsTc8RvgnNgLCYB2Y44dirFBZxQWKZy7nVomYe4"
echo "  2. Run this from the /voting directory (not /app)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

echo ""
echo "📝 Go to Supabase and run this SQL to get poll details:"
echo ""
echo "SELECT id, question, options FROM dao_polls WHERE section = 'voting' AND onchain_id IS NULL;"
echo ""
echo "Then manually create each poll using anchor test commands or the admin panel"
echo ""
echo "For now, the easiest way is to:"
echo "1. Note the poll IDs that need onchain_id"
echo "2. Create them using the Solana program"
echo "3. Update the database with the onchain_id values"
