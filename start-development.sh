#!/bin/bash

# IxStates Development Server Startup Script
# Comprehensive development server with environment validation

set -e

echo "🔧 Starting IxStates Development Server"
echo "======================================"

# Navigate to project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Set port based on standalone maps mode
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    # Default to 3003 for maps dev (3002 is production maps)
    DEVELOPMENT_PORT=${PORT:-3003}
else
    # Default to 3000 for regular dev
    DEVELOPMENT_PORT=${PORT:-3000}
fi

echo "🔍 Development Environment Summary:"
echo "   NODE_ENV: $NODE_ENV"
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    echo "   Mode:     🗺️  IxWorld Standalone Maps Mode (maps-only)"
else
    echo "   Mode:     Full Application (IxStates)"
fi
if [ "$DATABASE_READONLY" = "true" ]; then
    echo "   Database: 🔒 READ-ONLY (production data: 82 nations)"
else
    echo "   Database: Full access (development mode)"
fi
echo "   Port: $DEVELOPMENT_PORT"
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    echo "   Base Path: /maps (redirected root)"
else
    echo "   Base Path: / (root)"
fi
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

echo "📦 Platform Stack & Versions:"
echo "   Active Branch:   v2"
echo "   Next.js:         v16.2.6 (Turbopack)"
echo "   React:           v19.2.6"
echo "   Tailwind CSS:    v4.3.0"
echo "   Prisma Client:   v6.19.3"
echo "   tRPC API:        v11.17.0"
echo "   c15t Backend:    v2.1.0"

echo ""

# Check if port is available
if ss -tln | grep -q ":$DEVELOPMENT_PORT "; then
    echo "❌ Error: Port $DEVELOPMENT_PORT is already in use"
    echo "   To stop existing service: kill \$(lsof -ti:$DEVELOPMENT_PORT)"
    exit 1
fi

echo "✅ Port $DEVELOPMENT_PORT is available"

# Check PostgreSQL database connection
if [[ "$DATABASE_URL" == postgresql://* ]]; then
    echo "✅ PostgreSQL database configured (with PostGIS support)"
    # Test connection via Docker (uses trust auth for local socket) - Backgrounded for speed
    (docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT 1;" > /dev/null 2>&1 && \
        echo "   Database connection verified ✓") &
    DB_CHECK_PID=$!
else
    echo "⚠️  Warning: DATABASE_URL is not configured for PostgreSQL"
    echo "   Current: $DATABASE_URL"
    echo "   Expected: postgresql://postgres:postgres@localhost:5433/ixstats"
fi

echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Error: Dependencies not installed. Run 'bun install' first."
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Clean stale production build artifacts from .next/ (prevents conflicts with dev server)
# Optimized cleanup: removes all except cache to preserve incremental compilation
if [ -d ".next" ]; then
    echo "🧹 Cleaning stale production build artifacts from .next/..."
    find .next -mindepth 1 -maxdepth 1 ! -name 'cache' -exec rm -rf {} +
    echo "   Stale artifacts removed ✓"
fi

# Restore uploaded images from backup in development
if [ -d "public/images/uploads_backup" ]; then
    echo "🖼️  Restoring uploaded images from backup to public/images/uploads/..."
    mkdir -p public/images/uploads
    cp -n public/images/uploads_backup/* public/images/uploads/ 2>/dev/null || true
    echo "   Uploaded images restored ✓"
fi


# Start Redis cache in background to avoid blocking
echo "💾 Starting Redis cache server (background)..."
./scripts/setup-redis.sh start > /dev/null 2>&1 &
REDIS_PID=$!
echo ""

# Start the development server
echo "🌐 Starting Next.js development server..."
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    echo "   Development URL: http://localhost:$DEVELOPMENT_PORT/ (redirects to /maps)"
else
    echo "   Development URL: http://localhost:$DEVELOPMENT_PORT/"
fi
echo "   API Endpoints:   http://localhost:$DEVELOPMENT_PORT/api/*"
echo "   tRPC API:        http://localhost:$DEVELOPMENT_PORT/api/trpc/*"
echo ""
echo "   Features:"
echo "   • Hot reload enabled (Turbopack)"
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    echo "   • Standalone Maps Mode active (empty basePath)"
else
    echo "   • Root path routing (no basePath)"
fi
echo "   • Development database"
if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]]; then
    echo "   • Clerk authentication (test environment)"
elif [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    echo "   • Demo mode (no authentication required)"
else
    echo "   • Clerk authentication (check configuration)"
fi
echo "   • c15t Self-Hosted Consent Engine (active at /api/c15t)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo "   Run 'bun run auth:check:dev' to verify auth configuration"
echo ""

# Memory optimization for development server (7.2GB total server RAM)
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

echo "   Memory config:"
echo "   • Heap limit: 4GB (--max-old-space-size=4096, Next.js restarts at 80% = 3.2GB)"
echo "   • Proactive GC: enabled (--expose-gc)"
echo "   • Cache sizes: reduced for dev (see dev-memory-config.ts)"
echo ""

# Wait for DB check to finish before starting (safety first, but it's been running in background)
if [ -n "$DB_CHECK_PID" ]; then
    wait $DB_CHECK_PID || echo "   ⚠️  Warning: Database connection verification failed"
fi

if [ "${DATABASE_READONLY:-}" != "true" ]; then
    echo "🔄 Syncing database schema with codebase..."
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi
    bun run db:push:force
fi

# Start Next.js development server with Turbopack
# Use 'bun run next' instead of 'bunx next' to avoid overhead
exec bun run next dev --port "$DEVELOPMENT_PORT"