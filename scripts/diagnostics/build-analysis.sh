#!/bin/bash
# IxStats Build Analysis Script
# Analyzes bundle sizes, build performance, and generates optimization suggestions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

# Configuration
WARN_BUNDLE_SIZE_KB=500
CRITICAL_BUNDLE_SIZE_KB=1000
WARN_TOTAL_SIZE_MB=5
CRITICAL_TOTAL_SIZE_MB=10

cd "$PROJECT_DIR"

# ============================================================================
# Header
# ============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  IxStats Build Analysis${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# ============================================================================
# Check Build Directory
# ============================================================================

echo -e "${BLUE}▸ Checking build directory...${NC}"

if [ ! -d ".next" ]; then
    echo -e "${YELLOW}⚠ No build found. Run 'npm run build' first.${NC}"
    echo ""
    echo "To generate a build for analysis:"
    echo "  npm run build"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Build directory found"

# ============================================================================
# Build Metadata
# ============================================================================

echo -e "\n${BLUE}▸ Build Information${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

# Check build ID
if [ -f ".next/BUILD_ID" ]; then
    BUILD_ID=$(cat .next/BUILD_ID)
    echo -e "  Build ID:      $BUILD_ID"
fi

# Check Next.js version from build manifest
if [ -f ".next/required-server-files.json" ]; then
    NEXT_VERSION=$(cat .next/required-server-files.json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$NEXT_VERSION" ]; then
        echo -e "  Next.js:       $NEXT_VERSION"
    fi
fi

# Build time (modification time of BUILD_ID)
if [ -f ".next/BUILD_ID" ]; then
    BUILD_TIME=$(stat -c %y .next/BUILD_ID 2>/dev/null || stat -f %Sm .next/BUILD_ID 2>/dev/null)
    echo -e "  Built:         $BUILD_TIME"
fi

# ============================================================================
# Bundle Size Analysis
# ============================================================================

echo -e "\n${BLUE}▸ Static Bundle Analysis${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

if [ -d ".next/static" ]; then
    # Calculate total static size
    STATIC_SIZE=$(du -sh .next/static 2>/dev/null | cut -f1)
    echo -e "  Total Static:  $STATIC_SIZE"

    # Analyze chunks
    if [ -d ".next/static/chunks" ]; then
        CHUNKS_SIZE=$(du -sh .next/static/chunks 2>/dev/null | cut -f1)
        CHUNK_COUNT=$(find .next/static/chunks -name "*.js" 2>/dev/null | wc -l)
        echo -e "  JS Chunks:     $CHUNKS_SIZE ($CHUNK_COUNT files)"
    fi

    # Analyze CSS
    if [ -d ".next/static/css" ]; then
        CSS_SIZE=$(du -sh .next/static/css 2>/dev/null | cut -f1)
        CSS_COUNT=$(find .next/static/css -name "*.css" 2>/dev/null | wc -l)
        echo -e "  CSS:           $CSS_SIZE ($CSS_COUNT files)"
    fi

    # Analyze media
    if [ -d ".next/static/media" ]; then
        MEDIA_SIZE=$(du -sh .next/static/media 2>/dev/null | cut -f1)
        echo -e "  Media:         $MEDIA_SIZE"
    fi
fi

# ============================================================================
# Large Bundle Detection
# ============================================================================

echo -e "\n${BLUE}▸ Large Bundles (>${WARN_BUNDLE_SIZE_KB}KB)${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

LARGE_BUNDLE_COUNT=0

if [ -d ".next/static/chunks" ]; then
    while IFS= read -r line; do
        SIZE_KB=$(echo "$line" | awk '{print $1}')
        FILE=$(echo "$line" | awk '{print $2}')
        FILENAME=$(basename "$FILE")

        if [ "$SIZE_KB" -ge "$CRITICAL_BUNDLE_SIZE_KB" ]; then
            echo -e "  ${RED}✗${NC} ${FILENAME}: ${SIZE_KB}KB ${RED}[CRITICAL]${NC}"
            ((LARGE_BUNDLE_COUNT++))
        elif [ "$SIZE_KB" -ge "$WARN_BUNDLE_SIZE_KB" ]; then
            echo -e "  ${YELLOW}⚠${NC} ${FILENAME}: ${SIZE_KB}KB ${YELLOW}[WARNING]${NC}"
            ((LARGE_BUNDLE_COUNT++))
        fi
    done < <(find .next/static/chunks -name "*.js" -exec du -k {} \; 2>/dev/null | sort -rn | head -20)
fi

if [ "$LARGE_BUNDLE_COUNT" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} No oversized bundles detected"
fi

# ============================================================================
# Server Bundle Analysis
# ============================================================================

echo -e "\n${BLUE}▸ Server Bundle Analysis${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

if [ -d ".next/server" ]; then
    SERVER_SIZE=$(du -sh .next/server 2>/dev/null | cut -f1)
    echo -e "  Server Bundle: $SERVER_SIZE"

    # Check for standalone output
    if [ -d ".next/standalone" ]; then
        STANDALONE_SIZE=$(du -sh .next/standalone 2>/dev/null | cut -f1)
        echo -e "  Standalone:    $STANDALONE_SIZE"
    fi

    # Count server chunks
    SERVER_CHUNKS=$(find .next/server -name "*.js" 2>/dev/null | wc -l)
    echo -e "  Server Files:  $SERVER_CHUNKS JS files"
fi

# ============================================================================
# Page Analysis
# ============================================================================

echo -e "\n${BLUE}▸ Page Routes Analysis${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

if [ -d ".next/server/app" ]; then
    # Count pages
    PAGE_COUNT=$(find .next/server/app -name "page.js" 2>/dev/null | wc -l)
    echo -e "  Total Pages:   $PAGE_COUNT"

    # List largest pages
    echo -e "\n  Largest Page Bundles:"
    find .next/server/app -name "page.js" -exec du -k {} \; 2>/dev/null | sort -rn | head -5 | while read -r SIZE FILE; do
        ROUTE=$(echo "$FILE" | sed 's|.next/server/app||' | sed 's|/page.js||')
        [ -z "$ROUTE" ] && ROUTE="/"
        echo -e "    ${SIZE}KB  ${ROUTE}"
    done
fi

# ============================================================================
# Dependency Analysis
# ============================================================================

echo -e "\n${BLUE}▸ Dependency Size Estimation${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

if [ -d "node_modules" ]; then
    # Check key dependencies
    DEPS=("react" "react-dom" "next" "@prisma/client" "recharts" "@radix-ui" "framer-motion")

    for DEP in "${DEPS[@]}"; do
        if [ -d "node_modules/$DEP" ]; then
            DEP_SIZE=$(du -sh "node_modules/$DEP" 2>/dev/null | cut -f1)
            echo -e "  $DEP: $DEP_SIZE"
        fi
    done
fi

# ============================================================================
# Build Performance Metrics
# ============================================================================

echo -e "\n${BLUE}▸ Build Metrics${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

# Total .next directory size
NEXT_TOTAL=$(du -sh .next 2>/dev/null | cut -f1)
echo -e "  .next Size:    $NEXT_TOTAL"

# Node modules size
if [ -d "node_modules" ]; then
    NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
    echo -e "  node_modules:  $NODE_MODULES_SIZE"
fi

# ============================================================================
# Optimization Recommendations
# ============================================================================

echo -e "\n${BLUE}▸ Optimization Recommendations${NC}"
echo -e "  ${DIM}────────────────────────────────────────${NC}"

RECOMMENDATIONS=()

# Check for large bundles
if [ "$LARGE_BUNDLE_COUNT" -gt 0 ]; then
    RECOMMENDATIONS+=("Consider code splitting for large bundles (dynamic imports)")
fi

# Check if standalone is configured (handles both static and conditional config)
# Note: standalone directory only exists after production build with NODE_ENV=production
if [ ! -d ".next/standalone" ]; then
    # Check if output: standalone is configured in next.config.js (even conditionally)
    if ! grep -qE 'output.*standalone|output:.*"standalone"|output:.*process\.env' next.config.js 2>/dev/null; then
        RECOMMENDATIONS+=("Enable 'output: standalone' for smaller production deployments")
    else
        echo -e "  ${GREEN}✓${NC} output: standalone is configured (run production build to generate)"
    fi
fi

# Check compression (handles both static and dynamic config like compress: process.env...)
if ! grep -qE 'compress:' next.config.js 2>/dev/null; then
    RECOMMENDATIONS+=("Ensure compression is enabled in production")
else
    # Compression is configured - verify it's not explicitly disabled
    if grep -qE 'compress:\s*false' next.config.js 2>/dev/null; then
        RECOMMENDATIONS+=("Compression is disabled - enable it for production")
    else
        echo -e "  ${GREEN}✓${NC} Compression is configured"
    fi
fi

# Check for optimizePackageImports
if ! grep -q 'optimizePackageImports' next.config.js 2>/dev/null; then
    RECOMMENDATIONS+=("Add optimizePackageImports for heavy dependencies (recharts, radix)")
else
    echo -e "  ${GREEN}✓${NC} optimizePackageImports is configured"
fi

# Output remaining recommendations
if [ ${#RECOMMENDATIONS[@]} -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} Build is well-optimized"
else
    echo -e "\n  Suggestions:"
    for REC in "${RECOMMENDATIONS[@]}"; do
        echo -e "  ${YELLOW}→${NC} $REC"
    done
fi

# ============================================================================
# Summary
# ============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

echo -e "  Build Status:     ${GREEN}COMPLETE${NC}"
echo -e "  Static Assets:    ${STATIC_SIZE:-N/A}"
echo -e "  Server Bundle:    ${SERVER_SIZE:-N/A}"
echo -e "  Page Count:       ${PAGE_COUNT:-N/A}"
echo -e "  Large Bundles:    $LARGE_BUNDLE_COUNT"
echo -e "  Recommendations:  ${#RECOMMENDATIONS[@]}"
echo ""

# ============================================================================
# Quick Commands
# ============================================================================

echo -e "${CYAN}Quick Commands:${NC}"
echo "  npm run build              # Create production build"
echo "  npm run build:analyze      # Build with bundle analyzer"
echo "  npm run diagnostics:build  # Run this analysis"
echo ""
