#!/bin/bash

# IxStates Production Server Startup Script
# Simplified and consolidated production start script

set -e

echo "🚀 Starting IxStates Production Server"
echo "====================================="

# Navigate to project directory
PROJECT_DIR="/ixwiki/public/projects/ixstats"
cd "$PROJECT_DIR"

# Load production environment variables
# Load order: .env.production (template) first, then .env.production.local (secrets override)
if [ -f ".env.production" ]; then
    echo "📄 Loading production environment template..."
    export NODE_ENV=production
    export $(grep -v '^#' .env.production | grep -v '^\s*$' | xargs 2>/dev/null)
else
    echo "❌ Error: .env.production file not found"
    exit 1
fi

# Load local secrets (overrides template values)
if [ -f ".env.production.local" ]; then
    echo "🔐 Loading production secrets from .env.production.local..."
    export $(grep -v '^#' .env.production.local | grep -v '^\s*$' | xargs 2>/dev/null)
else
    echo "⚠️  Warning: .env.production.local not found - secrets may be missing"
    echo "   Create it with actual values for CLERK_SECRET_KEY, DATABASE_URL, etc."
fi

# Ensure base path variables are configured for production deployments.
normalize_base_path() {
    local value="$1"

    if [ -z "$value" ]; then
        echo ""
        return
    fi

    if [[ "$value" != /* ]]; then
        value="/$value"
    fi

    if [[ "$value" != "/" ]]; then
        value="${value%/}"
    fi

    echo "$value"
}

if [ -z "${BASE_PATH+x}" ]; then
    BASE_PATH=""
fi

BASE_PATH="$(normalize_base_path "$BASE_PATH")"

if [ -z "${NEXT_PUBLIC_BASE_PATH+x}" ]; then
    NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
fi

NEXT_PUBLIC_BASE_PATH="$(normalize_base_path "$NEXT_PUBLIC_BASE_PATH")"

export BASE_PATH NEXT_PUBLIC_BASE_PATH

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

# Verify build exists
if [ ! -d ".next" ]; then
    echo "❌ Error: Production build not found. Run 'npm run build' first."
    exit 1
fi

echo "✅ Production build found"
echo ""

# Start Redis cache for rate limiting and caching
echo "💾 Starting Redis cache server..."
./scripts/setup-redis.sh start
echo ""

# Start the server
echo "🌐 Starting Next.js production server..."
echo "   Local URL:      http://localhost:$PRODUCTION_PORT$BASE_PATH"
echo "   Production URL: https://ixstates.ixwiki.com$BASE_PATH"
echo ""
echo "   Note: Production URL requires reverse proxy configuration"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start Next.js production server
exec node node_modules/.bin/next start -p "$PRODUCTION_PORT"
