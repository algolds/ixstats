#!/bin/bash

# IxStates Development Server Startup Script
# Optimized Next.js 16.3 development server with environment & schema validation

set -e

# Navigate to project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🔧 IxStates Development Server (Next.js 16.3)"
echo "=============================================="

# Ensure build version is generated for development
node ./scripts/write-build-version.js >/dev/null 2>&1 || true

# Helper function to dynamically extract version from package.json without hardcoding
get_pkg_version() {
    local pkg_name="$1"
    local fallback="$2"
    node -p "
        try {
            const pkg = require('./package.json');
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            const ver = (deps['$pkg_name'] || '$fallback');
            ver.replace(/^[\^~]/, '');
        } catch (e) {
            '$fallback';
        }
    " 2>/dev/null || echo "$fallback"
}

# Helper function to extract platform release info from buildVersion.ts
get_platform_info() {
    node -p "
        try {
            const fs = require('fs');
            const content = fs.readFileSync('./src/lib/buildVersion.ts', 'utf8');
            const major = content.match(/major:\s*(\d+)/)?.[1] || '1';
            const minor = content.match(/minor:\s*(\d+)/)?.[1] || '2';
            const patch = content.match(/patch:\s*(\d+)/)?.[1] || '7';
            const release = content.match(/release:\s*\"([^\"]+)\"/)?.[1] || 'Ogma';
            const channel = content.match(/channel:\s*\"([^\"]+)\"/)?.[1] || 'Beta';
            \`v\${major}.\${minor}.\${patch} \"\${release}\" (\${channel})\`;
        } catch (e) {
            'v1.2.7 \"Ogma\" (Beta)';
        }
    " 2>/dev/null || echo "v1.2.7 \"Ogma\" (Beta)"
}

# Load development environment variables
if [ -f ".env.local.dev" ]; then
    echo "📄 Loading development environment variables from .env.local.dev..."
    export NODE_ENV=development
    set -a
    source .env.local.dev 2>/dev/null || true
    set +a
elif [ -f ".env.local" ]; then
    echo "📄 Loading development environment variables from .env.local..."
    export NODE_ENV=development
    set -a
    source .env.local 2>/dev/null || true
    set +a
else
    echo "⚠️  Warning: Neither .env.local.dev nor .env.local file found, using defaults"
    export NODE_ENV=development
fi

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

# Dynamically resolve stack versions
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "v2")
PLATFORM_INFO=$(get_platform_info)
NEXT_VER=$(get_pkg_version "next" "16.3.0")
REACT_VER=$(get_pkg_version "react" "19.2.8")
TAILWIND_VER=$(get_pkg_version "tailwindcss" "4.3.3")
PRISMA_VER=$(get_pkg_version "prisma" "6.19.3")
TRPC_VER=$(get_pkg_version "@trpc/server" "11.18.0")
C15T_VER=$(get_pkg_version "@c15t/backend" "2.2.0")
TS_VER=$(get_pkg_version "typescript" "5.9.3")

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

echo "📦 Platform Stack & Dynamic Versions:"
echo "   Active Branch:   $GIT_BRANCH"
echo "   Platform:        $PLATFORM_INFO"
echo "   Next.js:         v$NEXT_VER (Turbopack, App Router)"
echo "   React:           v$REACT_VER (Server Components)"
echo "   Tailwind CSS:    v$TAILWIND_VER"
echo "   Prisma Client:   v$PRISMA_VER"
echo "   tRPC API:        v$TRPC_VER"
echo "   c15t Backend:    v$C15T_VER"
echo "   TypeScript:      v$TS_VER"

echo ""

# Check if port is available
if ss -tln | grep -q ":$DEVELOPMENT_PORT "; then
    echo "❌ Error: Port $DEVELOPMENT_PORT is already in use"
    echo "   To stop existing service: kill \$(lsof -ti:$DEVELOPMENT_PORT)"
    exit 1
fi

echo "✅ Port $DEVELOPMENT_PORT is available"

# Check PostgreSQL database connection
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]:-5432}"
    DB_NAME="${BASH_REMATCH[5]}"
    echo "✅ PostgreSQL database configured ($DB_NAME @ $DB_HOST:$DB_PORT with PostGIS)"
    (docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT 1;" > /dev/null 2>&1 && \
        echo "   Database connection verified ✓") &
    DB_CHECK_PID=$!
elif [[ "$DATABASE_URL" == postgresql://* ]]; then
    echo "✅ PostgreSQL database configured (with PostGIS support)"
    (docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT 1;" > /dev/null 2>&1 && \
        echo "   Database connection verified ✓") &
    DB_CHECK_PID=$!
else
    echo "⚠️  Warning: DATABASE_URL is not configured for PostgreSQL"
    echo "   Current: $DATABASE_URL"
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

# Wait for DB check to finish before proceeding
if [ -n "$DB_CHECK_PID" ]; then
    wait $DB_CHECK_PID || echo "   ⚠️  Warning: Database connection verification failed"
fi

# Smart DB Schema Sync Optimization
# Only run db:push:force if schema files are newer than our push timestamp stamp file
if [ "${DATABASE_READONLY:-}" != "true" ] && [ "${SKIP_DB_PUSH:-}" != "1" ] && [ "${SKIP_DB_PUSH:-}" != "true" ]; then
    STAMP_FILE=".prisma/.schema-push-stamp"
    mkdir -p .prisma
    
    NEWEST_SCHEMA_TS=0
    for file in prisma/schema/*.prisma; do
        if [ -f "$file" ]; then
            MOD_TS=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo 0)
            if [ "$MOD_TS" -gt "$NEWEST_SCHEMA_TS" ]; then
                NEWEST_SCHEMA_TS=$MOD_TS
            fi
        fi
    done

    STAMP_TS=0
    if [ -f "$STAMP_FILE" ]; then
        STAMP_TS=$(stat -c %Y "$STAMP_FILE" 2>/dev/null || stat -f %m "$STAMP_FILE" 2>/dev/null || echo 0)
    fi

    if [ "$NEWEST_SCHEMA_TS" -gt "$STAMP_TS" ]; then
        echo "🔄 Schema changes detected. Syncing database schema with codebase..."
        if [ -f ".env.local.dev" ]; then
            set -a
            source .env.local.dev 2>/dev/null || true
            set +a
        elif [ -f ".env.local" ]; then
            set -a
            source .env.local 2>/dev/null || true
            set +a
        elif [ -f ".env" ]; then
            set -a
            source .env 2>/dev/null || true
            set +a
        fi
        if bun run db:push:force; then
            touch "$STAMP_FILE"
            echo "   Schema push complete ✓"
        fi
    else
        echo "⚡ Schema unchanged since last push — skipping db:push:force (fast boot)"
    fi
else
    if [ "${SKIP_DB_PUSH:-}" = "1" ] || [ "${SKIP_DB_PUSH:-}" = "true" ]; then
        echo "⚡ Database schema push skipped via SKIP_DB_PUSH"
    fi
fi

# Start the development server
echo ""
echo "🌐 Starting Next.js 16.3 development server..."
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    echo "   Development URL: http://localhost:$DEVELOPMENT_PORT/ (redirects to /maps)"
else
    echo "   Development URL: http://localhost:$DEVELOPMENT_PORT/"
fi
echo "   API Endpoints:   http://localhost:$DEVELOPMENT_PORT/api/*"
echo "   tRPC API:        http://localhost:$DEVELOPMENT_PORT/api/trpc/*"
echo ""
echo "   Features:"
echo "   • Next.js 16.3 Turbopack HMR enabled"
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
echo "   • Cache sizes: reduced for dev"
echo ""

# Start Next.js development server with Turbopack
# Use 'bun run next' instead of 'bunx next' to avoid overhead
exec bun run next dev --port "$DEVELOPMENT_PORT"