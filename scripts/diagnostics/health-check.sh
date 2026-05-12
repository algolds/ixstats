#!/bin/bash
# IxStates Health Check Script
# Quick validation of system health and dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  IxStates Health Check${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

section() {
    echo -e "\n${BLUE}▸ $1${NC}"
}

# ============================================================================
# Environment Checks
# ============================================================================

check_environment() {
    section "Environment"

    # Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            check_pass "Node.js v$NODE_VERSION (>= 18 required)"
        else
            check_fail "Node.js v$NODE_VERSION (>= 18 required)"
        fi
    else
        check_fail "Node.js not found"
    fi

    # bun version
    if command -v bun &> /dev/null; then
        BUN_VERSION=$(bun -v)
        check_pass "bun v$BUN_VERSION"
    else
        check_fail "bun not found"
    fi

    # Check if in project directory
    if [ -f "$PROJECT_DIR/package.json" ]; then
        check_pass "Project directory valid"
    else
        check_fail "Not in IxStates project directory"
    fi
}

# ============================================================================
# Dependency Checks
# ============================================================================

check_dependencies() {
    section "Dependencies"

    cd "$PROJECT_DIR"

    # Check node_modules
    if [ -d "node_modules" ]; then
        MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
        check_pass "node_modules present ($MODULE_COUNT packages)"
    else
        check_fail "node_modules missing - run 'bun install'"
    fi

    # Check Prisma client
    if [ -d "node_modules/.prisma/client" ]; then
        check_pass "Prisma client generated"
    else
        check_warn "Prisma client not generated - run 'bun run db:generate'"
    fi

    # Check .next directory (if dev server was run)
    if [ -d ".next" ]; then
        check_pass ".next build directory exists"
    else
        check_warn ".next not found - dev server not yet started"
    fi
}

# ============================================================================
# Configuration Checks
# ============================================================================

# Helper function to check if an env var exists in any of the specified files
check_env_var_in_files() {
    local var_name="$1"
    shift
    local files=("$@")
    
    for env_file in "${files[@]}"; do
        if [ -f "$env_file" ] && grep -q "^${var_name}=" "$env_file" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# Helper function to find which file contains an env var
find_env_var_file() {
    local var_name="$1"
    shift
    local files=("$@")
    
    for env_file in "${files[@]}"; do
        if [ -f "$env_file" ] && grep -q "^${var_name}=" "$env_file" 2>/dev/null; then
            echo "$env_file"
            return 0
        fi
    done
    return 1
}

check_configuration() {
    section "Configuration"

    cd "$PROJECT_DIR"

    # Define env file search paths
    local db_env_files=(".env" ".env.local" ".env.local.dev")
    local clerk_env_files=(".env.local" ".env.local.dev" ".env.production.local")

    # Check environment files
    if [ -f ".env" ] || [ -f ".env.local" ] || [ -f ".env.local.dev" ]; then
        check_pass "Environment file found"
    else
        check_fail "No .env, .env.local, or .env.local.dev file found"
    fi

    # Check for DATABASE_URL in any of the env files
    if check_env_var_in_files "DATABASE_URL" "${db_env_files[@]}"; then
        local found_in=$(find_env_var_file "DATABASE_URL" "${db_env_files[@]}")
        check_pass "DATABASE_URL configured (in $found_in)"
    else
        check_fail "DATABASE_URL not configured in any env file"
    fi

    # Check for CLERK_SECRET_KEY in any of the clerk env files
    if check_env_var_in_files "CLERK_SECRET_KEY" "${clerk_env_files[@]}"; then
        local found_in=$(find_env_var_file "CLERK_SECRET_KEY" "${clerk_env_files[@]}")
        check_pass "CLERK_SECRET_KEY configured (in $found_in)"
    else
        check_fail "CLERK_SECRET_KEY not configured in any env file"
    fi

    # Check for NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in any of the clerk env files
    if check_env_var_in_files "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "${clerk_env_files[@]}"; then
        local found_in=$(find_env_var_file "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "${clerk_env_files[@]}")
        check_pass "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY configured (in $found_in)"
    else
        check_fail "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not configured in any env file"
    fi

    # Check next.config.js
    if [ -f "next.config.js" ]; then
        # Check for compression (handles both static and dynamic config)
        if grep -qE "compress:" next.config.js; then
            check_pass "Compression configured in next.config.js"
        else
            check_warn "Compression not configured"
        fi

        if grep -q "instrumentationHook:" next.config.js; then
            check_pass "Instrumentation hook enabled"
        else
            check_warn "Instrumentation hook not enabled"
        fi
    fi
}

# ============================================================================
# Database Checks
# ============================================================================

check_database() {
    section "Database"

    cd "$PROJECT_DIR"

    # Check Prisma schema
    if [ -f "prisma/schema.prisma" ]; then
        MODEL_COUNT=$(grep -c "^model " prisma/schema.prisma 2>/dev/null || echo "0")
        check_pass "Prisma schema found ($MODEL_COUNT models)"
    else
        check_fail "Prisma schema not found"
    fi

    # Check migrations directory
    if [ -d "prisma/migrations" ]; then
        MIGRATION_COUNT=$(find prisma/migrations -maxdepth 1 -type d | wc -l)
        MIGRATION_COUNT=$((MIGRATION_COUNT - 1))
        check_pass "Migrations directory ($MIGRATION_COUNT migrations)"
    else
        check_warn "No migrations directory"
    fi

    # Test database connection (quick check)
    if command -v bunx &> /dev/null; then
        if timeout 15 bunx prisma db execute --schema=prisma/schema.prisma --stdin <<< "SELECT 1" &>/dev/null; then
            check_pass "Database connection successful"
        else
            check_warn "Database connection test failed or timed out"
        fi
    fi
}

# ============================================================================
# Service Checks
# ============================================================================

check_services() {
    section "Services"

    # Check if dev server is running
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" 2>/dev/null | grep -q "200\|302\|307"; then
        check_pass "Dev server running on port 3000"
    else
        check_warn "Dev server not running on port 3000"
    fi

    # Check if production server is running
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3550" 2>/dev/null | grep -q "200\|302\|307"; then
        check_pass "Production server running on port 3550"
    else
        check_warn "Production server not running on port 3550"
    fi

    # Check Redis
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping 2>/dev/null | grep -q "PONG"; then
            check_pass "Redis server responding"
        else
            check_warn "Redis not responding (caching will use in-memory fallback)"
        fi
    else
        check_warn "redis-cli not available"
    fi

    # Check PM2
    if command -v pm2 &> /dev/null; then
        PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"name":"ixstats"' || echo "")
        if [ -n "$PM2_STATUS" ]; then
            check_pass "PM2 process 'ixstats' found"
        else
            check_warn "PM2 process 'ixstats' not running"
        fi
    fi
}

# ============================================================================
# File System Checks
# ============================================================================

check_filesystem() {
    section "File System"

    cd "$PROJECT_DIR"

    # Check critical directories
    CRITICAL_DIRS=("src" "prisma" "public")
    for dir in "${CRITICAL_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            check_pass "Directory exists: $dir"
        else
            check_fail "Missing directory: $dir"
        fi
    done

    # Check disk space
    AVAILABLE_GB=$(df -BG "$PROJECT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_GB" -gt 5 ]; then
        check_pass "Disk space: ${AVAILABLE_GB}GB available"
    elif [ "$AVAILABLE_GB" -gt 1 ]; then
        check_warn "Low disk space: ${AVAILABLE_GB}GB available"
    else
        check_fail "Critical: Only ${AVAILABLE_GB}GB disk space available"
    fi

    # Check file permissions
    if [ -w "$PROJECT_DIR" ]; then
        check_pass "Project directory writable"
    else
        check_fail "Project directory not writable"
    fi
}

# ============================================================================
# Performance Indicators
# ============================================================================

check_performance() {
    section "Performance Indicators"

    # Check system memory
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -m | awk '/^Mem:/ {print $2}')
        AVAIL_MEM=$(free -m | awk '/^Mem:/ {print $7}')
        USAGE_PCT=$((100 - (AVAIL_MEM * 100 / TOTAL_MEM)))

        if [ "$USAGE_PCT" -lt 80 ]; then
            check_pass "Memory usage: ${USAGE_PCT}% (${AVAIL_MEM}MB available)"
        elif [ "$USAGE_PCT" -lt 90 ]; then
            check_warn "Memory usage: ${USAGE_PCT}% (${AVAIL_MEM}MB available)"
        else
            check_fail "High memory usage: ${USAGE_PCT}%"
        fi
    fi

    # Check load average
    if [ -f "/proc/loadavg" ]; then
        LOAD=$(cat /proc/loadavg | cut -d' ' -f1)
        CPU_COUNT=$(nproc 2>/dev/null || echo "1")
        LOAD_INT=$(echo "$LOAD" | cut -d. -f1)

        if [ "$LOAD_INT" -lt "$CPU_COUNT" ]; then
            check_pass "System load: $LOAD (${CPU_COUNT} CPUs)"
        elif [ "$LOAD_INT" -lt $((CPU_COUNT * 2)) ]; then
            check_warn "Elevated load: $LOAD (${CPU_COUNT} CPUs)"
        else
            check_fail "High system load: $LOAD"
        fi
    fi
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

    echo -e "  ${GREEN}Passed:${NC}   $PASSED"
    echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
    echo -e "  ${RED}Failed:${NC}   $FAILED"
    echo ""

    if [ "$FAILED" -gt 0 ]; then
        echo -e "${RED}Health check completed with failures.${NC}"
        exit 1
    elif [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}Health check completed with warnings.${NC}"
        exit 0
    else
        echo -e "${GREEN}All health checks passed!${NC}"
        exit 0
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    print_header
    check_environment
    check_dependencies
    check_configuration
    check_database
    check_services
    check_filesystem
    check_performance
    print_summary
}

main "$@"
