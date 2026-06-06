#!/bin/bash
# Run this script after you have Node.js installed.
# Opens Expo so you can use Expo Go on your phone (scan the QR code).

cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo "Node.js is not installed."
  echo "Install it from https://nodejs.org (download the LTS version), then run this script again."
  exit 1
fi

echo "Installing dependencies..."
npm install

echo ""
echo "Starting Expo for Expo Go..."
echo "  → Install 'Expo Go' on your phone (App Store / Play Store)"
echo "  → Scan the QR code that appears below with your phone camera (iOS) or inside Expo Go (Android)"
echo ""
npx expo start --tunnel
