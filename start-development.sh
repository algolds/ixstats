#!/bin/bash

# IxStats Development Server Startup Script
# Comprehensive development server with environment validation

set -e

echo "🔧 Starting IxStats Development Server"
echo "======================================"

# Navigate to project directory
PROJECT_DIR="/ixwiki/public/projects/ixstats"
cd "$PROJECT_DIR"

# Load development environment variables
if [ -f ".env.local.dev" ]; then
    echo "📄 Loading development environment variables from .env.local.dev..."
    export NODE_ENV=development
    # Load .env.local.dev variables without overriding existing environment
    set -a
    source .env.local.dev 2>/dev/null || true
    set +a
elif [ -f ".env.local" ]; then
    echo "📄 Loading development environment variables from .env.local..."
    export NODE_ENV=development
    # Load .env.local variables without overriding existing environment
    set -a
    source .env.local 2>/dev/null || true
    set +a
else
    echo "⚠️  Warning: Neither .env.local.dev nor .env.local file found, using defaults"
    export NODE_ENV=development
fi

# Use PostgreSQL database from .env.local.dev (October 2025: migrated from SQLite to PostgreSQL with PostGIS)
# DATABASE_URL is now set from .env.local.dev and should not be overridden
echo "🔄 Using PostgreSQL database from environment: ${DATABASE_URL}"

# Use development port 3000 (3001 is used by Discord bot API, 3002 by IxMaps production, 3003 by IxMaps dev)
DEVELOPMENT_PORT=3000

echo "🔍 Development Environment Summary:"
echo "   NODE_ENV: $NODE_ENV"
echo "   Database: $DATABASE_URL (Development Database)"
echo "   Port: $DEVELOPMENT_PORT"
echo "   Base Path: / (root)"
echo "   MediaWiki URL: ${NEXT_PUBLIC_MEDIAWIKI_URL:-https://ixwiki.com/}"
echo "   IxTime Bot URL: ${IXTIME_BOT_URL:-http://localhost:3001}"

# Check authentication configuration
if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_test_ ]]; then
    echo "   Authentication: ✅ Clerk (Development)"
elif [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_live_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_live_ ]]; then
    echo "   Authentication: ⚠️  Clerk (Production keys in development)"
elif [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] || [ -n "$CLERK_SECRET_KEY" ]; then
    echo "   Authentication: ❌ Clerk (Invalid key format)"
else
    echo "   Authentication: 🎭 Demo Mode (No Clerk keys)"
fi

echo ""

# Check if port is available
if netstat -tlnp 2>/dev/null | grep -q ":$DEVELOPMENT_PORT "; then
    echo "❌ Error: Port $DEVELOPMENT_PORT is already in use"
    echo "   To stop existing service: kill \$(lsof -ti:$DEVELOPMENT_PORT)"
    exit 1
fi

echo "✅ Port $DEVELOPMENT_PORT is available"

# Check PostgreSQL database connection
if [[ "$DATABASE_URL" == postgresql://* ]]; then
    echo "✅ PostgreSQL database configured (with PostGIS support)"
    # Test connection by counting countries
    PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -tAc "SELECT COUNT(*) FROM \"Country\";" > /dev/null 2>&1 && \
        echo "   Database connection verified ✓" || \
        echo "   ⚠️  Warning: Could not verify database connection"
else
    echo "⚠️  Warning: DATABASE_URL is not configured for PostgreSQL"
    echo "   Current: $DATABASE_URL"
    echo "   Expected: postgresql://postgres:postgres@localhost:5433/ixstats"
fi

echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Error: Dependencies not installed. Run 'npm install' first."
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Start the development server
echo "🌐 Starting Next.js development server..."
echo "   Development URL: http://localhost:$DEVELOPMENT_PORT/"
echo "   API Endpoints:   http://localhost:$DEVELOPMENT_PORT/api/*"
echo "   tRPC API:        http://localhost:$DEVELOPMENT_PORT/api/trpc/*"
echo ""
echo "   Features:"
echo "   • Hot reload enabled (Turbopack)"
echo "   • Root path routing (no basePath)"
echo "   • Development database"
if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]]; then
    echo "   • Clerk authentication (test environment)"
elif [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    echo "   • Demo mode (no authentication required)"
else
    echo "   • Clerk authentication (check configuration)"
fi
echo ""
echo "   Press Ctrl+C to stop the server"
echo "   Run 'npm run auth:check:dev' to verify auth configuration"
echo ""

# Start Next.js development server with Turbopack
exec npx next dev --turbo --port "$DEVELOPMENT_PORT"