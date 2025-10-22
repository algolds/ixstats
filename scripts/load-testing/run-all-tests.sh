#!/bin/bash
# run-all-tests.sh
# Comprehensive load testing suite runner for IxStats v1.2

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
RESULTS_FILE="$SCRIPT_DIR/load-test-results-$(date +%Y%m%d-%H%M%S).log"

# Default options
RUN_API_LOAD=true
RUN_RATE_LIMITING=true
RUN_DATABASE=true
RUN_BUILDER=true
QUICK_MODE=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --api-only)
      RUN_RATE_LIMITING=false
      RUN_DATABASE=false
      RUN_BUILDER=false
      shift
      ;;
    --skip-api)
      RUN_API_LOAD=false
      shift
      ;;
    --skip-rate-limiting)
      RUN_RATE_LIMITING=false
      shift
      ;;
    --skip-database)
      RUN_DATABASE=false
      shift
      ;;
    --skip-builder)
      RUN_BUILDER=false
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --quick              Run quick tests (reduced iterations)"
      echo "  --api-only           Only run API load tests"
      echo "  --skip-api           Skip API load tests"
      echo "  --skip-rate-limiting Skip rate limiting tests"
      echo "  --skip-database      Skip database performance tests"
      echo "  --skip-builder       Skip E2E builder flow tests"
      echo "  --help               Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  BASE_URL             Base URL for testing (default: http://localhost:3000)"
      echo "  TEST_AUTH_TOKEN      Authentication token for protected endpoints"
      echo "  TEST_ADMIN_TOKEN     Admin token for admin endpoints"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Header
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       IxStats Load Testing Suite - Comprehensive Runner          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration summary
echo -e "${CYAN}Configuration:${NC}"
echo -e "  Mode:              ${QUICK_MODE:+${YELLOW}Quick${NC}}${QUICK_MODE:-${GREEN}Full${NC}}"
echo -e "  Results Log:       $RESULTS_FILE"
echo -e "  API Load Test:     ${RUN_API_LOAD:+${GREEN}Enabled${NC}}${RUN_API_LOAD:-${YELLOW}Disabled${NC}}"
echo -e "  Rate Limiting:     ${RUN_RATE_LIMITING:+${GREEN}Enabled${NC}}${RUN_RATE_LIMITING:-${YELLOW}Disabled${NC}}"
echo -e "  Database Perf:     ${RUN_DATABASE:+${GREEN}Enabled${NC}}${RUN_DATABASE:-${YELLOW}Disabled${NC}}"
echo -e "  Builder Flow:      ${RUN_BUILDER:+${GREEN}Enabled${NC}}${RUN_BUILDER:-${YELLOW}Disabled${NC}}"
echo ""

# Initialize results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Change to project root
cd "$PROJECT_ROOT"

# Function to run a test and track results
run_test() {
  local test_name=$1
  local test_command=$2

  echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}Running: $test_name${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}\n"

  if eval "$test_command" 2>&1 | tee -a "$RESULTS_FILE"; then
    echo -e "\n${GREEN}✓ $test_name PASSED${NC}\n"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "\n${RED}✗ $test_name FAILED${NC}\n"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Start timestamp
START_TIME=$(date +%s)

echo -e "${BLUE}Starting load tests at $(date)${NC}\n" | tee "$RESULTS_FILE"

# Test 1: API Load Testing
if [ "$RUN_API_LOAD" = true ]; then
  if [ "$QUICK_MODE" = true ]; then
    run_test "API Load Test (Quick)" \
      "tsx scripts/load-testing/test-api-load.ts --users=25 --duration=15"
  else
    run_test "API Load Test (Full)" \
      "tsx scripts/load-testing/test-api-load.ts --users=50 --duration=30"
  fi
else
  echo -e "${YELLOW}⊘ API Load Test SKIPPED${NC}"
  ((TESTS_SKIPPED++))
fi

# Test 2: Rate Limiting
if [ "$RUN_RATE_LIMITING" = true ]; then
  run_test "Rate Limiting Validation" \
    "tsx scripts/load-testing/test-rate-limiting.ts"
else
  echo -e "${YELLOW}⊘ Rate Limiting Test SKIPPED${NC}"
  ((TESTS_SKIPPED++))
fi

# Test 3: Database Performance
if [ "$RUN_DATABASE" = true ]; then
  if [ "$QUICK_MODE" = true ]; then
    run_test "Database Performance Test (Quick)" \
      "tsx scripts/load-testing/test-database-performance.ts --concurrent=5 --iterations=25"
  else
    run_test "Database Performance Test (Full)" \
      "tsx scripts/load-testing/test-database-performance.ts --concurrent=10 --iterations=50"
  fi
else
  echo -e "${YELLOW}⊘ Database Performance Test SKIPPED${NC}"
  ((TESTS_SKIPPED++))
fi

# Test 4: E2E Builder Flow
if [ "$RUN_BUILDER" = true ]; then
  if [ "$QUICK_MODE" = true ]; then
    run_test "E2E Builder Flow Test (Quick)" \
      "tsx scripts/load-testing/test-builder-flow.ts --iterations=5 --concurrent=2"
  else
    run_test "E2E Builder Flow Test (Full)" \
      "tsx scripts/load-testing/test-builder-flow.ts --iterations=10 --concurrent=3"
  fi
else
  echo -e "${YELLOW}⊘ E2E Builder Flow Test SKIPPED${NC}"
  ((TESTS_SKIPPED++))
fi

# End timestamp
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        Test Suite Summary                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}\n"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))

echo -e "Total Tests:    $TOTAL_TESTS"
echo -e "Passed:         ${GREEN}$TESTS_PASSED${NC} ($(( TESTS_PASSED * 100 / (TOTAL_TESTS - TESTS_SKIPPED) ))%)"
echo -e "Failed:         ${TESTS_FAILED:+$RED}$TESTS_FAILED${NC} ($(( TESTS_FAILED * 100 / (TOTAL_TESTS - TESTS_SKIPPED) ))%)"
echo -e "Skipped:        ${YELLOW}$TESTS_SKIPPED${NC}"
echo -e "Duration:       ${DURATION}s ($(date -u -d @${DURATION} +"%M:%S"))"
echo -e "Results Log:    $RESULTS_FILE"

echo ""

# Production readiness assessment
if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_PASSED -gt 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✓ ALL TESTS PASSED - PLATFORM READY FOR PRODUCTION DEPLOYMENT  ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ✗ SOME TESTS FAILED - DEPLOYMENT BLOCKED                        ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}Review the results log for details: $RESULTS_FILE${NC}"
  echo ""
  exit 1
fi
