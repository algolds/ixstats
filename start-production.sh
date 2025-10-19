#!/bin/bash

# IxStats Production Server Startup Script
# Simplified and consolidated production start script

set -e

echo "🚀 Starting IxStats Production Server"
echo "====================================="

# Navigate to project directory
PROJECT_DIR="/ixwiki/public/projects/ixstats"
cd "$PROJECT_DIR"

# Load production environment variables
if [ -f ".env.production" ]; then
    echo "📄 Loading production environment variables..."
    export NODE_ENV=production
    export $(grep -v '^#' .env.production | xargs 2>/dev/null)
else
    echo "❌ Error: .env.production file not found"
    exit 1
fi

# Ensure base path variables are configured for production deployments.
export BASE_PATH="${BASE_PATH:-/projects/ixstats}"
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}"

# Set default port if not specified
PRODUCTION_PORT=${PORT:-3550}

echo "🔍 Environment Summary:"
echo "   NODE_ENV: $NODE_ENV"
echo "   BASE_PATH: $BASE_PATH"
echo "   NEXT_PUBLIC_BASE_PATH: $NEXT_PUBLIC_BASE_PATH"
echo "   Database: $DATABASE_URL"
echo "   Port: $PRODUCTION_PORT"
echo "   MediaWiki URL: $NEXT_PUBLIC_MEDIAWIKI_URL"

# Validate Clerk configuration
echo "🔐 Validating Clerk configuration..."
if npm run auth:validate:prod --silent > /dev/null 2>&1; then
    echo "   Authentication: ✅ Clerk (Production keys validated)"
else
    echo "   Authentication: ⚠️  Clerk keys need attention"
    echo "   Run 'npm run auth:validate:prod' for details"
fi

echo ""

# Check if port is available
if netstat -tlnp 2>/dev/null | grep -q ":$PRODUCTION_PORT "; then
    echo "❌ Error: Port $PRODUCTION_PORT is already in use"
    echo "   To stop existing service: kill \$(lsof -ti:$PRODUCTION_PORT)"
    exit 1
fi

echo "✅ Port $PRODUCTION_PORT is available"
echo ""

# Verify build exists
if [ ! -d ".next" ]; then
    echo "❌ Error: Production build not found. Run 'npm run build' first."
    exit 1
fi

echo "✅ Production build found"
echo ""

# Start the server
echo "🌐 Starting Next.js production server..."
echo "   Local URL:      http://localhost:$PRODUCTION_PORT$BASE_PATH"
echo "   Production URL: https://ixwiki.com$BASE_PATH"
echo ""
echo "   Note: Production URL requires reverse proxy configuration"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start Next.js production server
exec npx next start -p "$PRODUCTION_PORT"
