#!/bin/bash
# Clear Next.js build cache and restart dev server

echo "🧹 Clearing Next.js build cache..."
rm -rf .next

echo "🗑️  Clearing node modules cache..."
rm -rf node_modules/.cache

echo "✨ Cache cleared successfully!"
echo ""
echo "Now run: npm run dev"
