#!/bin/bash

# ==============================================================================
#  IxStates (IxStats) Development Engine
#  Optimized Next.js App Router + Turbopack Development Server
# ==============================================================================

set -e

# Navigate to project root
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ANSI Color Palette 
ESC="\033"
RESET="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"
CYAN="${ESC}[38;2;6;182;212m"       # Cyan 500
EMERALD="${ESC}[38;2;16;185;129m"   # Emerald 500
AMBER="${ESC}[38;2;245;158;11m"     # Amber 500
PURPLE="${ESC}[38;2;168;85;247m"    # Purple 500
RED="${ESC}[38;2;239;68;68m"        # Red 500
SLATE="${ESC}[38;2;148;163;184m"    # Slate 400
LINE="${ESC}[38;2;51;65;85m"        # Slate 700

# ------------------------------------------------------------------------------
# 1. Environment Loading & Normalization
# ------------------------------------------------------------------------------
export NODE_ENV="development"

ENV_SOURCE="defaults"
if [ -f ".env.local.dev" ]; then
    ENV_SOURCE=".env.local.dev"
    set -a
    # shellcheck disable=SC1091
    source .env.local.dev 2>/dev/null || true
    set +a
elif [ -f ".env.local" ]; then
    ENV_SOURCE=".env.local"
    set -a
    # shellcheck disable=SC1091
    source .env.local 2>/dev/null || true
    set +a
elif [ -f ".env" ]; then
    ENV_SOURCE=".env"
    set -a
    # shellcheck disable=SC1091
    source .env 2>/dev/null || true
    set +a
fi

# Determine development port
if [ "$NEXT_PUBLIC_IXWORLD_STANDALONE" = "true" ]; then
    DEVELOPMENT_PORT="${PORT:-3003}"
    APP_MODE="IxMaps"
    BASE_PATH_LABEL="/maps (redirected root)"
else
    DEVELOPMENT_PORT="${PORT:-3000}"
    APP_MODE="IxStates "
    BASE_PATH_LABEL="/ (root)"
fi

# Ensure build version is generated for development
bun ./scripts/write-build-version.js >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# 2. Dynamic Platform & Package Metadata Resolution (Single Batch Sub-10ms)
# ------------------------------------------------------------------------------
eval "$(bun -e '
const fs = require("fs");
try {
    const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const cleanVer = (v, fb) => (v || fb || "").replace(/^[\^~]/, "");

    let platform = "v1.4.0 \"Ogma\" (Release Candidate)";
    if (fs.existsSync("./src/lib/buildVersion.ts")) {
        const bv = fs.readFileSync("./src/lib/buildVersion.ts", "utf8");
        const major = bv.match(/major:\s*(\d+)/)?.[1] || "1";
        const minor = bv.match(/minor:\s*(\d+)/)?.[1] || "4";
        const patch = bv.match(/patch:\s*(\d+)/)?.[1] || "0";
        const release = bv.match(/release:\s*"([^"]+)"/)?.[1] || "Ogma";
        const channel = bv.match(/channel:\s*"([^"]+)"/)?.[1] || "Release Candidate";
        platform = `v${major}.${minor}.${patch} "${release}" (${channel})`;
    }

    console.log(`NEXT_VER="${cleanVer(deps["next"], "16.3.0")}"`);
    console.log(`REACT_VER="${cleanVer(deps["react"], "19.2.8")}"`);
    console.log(`TAILWIND_VER="${cleanVer(deps["tailwindcss"], "4.3.3")}"`);
    console.log(`PRISMA_VER="${cleanVer(deps["prisma"], "6.19.3")}"`);
    console.log(`TRPC_VER="${cleanVer(deps["@trpc/server"], "11.18.0")}"`);
    console.log(`C15T_VER="${cleanVer(deps["@c15t/backend"], "2.2.0")}"`);
    console.log(`TS_VER="${cleanVer(deps["typescript"], "7.0.0")}"`);
    console.log(`PLATFORM_INFO="${platform}"`);
} catch (e) {
    console.log("NEXT_VER=\"16.3.0\"");
    console.log("REACT_VER=\"19.2.8\"");
    console.log("TAILWIND_VER=\"4.3.3\"");
    console.log("PRISMA_VER=\"6.19.3\"");
    console.log("TRPC_VER=\"11.18.0\"");
    console.log("C15T_VER=\"2.2.0\"");
    console.log("TS_VER=\"7.0.0\"");
    console.log("PLATFORM_INFO=\"v1.4.0 \\\"Ogma\\\" (Release Candidate)\"");
}
' 2>/dev/null || echo 'NEXT_VER="16.3.0" REACT_VER="19.2.8" TS_VER="7.0.0" PLATFORM_INFO="v1.4.0 \"Ogma\""')"

BUN_VER=$(bun --version 2>/dev/null || echo "1.4.0")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "development")
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "HEAD")

# ------------------------------------------------------------------------------
# 3. Header Presentation
# ------------------------------------------------------------------------------
echo ""
echo -e "${CYAN}${BOLD}┌──────────────────────────────────────────────────────────────────────────┐${RESET}"
echo -e "${CYAN}${BOLD}│${RESET}  ${BOLD}IxStates Development Engine${RESET}  ${DIM}·${RESET}  ${SLATE}Next.js ${NEXT_VER} (Turbopack)${RESET}              ${CYAN}${BOLD}│${RESET}"
echo -e "${CYAN}${BOLD}│${RESET}  ${DIM}Platform:${RESET} ${EMERALD}${PLATFORM_INFO}${RESET} ${DIM}[${GIT_BRANCH}@${GIT_HASH}]${RESET}                              ${CYAN}${BOLD}│${RESET}"
echo -e "${CYAN}${BOLD}└──────────────────────────────────────────────────────────────────────────┘${RESET}"
echo ""

# Read-Only Database Mode Alert
if [ "$DATABASE_READONLY" = "true" ]; then
    echo -e "${AMBER}╔══════════════════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${AMBER}║${RESET}  ${BOLD}🔒 READ-ONLY DATABASE MODE ACTIVE${RESET}                                       ${AMBER}║${RESET}"
    echo -e "${AMBER}║${RESET}  ${SLATE}• Connected to production data (82 nations) in read-only mode${RESET}          ${AMBER}║${RESET}"
    echo -e "${AMBER}║${RESET}  ${SLATE}• All database mutations, user creation, and audit writes are blocked${RESET}   ${AMBER}║${RESET}"
    echo -e "${AMBER}╚══════════════════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
fi

# ------------------------------------------------------------------------------
# 4. Port Availability & Dependency Checks
# ------------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ Error: Dependencies not installed.${RESET} Run ${CYAN}bun install${RESET} first."
    exit 1
fi

# Check port conflict with intelligent diagnostics
if ss -tln 2>/dev/null | grep -q ":${DEVELOPMENT_PORT} "; then
    OCCUPIER_PID=$(lsof -ti:"${DEVELOPMENT_PORT}" 2>/dev/null | head -n 1 || echo "")
    OCCUPIER_CMD=""
    if [ -n "$OCCUPIER_PID" ]; then
        OCCUPIER_CMD=$(ps -p "$OCCUPIER_PID" -o comm= 2>/dev/null || echo "")
    fi

    echo -e "${RED}❌ Error: Port ${DEVELOPMENT_PORT} is already in use.${RESET}"
    if [ -n "$OCCUPIER_PID" ]; then
        echo -e "   Occupied by: ${AMBER}${OCCUPIER_CMD:-process} (PID: ${OCCUPIER_PID})${RESET}"
        echo -e "   To free this port: ${CYAN}kill -9 ${OCCUPIER_PID}${RESET}"
    fi
    exit 1
fi

# ------------------------------------------------------------------------------
# 5. Database & Service Diagnostics
# ------------------------------------------------------------------------------
# Parse PostgreSQL connection details
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]:-5432}"
    DB_NAME="${BASH_REMATCH[5]}"
    DB_STATUS_LABEL="${DB_NAME} @ ${DB_HOST}:${DB_PORT} (User: ${DB_USER})"
elif [[ "$DATABASE_URL" == postgresql://* ]]; then
    DB_STATUS_LABEL="PostgreSQL + PostGIS (${DATABASE_URL%%\?*})"
else
    DB_STATUS_LABEL="Custom / Unknown (${DATABASE_URL:-not set})"
fi

# Start Redis cache in background
./scripts/setup-redis.sh start > /dev/null 2>&1 &

# Resolve Auth Status
if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_test_ ]]; then
    AUTH_LABEL="${EMERALD}Clerk (Development Test Keys)${RESET}"
elif [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_live_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_live_ ]]; then
    AUTH_LABEL="${AMBER}Clerk (⚠️ Production Keys in Dev)${RESET}"
elif [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] || [ -n "$CLERK_SECRET_KEY" ]; then
    AUTH_LABEL="${RED}Clerk (Invalid Key Configuration)${RESET}"
else
    AUTH_LABEL="${SLATE}🎭 Demo Mode (Auth Bypassed)${RESET}"
fi

# ------------------------------------------------------------------------------
# 6. Cache Hygiene & Stale Build Artifacts Purge
# ------------------------------------------------------------------------------
# Clean stale production build artifacts from .next/ while preserving incremental compiler cache
if [ -d ".next" ]; then
    find .next -mindepth 1 -maxdepth 1 ! -name 'cache' -exec rm -rf {} + 2>/dev/null || true
fi

# Restore uploaded demo images if backup exists
if [ -d "public/images/uploads_backup" ]; then
    mkdir -p public/images/uploads
    cp -n public/images/uploads_backup/* public/images/uploads/ 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 7. Smart Prisma Schema Synchronization
# ------------------------------------------------------------------------------
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
        echo -e "${CYAN}🔄 Schema modification detected.${RESET} Syncing database schema..."
        if bun run db:push:force; then
            touch "$STAMP_FILE"
            echo -e "   ${EMERALD}✓ Schema synchronized successfully${RESET}"
        fi
    fi
fi

# Background WikiOS Database Integrity Guard
bun run scripts/setup/check-wikios-db.ts > /dev/null 2>&1 &

# ------------------------------------------------------------------------------
# 8. Executive Environment Dashboard
# ------------------------------------------------------------------------------
echo -e "${SLATE}${BOLD}  ENVIRONMENT & SERVICES${RESET}"
echo -e "  ${DIM}├─${RESET} Mode:           ${BOLD}${APP_MODE}${RESET}"
echo -e "  ${DIM}├─${RESET} Config File:    ${CYAN}${ENV_SOURCE}${RESET}"
echo -e "  ${DIM}├─${RESET} Local URL:      ${CYAN}${BOLD}http://localhost:${DEVELOPMENT_PORT}${RESET}"
echo -e "  ${DIM}├─${RESET} Routing:        ${SLATE}${BASE_PATH_LABEL}${RESET}"
echo -e "  ${DIM}├─${RESET} Database:       ${SLATE}${DB_STATUS_LABEL}${RESET}"
echo -e "  ${DIM}├─${RESET} Authentication: ${AUTH_LABEL}"
echo -e "  ${DIM}└─${RESET} MediaWiki:      ${SLATE}${NEXT_PUBLIC_MEDIAWIKI_URL:-https://ixwiki.com/}${RESET}"
echo ""
echo -e "${SLATE}${BOLD}  PLATFORM CAPABILITY STACK${RESET}"
echo -e "  ${DIM}├─${RESET} Next.js:        ${BOLD}v${NEXT_VER}${RESET} ${DIM}(Turbopack Engine)${RESET}"
echo -e "  ${DIM}├─${RESET} React:          ${BOLD}v${REACT_VER}${RESET} ${DIM}(Server Components)${RESET}"
echo -e "  ${DIM}├─${RESET} TypeScript:     ${EMERALD}${BOLD}v${TS_VER}${RESET} ${DIM}(Native Go Engine)${RESET}"
echo -e "  ${DIM}├─${RESET} Runtime:        ${PURPLE}${BOLD}Bun v${BUN_VER}${RESET} ${DIM}(Virtual Store)${RESET}"
echo -e "  ${DIM}├─${RESET} API Layer:      ${BOLD}tRPC v${TRPC_VER}${RESET} ${DIM}(90 Routers)${RESET}"
echo -e "  ${DIM}├─${RESET} Database ORM:   ${BOLD}Prisma v${PRISMA_VER}${RESET} ${DIM}(296 Models)${RESET}"
echo -e "  ${DIM}└─${RESET} Styling:        ${BOLD}Tailwind CSS v${TAILWIND_VER}${RESET}"
echo ""
echo -e "${EMERALD}⚡ Booting Turbopack HMR...${RESET} ${DIM}(Press Ctrl+C to gracefully terminate)${RESET}"
echo -e "${LINE}────────────────────────────────────────────────────────────────────────────${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 9. Server Launch with Memory Safeguards
# ------------------------------------------------------------------------------
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

exec bun run next dev --port "$DEVELOPMENT_PORT"