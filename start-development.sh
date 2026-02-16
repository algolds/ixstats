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
echo "🔄 Using PostgreSQL database from environment"

# Display read-only mode banner if DATABASE_READONLY is set
if [ "$DATABASE_READONLY" = "true" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                   🔒 READ-ONLY DATABASE MODE                      ║"
    echo "╠══════════════════════════════════════════════════════════════════╣"
    echo "║  Connected to production data (82 nations) in read-only mode     ║"
    echo "║  • All database write operations are BLOCKED                     ║"
    echo "║  • User creation disabled (login as existing user)               ║"
    echo "║  • Audit logging to database disabled                            ║"
    echo "║  • db:push, db:migrate, db:reset commands blocked                ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
fi

# Use development port 3000 (3001 is used by Discord bot API, 3002 by IxMaps production, 3003 by IxMaps dev)
DEVELOPMENT_PORT=3000

echo "🔍 Development Environment Summary:"
echo "   NODE_ENV: $NODE_ENV"
if [ "$DATABASE_READONLY" = "true" ]; then
    echo "   Database: 🔒 READ-ONLY (production data: 82 nations)"
else
    echo "   Database: Full access (development mode)"
fi
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
    # Test connection via Docker (uses trust auth for local socket)
    docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT COUNT(*) FROM \"Country\";" > /dev/null 2>&1 && \
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

# Clean stale production build artifacts from .next/ (prevents conflicts with dev server)
if [ -d ".next/server" ] || [ -d ".next/static" ] || [ -f ".next/BUILD_ID" ]; then
    echo "🧹 Cleaning stale production build artifacts from .next/..."
    rm -rf .next/build .next/server .next/static .next/standalone .next/BUILD_ID \
           .next/build-manifest.json .next/app-path-routes-manifest.json \
           .next/export-marker.json .next/images-manifest.json \
           .next/prerender-manifest.json .next/required-server-files.* \
           .next/next-server.js.nft.json .next/next-minimal-server.js.nft.json \
           .next/fallback-build-manifest.json .next/node_modules .next/package.json
    echo "   Stale artifacts removed ✓"
fi

# Start Redis cache for rate limiting and caching
echo "💾 Starting Redis cache server..."
./scripts/setup-redis.sh start
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

# Memory optimization for development server (7.2GB total server RAM)
# --max-old-space-size=4096: 4GB heap. Leaves ~3.2GB for wiki, forum, PostgreSQL, OS.
#   With module graph optimizations (lucide-react manual registry, react-icons tree-shaking),
#   actual usage stays ~1.5-2.5GB. Next.js 16 auto-restarts at 80% (3.2GB).
# --expose-gc: Enable programmatic garbage collection (called by MemoryOptimizer at 65% threshold)
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

echo "   Memory config:"
echo "   • Heap limit: 4GB (--max-old-space-size=4096, Next.js restarts at 80% = 3.2GB)"
echo "   • Proactive GC: enabled (--expose-gc)"
echo "   • Cache sizes: reduced for dev (see dev-memory-config.ts)"
echo ""

# Start Next.js development server with Turbopack (default in Next.js 16, uses incremental compilation)
# Pass --webpack to fall back to Webpack if Turbopack has issues with specific features
exec npx next dev --port "$DEVELOPMENT_PORT"