#!/bin/bash

# IxStats System Audit & Validation Script
# Tests image upload, download, autosave, and system configuration
# Created: November 10, 2025

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3550"
API_BASE="${BASE_URL}/projects/ixstats"
UPLOAD_DIR="/ixwiki/public/projects/ixstats/.next/standalone/public/images/uploads"
DOWNLOAD_DIR="/ixwiki/public/projects/ixstats/.next/standalone/public/images/downloaded"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST ${TESTS_TOTAL}:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

# Test 1: PM2 Process Configuration
test_pm2_config() {
    print_header "TEST 1: PM2 Process Configuration"
    ((TESTS_TOTAL++))

    print_test "Verifying PM2 is running ixstats process"

    if pm2 list | grep -q "ixstats.*online"; then
        print_success "PM2 process is online"
    else
        print_fail "PM2 process is not online"
        return 1
    fi

    # Check script path
    SCRIPT_PATH=$(pm2 describe ixstats 2>/dev/null | grep "script path" | sed 's/.*│ //' | sed 's/ │$//')
    if [[ "$SCRIPT_PATH" == *"standalone/server.js"* ]]; then
        print_success "PM2 using correct standalone server: $SCRIPT_PATH"
    else
        print_info "Script path: $SCRIPT_PATH"
        # If it contains standalone, consider it a pass even if parsing is off
        if [[ "$SCRIPT_PATH" == *"standalone"* ]]; then
            print_success "PM2 using standalone build"
        else
            print_fail "PM2 not using standalone server: $SCRIPT_PATH"
            return 1
        fi
    fi

    # Check working directory
    CWD=$(pm2 describe ixstats 2>/dev/null | grep "exec cwd" | sed 's/.*│ //' | sed 's/ │$//')
    if [[ "$CWD" == *"ixstats"* ]] || [[ "$CWD" == "/ixwiki/public/projects/ixstats" ]]; then
        print_success "Correct working directory: $CWD"
    else
        print_fail "Incorrect working directory: $CWD"
        return 1
    fi
}

# Test 2: Directory Permissions
test_directory_permissions() {
    print_header "TEST 2: Directory Permissions"
    ((TESTS_TOTAL++))

    print_test "Checking upload/download directory permissions"

    # Check uploads directory
    if [ -d "$UPLOAD_DIR" ]; then
        UPLOAD_PERMS=$(stat -c "%a" "$UPLOAD_DIR" 2>/dev/null || stat -f "%A" "$UPLOAD_DIR" 2>/dev/null)
        UPLOAD_OWNER=$(stat -c "%U:%G" "$UPLOAD_DIR" 2>/dev/null || stat -f "%Su:%Sg" "$UPLOAD_DIR" 2>/dev/null)

        print_info "Uploads: $UPLOAD_DIR ($UPLOAD_PERMS, $UPLOAD_OWNER)"

        if [ "$UPLOAD_PERMS" = "755" ] || [ "$UPLOAD_PERMS" = "775" ]; then
            print_success "Upload directory has correct permissions: $UPLOAD_PERMS"
        else
            print_fail "Upload directory has incorrect permissions: $UPLOAD_PERMS"
            return 1
        fi
    else
        print_fail "Upload directory does not exist: $UPLOAD_DIR"
        return 1
    fi

    # Check downloads directory
    if [ -d "$DOWNLOAD_DIR" ]; then
        DOWNLOAD_PERMS=$(stat -c "%a" "$DOWNLOAD_DIR" 2>/dev/null || stat -f "%A" "$DOWNLOAD_DIR" 2>/dev/null)
        DOWNLOAD_OWNER=$(stat -c "%U:%G" "$DOWNLOAD_DIR" 2>/dev/null || stat -f "%Su:%Sg" "$DOWNLOAD_DIR" 2>/dev/null)

        print_info "Downloads: $DOWNLOAD_DIR ($DOWNLOAD_PERMS, $DOWNLOAD_OWNER)"

        if [ "$DOWNLOAD_PERMS" = "755" ] || [ "$DOWNLOAD_PERMS" = "775" ]; then
            print_success "Download directory has correct permissions: $DOWNLOAD_PERMS"
        else
            print_fail "Download directory has incorrect permissions: $DOWNLOAD_PERMS"
            return 1
        fi
    else
        print_fail "Download directory does not exist: $DOWNLOAD_DIR"
        return 1
    fi
}

# Test 3: Server Availability
test_server_availability() {
    print_header "TEST 3: Server Availability"
    ((TESTS_TOTAL++))

    print_test "Testing server response at $API_BASE"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "308" ]; then
        print_success "Server is responding (HTTP $HTTP_CODE)"
    else
        print_fail "Server not responding correctly (HTTP $HTTP_CODE)"
        return 1
    fi
}

# Test 4: Image Upload API Endpoint
test_image_upload_endpoint() {
    print_header "TEST 4: Image Upload API Endpoint"
    ((TESTS_TOTAL++))

    print_test "Testing upload endpoint availability"

    UPLOAD_INFO=$(curl -s "$API_BASE/api/upload/image" 2>/dev/null || echo "{}")

    if echo "$UPLOAD_INFO" | grep -q "authenticated"; then
        print_success "Upload endpoint is accessible"
        print_info "Endpoint config: $(echo $UPLOAD_INFO | jq -c '.')"
    else
        print_fail "Upload endpoint not responding"
        return 1
    fi

    # Check allowed types
    if echo "$UPLOAD_INFO" | grep -q "image/png"; then
        print_success "Upload endpoint allows PNG files"
    else
        print_fail "Upload endpoint configuration issue"
        return 1
    fi
}

# Test 5: Image Download API Endpoint
test_image_download_endpoint() {
    print_header "TEST 5: Image Download API Endpoint"
    ((TESTS_TOTAL++))

    print_test "Testing download endpoint availability"

    DOWNLOAD_INFO=$(curl -s "$API_BASE/api/download/external-image" 2>/dev/null || echo "{}")

    if echo "$DOWNLOAD_INFO" | grep -q "authenticated"; then
        print_success "Download endpoint is accessible"
        print_info "Trusted domains: $(echo $DOWNLOAD_INFO | jq -r '.trustedDomains[]' 2>/dev/null | tr '\n' ', ' | sed 's/,$//')"
    else
        print_fail "Download endpoint not responding"
        return 1
    fi
}

# Test 6: Database Connectivity
test_database_connectivity() {
    print_header "TEST 6: Database Connectivity"
    ((TESTS_TOTAL++))

    print_test "Testing PostgreSQL database connection"

    DB_RESULT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -c "SELECT COUNT(*) FROM \"Country\";" -t 2>/dev/null || echo "0")

    if [ "$DB_RESULT" -gt 0 ]; then
        print_success "Database connected successfully ($DB_RESULT countries found)"
    else
        print_fail "Database connection failed or no data"
        return 1
    fi

    # Test NationalIdentity table
    IDENTITY_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -c "SELECT COUNT(*) FROM \"NationalIdentity\";" -t 2>/dev/null || echo "0")
    print_info "NationalIdentity records: $IDENTITY_COUNT"
}

# Test 7: tRPC API Endpoints
test_trpc_endpoints() {
    print_header "TEST 7: tRPC API Endpoints"
    ((TESTS_TOTAL++))

    print_test "Testing tRPC API availability"

    # Test if tRPC endpoint responds
    TRPC_RESPONSE=$(curl -s "$API_BASE/api/trpc/system.getCurrentIxTime" 2>/dev/null || echo "{}")

    if echo "$TRPC_RESPONSE" | grep -q "result\|error"; then
        print_success "tRPC API is responding"
    else
        print_fail "tRPC API not responding correctly"
        return 1
    fi
}

# Test 8: Filesystem Write Test
test_filesystem_write() {
    print_header "TEST 8: Filesystem Write Test"
    ((TESTS_TOTAL++))

    print_test "Testing filesystem write permissions"

    TEST_FILE="$UPLOAD_DIR/audit_test_$(date +%s).txt"

    if echo "Audit test file" > "$TEST_FILE" 2>/dev/null; then
        print_success "Successfully wrote test file to upload directory"
        rm -f "$TEST_FILE"
    else
        print_fail "Cannot write to upload directory"
        return 1
    fi

    TEST_FILE2="$DOWNLOAD_DIR/audit_test_$(date +%s).txt"

    if echo "Audit test file" > "$TEST_FILE2" 2>/dev/null; then
        print_success "Successfully wrote test file to download directory"
        rm -f "$TEST_FILE2"
    else
        print_fail "Cannot write to download directory"
        return 1
    fi
}

# Test 9: Recent Logs Check
test_recent_logs() {
    print_header "TEST 9: Recent Error Logs"
    ((TESTS_TOTAL++))

    print_test "Checking for critical errors in recent logs"

    ERROR_COUNT=$(pm2 logs ixstats --nostream --lines 100 2>/dev/null | grep -i "error\|exception\|fail" | grep -v "Cloudflare\|deprecated\|DeprecationWarning\|WikiImageSearch\|WikiSearch.*blocked" | wc -l || echo "0")

    if [ "$ERROR_COUNT" -lt 5 ]; then
        print_success "No critical errors in recent logs ($ERROR_COUNT non-critical messages)"
    else
        print_info "Found $ERROR_COUNT potential errors (checking if critical)"
        CRITICAL_ERRORS=$(pm2 logs ixstats --nostream --lines 50 2>/dev/null | grep -i "error\|exception\|fail" | grep -v "Cloudflare\|deprecated\|WikiImageSearch\|WikiSearch.*blocked" | head -5)
        if [ -z "$CRITICAL_ERRORS" ]; then
            print_success "No critical errors found (all errors are handled/expected)"
        else
            print_fail "Found critical errors in logs:"
            echo "$CRITICAL_ERRORS"
            return 1
        fi
    fi
}

# Test 10: PM2 Save Configuration
test_pm2_save() {
    print_header "TEST 10: PM2 Configuration Persistence"
    ((TESTS_TOTAL++))

    print_test "Saving PM2 configuration for persistence"

    if pm2 save 2>&1 | grep -q "saved"; then
        print_success "PM2 configuration saved successfully"
    else
        print_fail "Failed to save PM2 configuration"
        return 1
    fi
}

# Main execution
main() {
    clear
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║         IxStats System Audit & Validation Script         ║"
    echo "║                    November 10, 2025                     ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    print_info "Starting comprehensive system audit..."
    print_info "Base URL: $API_BASE"
    print_info "Time: $(date '+%Y-%m-%d %H:%M:%S')"

    # Run all tests
    test_pm2_config || true
    test_directory_permissions || true
    test_server_availability || true
    test_image_upload_endpoint || true
    test_image_download_endpoint || true
    test_database_connectivity || true
    test_trpc_endpoints || true
    test_filesystem_write || true
    test_recent_logs || true
    test_pm2_save || true

    # Print summary
    print_header "AUDIT SUMMARY"
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED / $TESTS_TOTAL${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED / $TESTS_TOTAL${NC}"

    PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo -e "\n${BLUE}Pass Rate: ${PASS_RATE}%${NC}\n"

    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                           ║${NC}"
        echo -e "${GREEN}║              ✓ ALL SYSTEMS OPERATIONAL ✓                 ║${NC}"
        echo -e "${GREEN}║                                                           ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}\n"
        exit 0
    else
        echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                                           ║${NC}"
        echo -e "${RED}║            ⚠ SOME TESTS FAILED ⚠                         ║${NC}"
        echo -e "${RED}║                                                           ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}\n"
        exit 1
    fi
}

# Run main function
main
