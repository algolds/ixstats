#!/bin/bash
# IxStats Diagnostic Suite Runner
# Runs all diagnostic scripts and generates a comprehensive report

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_DIR/.diagnostics"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/diagnostic_report_$TIMESTAMP.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default options
RUN_HEALTH=true
RUN_BENCHMARK=true
RUN_DB=true
RUN_CACHE=true
VERBOSE=false
BASE_URL="http://localhost:3000"

# ============================================================================
# Help
# ============================================================================

show_help() {
    cat << EOF
IxStats Diagnostic Suite

Usage: $0 [options]

Options:
    -h, --help          Show this help message
    -v, --verbose       Verbose output
    --url URL           Base URL for tests (default: http://localhost:3000)
    --health-only       Run only health checks
    --benchmark-only    Run only performance benchmarks
    --db-only           Run only database analysis
    --cache-only        Run only cache tests
    --skip-health       Skip health checks
    --skip-benchmark    Skip performance benchmarks
    --skip-db           Skip database analysis
    --skip-cache        Skip cache tests
    --no-report         Don't save report to file

Examples:
    $0                      # Run all diagnostics
    $0 --health-only        # Run only health checks
    $0 --skip-db --verbose  # Skip DB analysis, verbose output
    $0 --url http://localhost:3550/projects/ixstats  # Test production

EOF
}

# ============================================================================
# Argument Parsing
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        --health-only)
            RUN_BENCHMARK=false
            RUN_DB=false
            RUN_CACHE=false
            shift
            ;;
        --benchmark-only)
            RUN_HEALTH=false
            RUN_DB=false
            RUN_CACHE=false
            shift
            ;;
        --db-only)
            RUN_HEALTH=false
            RUN_BENCHMARK=false
            RUN_CACHE=false
            shift
            ;;
        --cache-only)
            RUN_HEALTH=false
            RUN_BENCHMARK=false
            RUN_DB=false
            shift
            ;;
        --skip-health)
            RUN_HEALTH=false
            shift
            ;;
        --skip-benchmark)
            RUN_BENCHMARK=false
            shift
            ;;
        --skip-db)
            RUN_DB=false
            shift
            ;;
        --skip-cache)
            RUN_CACHE=false
            shift
            ;;
        --no-report)
            REPORT_FILE=""
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# ============================================================================
# Setup
# ============================================================================

cd "$PROJECT_DIR"

# Create report directory
if [ -n "$REPORT_FILE" ]; then
    mkdir -p "$REPORT_DIR"
    echo "" > "$REPORT_FILE"
fi

# Logging function
log() {
    local message="$1"
    local color="${2:-NC}"

    # Terminal output
    echo -e "${!color}${message}${NC}"

    # File output (strip colors)
    if [ -n "$REPORT_FILE" ]; then
        echo "$message" | sed 's/\x1b\[[0-9;]*m//g' >> "$REPORT_FILE"
    fi
}

section() {
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "CYAN"
    log "  $1" "CYAN"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "CYAN"
    log ""
}

# ============================================================================
# Header
# ============================================================================

clear
log "╔═══════════════════════════════════════════════════════════════════╗" "BLUE"
log "║                    IxStats Diagnostic Suite                       ║" "BLUE"
log "╚═══════════════════════════════════════════════════════════════════╝" "BLUE"
log ""
log "Timestamp: $(date)"
log "Project:   $PROJECT_DIR"
log "Target:    $BASE_URL"
if [ -n "$REPORT_FILE" ]; then
    log "Report:    $REPORT_FILE"
fi
log ""

# ============================================================================
# Results Tracking
# ============================================================================

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

record_result() {
    local exit_code=$1
    ((TOTAL_TESTS++))
    if [ $exit_code -eq 0 ]; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
}

# ============================================================================
# Health Check
# ============================================================================

if [ "$RUN_HEALTH" = true ]; then
    section "Health Check"

    if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
        bash "$SCRIPT_DIR/health-check.sh" 2>&1 | while IFS= read -r line; do
            log "$line"
        done
        record_result ${PIPESTATUS[0]}
    else
        log "⚠ health-check.sh not found" "YELLOW"
    fi
fi

# ============================================================================
# Performance Benchmark
# ============================================================================

if [ "$RUN_BENCHMARK" = true ]; then
    section "Performance Benchmark"

    if [ -f "$SCRIPT_DIR/benchmark.ts" ]; then
        export BENCHMARK_URL="$BASE_URL"
        npx tsx "$SCRIPT_DIR/benchmark.ts" 2>&1 | while IFS= read -r line; do
            log "$line"
        done
        record_result ${PIPESTATUS[0]}
    else
        log "⚠ benchmark.ts not found" "YELLOW"
    fi
fi

# ============================================================================
# Database Analysis
# ============================================================================

if [ "$RUN_DB" = true ]; then
    section "Database Analysis"

    if [ -f "$SCRIPT_DIR/db-analysis.ts" ]; then
        npx tsx "$SCRIPT_DIR/db-analysis.ts" 2>&1 | while IFS= read -r line; do
            log "$line"
        done
        record_result ${PIPESTATUS[0]}
    else
        log "⚠ db-analysis.ts not found" "YELLOW"
    fi
fi

# ============================================================================
# Cache Tests
# ============================================================================

if [ "$RUN_CACHE" = true ]; then
    section "Cache Performance"

    if [ -f "$SCRIPT_DIR/cache-test.ts" ]; then
        export BENCHMARK_URL="$BASE_URL"
        npx tsx "$SCRIPT_DIR/cache-test.ts" 2>&1 | while IFS= read -r line; do
            log "$line"
        done
        record_result ${PIPESTATUS[0]}
    else
        log "⚠ cache-test.ts not found" "YELLOW"
    fi
fi

# ============================================================================
# Final Summary
# ============================================================================

section "Final Summary"

log "Tests Run:    $TOTAL_TESTS"
log "Passed:       $PASSED_TESTS" "GREEN"
log "Failed:       $FAILED_TESTS" "RED"
log ""

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

    if [ $SUCCESS_RATE -ge 90 ]; then
        log "Overall Status: HEALTHY ($SUCCESS_RATE%)" "GREEN"
    elif [ $SUCCESS_RATE -ge 70 ]; then
        log "Overall Status: DEGRADED ($SUCCESS_RATE%)" "YELLOW"
    else
        log "Overall Status: UNHEALTHY ($SUCCESS_RATE%)" "RED"
    fi
fi

log ""

if [ -n "$REPORT_FILE" ]; then
    log "Report saved to: $REPORT_FILE" "CYAN"
fi

# ============================================================================
# Quick Commands Reference
# ============================================================================

log ""
log "Quick Commands:" "BLUE"
log "  npm run diagnostics           # Run full suite"
log "  npm run diagnostics:health    # Health check only"
log "  npm run diagnostics:bench     # Benchmark only"
log "  npm run diagnostics:db        # Database analysis only"
log "  npm run diagnostics:cache     # Cache tests only"
log ""

# Exit with failure if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
fi

exit 0
