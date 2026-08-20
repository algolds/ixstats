#!/bin/bash

# ==============================================================================
#  IxStates (IxStats) Production Server Launcher
#  Production Next.js Standalone Runner with PM2 and Redis Integration
# ==============================================================================

set -e

# Navigate to project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ANSI Color Palette (Apple / Facet Design System)
ESC="\033"
RESET="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"
CYAN="${ESC}[38;2;6;182;212m"       # Cyan 500
EMERALD="${ESC}[38;2;16;185;129m"   # Emerald 500
AMBER="${ESC}[38;2;245;158;11m"     # Amber 500
RED="${ESC}[38;2;239;68;68m"        # Red 500
SLATE="${ESC}[38;2;148;163;184m"    # Slate 400
LINE="${ESC}[38;2;51;65;85m"        # Slate 700

# ------------------------------------------------------------------------------
# 1. Environment Loading & Normalization
# ------------------------------------------------------------------------------
export NODE_ENV="production"

if [ -f ".env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env.production 2>/dev/null || true
    set +a
else
    echo -e "${RED}❌ Error: .env.production template file not found.${RESET}"
    exit 1
fi

if [ -f ".env.production.local" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env.production.local 2>/dev/null || true
    set +a
else
    echo -e "${AMBER}⚠️  Warning: .env.production.local not found (secrets may be missing).${RESET}"
fi

# Base path normalization
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
    BASE_PATH="/projects/ixstates"
fi
BASE_PATH="$(normalize_base_path "$BASE_PATH")"

if [ -z "${NEXT_PUBLIC_BASE_PATH+x}" ]; then
    NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
fi
NEXT_PUBLIC_BASE_PATH="$(normalize_base_path "$NEXT_PUBLIC_BASE_PATH")"

export BASE_PATH NEXT_PUBLIC_BASE_PATH
PRODUCTION_PORT="${PORT:-3550}"

# ------------------------------------------------------------------------------
# 2. Dynamic Platform & Package Metadata Resolution
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
    console.log(`PLATFORM_INFO="${platform}"`);
} catch (e) {
    console.log("NEXT_VER=\"16.3.0\"");
    console.log("PLATFORM_INFO=\"v1.4.0 \\\"Ogma\\\" (Release Candidate)\"");
}
' 2>/dev/null || echo 'NEXT_VER="16.3.0" PLATFORM_INFO="v1.4.0 \"Ogma\""')"

# ------------------------------------------------------------------------------
# 3. Header Presentation
# ------------------------------------------------------------------------------
echo ""
echo -e "${CYAN}${BOLD}┌──────────────────────────────────────────────────────────────────────────┐${RESET}"
echo -e "${CYAN}${BOLD}│${RESET}  ${BOLD}IxStates Production Server${RESET}  ${DIM}·${RESET}  ${SLATE}Next.js ${NEXT_VER}${RESET}                          ${CYAN}${BOLD}│${RESET}"
echo -e "${CYAN}${BOLD}│${RESET}  ${DIM}Platform:${RESET} ${EMERALD}${PLATFORM_INFO}${RESET}                                              ${CYAN}${BOLD}│${RESET}"
echo -e "${CYAN}${BOLD}└──────────────────────────────────────────────────────────────────────────┘${RESET}"
echo ""

# ------------------------------------------------------------------------------
# 4. Pre-Flight Verification
# ------------------------------------------------------------------------------
if [ ! -d ".next" ]; then
    echo -e "${RED}❌ Error: Production build not found.${RESET} Run ${CYAN}bun run build${RESET} first."
    exit 1
fi

# Start Redis cache
./scripts/setup-redis.sh start > /dev/null 2>&1 &

# ------------------------------------------------------------------------------
# 5. Production Dashboard & Server Launch
# ------------------------------------------------------------------------------
echo -e "${SLATE}${BOLD}  PRODUCTION CONFIGURATION${RESET}"
echo -e "  ${DIM}├─${RESET} Base Path:      ${CYAN}${BOLD}${BASE_PATH}${RESET}"
echo -e "  ${DIM}├─${RESET} Bound Port:     ${BOLD}${PRODUCTION_PORT}${RESET}"
echo -e "  ${DIM}├─${RESET} Public Origin:  ${SLATE}https://ixwiki.com${BASE_PATH}${RESET}"
echo -e "  ${DIM}├─${RESET} Local URL:      ${CYAN}http://localhost:${PRODUCTION_PORT}${BASE_PATH}${RESET}"
echo -e "  ${DIM}└─${RESET} MediaWiki API:  ${SLATE}${NEXT_PUBLIC_MEDIAWIKI_URL:-https://ixwiki.com/}${RESET}"
echo ""
echo -e "${EMERALD}🚀 Launching Next.js production server...${RESET}"
echo -e "${LINE}────────────────────────────────────────────────────────────────────────────${RESET}"
echo ""

exec bun run next start -p "$PRODUCTION_PORT"
