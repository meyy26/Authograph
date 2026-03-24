#!/bin/bash
# HumanMark — Quick Setup Script
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   HumanMark — Document Provenance MVP    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install from https://nodejs.org"
  exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install backend deps
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Check for .env
if [ ! -f "backend/.env" ]; then
  echo ""
  echo "⚙️  Creating .env from template..."
  cp backend/.env.example backend/.env
  echo ""
  echo "════════════════════════════════════════════"
  echo "  ACTION REQUIRED: Set up Hedera credentials"
  echo "════════════════════════════════════════════"
  echo ""
  echo "  1. Go to: https://portal.hedera.com"
  echo "  2. Create a free account"
  echo "  3. Copy your Testnet Account ID and Private Key"
  echo "  4. Edit: backend/.env"
  echo "     HEDERA_ACCOUNT_ID=0.0.YOUR_ID"
  echo "     HEDERA_PRIVATE_KEY=your_key_here"
  echo ""
  echo "  ── OR ── run in demo mode (no Hedera account needed):"
  echo "     Set DEMO_MODE=true in backend/.env"
  echo ""
else
  echo "✅ .env already exists"
fi

echo "════════════════════════════════════════════"
echo ""
echo "🚀 To start: cd backend && npm start"
echo "🌐 Then open: http://localhost:3001"
echo ""
