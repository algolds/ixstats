#!/bin/bash

# Production Build Script for IxStats
# Ensures correct BASE_PATH is set for production deployment

set -e

echo "🚀 Building IxStates for production deployment..."
echo "=============================================="

# Set production environment variables
export NODE_ENV=production
export BASE_PATH="/projects/ixstates"

echo "📋 Build Configuration:"
echo "   NODE_ENV: $NODE_ENV"
echo "   BASE_PATH: $BASE_PATH"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf .next

# Run production build (uses with-base-path.sh wrapper and postbuild standalone asset copy)
echo "🔨 Running production build..."
bun run build

echo ""
echo "✅ Production build completed successfully!"
echo ""
echo "📁 Build artifacts:"
echo "   Static assets:     .next/static/"
echo "   Server files:      .next/server/"
echo "   Standalone build:  .next/standalone/"
echo ""
echo "🌐 Deployment URLs:"
echo "   App URL:        https://ixwiki.com/projects/ixstates"
echo "   Static assets:  https://ixwiki.com/projects/ixstates/_next/static/"
echo ""
echo "🚀 Ready for deployment!"
