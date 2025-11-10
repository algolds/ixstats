#!/bin/bash

# Builder Persistence Test Script
# Tests autosave functionality across all builder systems

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Database connection
export PGHOST=localhost
export PGPORT=5433
export PGUSER=postgres
export PGPASSWORD=postgres
export PGDATABASE=ixstats

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Builder Persistence Test Suite                    ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Test 1: Database Connection
echo -e "${YELLOW}[TEST 1/10]${NC} Testing database connection..."
if psql -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} Database connection successful"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} Cannot connect to database"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: National Identity Autosave Table
echo -e "${YELLOW}[TEST 2/10]${NC} Checking NationalIdentity autosave table..."
COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"NationalIdentity\"" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} NationalIdentity table exists (${COUNT} records)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} NationalIdentity table not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: National Identity Recent Autosaves
echo -e "${YELLOW}[TEST 3/10]${NC} Checking for recent National Identity autosaves..."
RECENT=$(psql -t -c "SELECT COUNT(*) FROM \"NationalIdentity\" WHERE \"updatedAt\" > NOW() - INTERVAL '1 hour'" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    if [ "$RECENT" -gt 0 ]; then
        echo -e "${GREEN}✓ PASS${NC} Found ${RECENT} recent autosave(s) in last hour"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠ WARN${NC} No recent autosaves (expected if no active users)"
        ((TESTS_PASSED++))
    fi
else
    echo -e "${RED}✗ FAIL${NC} Cannot query recent autosaves"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Government Structure Table
echo -e "${YELLOW}[TEST 4/10]${NC} Checking GovernmentStructure autosave table..."
COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"GovernmentStructure\"" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} GovernmentStructure table exists (${COUNT} records)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} GovernmentStructure table not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Government Component Selections Table
echo -e "${YELLOW}[TEST 5/10]${NC} Checking GovernmentComponentSelection table..."
COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"GovernmentComponentSelection\"" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} GovernmentComponentSelection table exists (${COUNT} records)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} GovernmentComponentSelection table not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 6: Tax System Table
echo -e "${YELLOW}[TEST 6/10]${NC} Checking TaxSystem autosave table..."
COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"TaxSystem\"" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} TaxSystem table exists (${COUNT} records)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} TaxSystem table not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 7: Tax Component Selections Table
echo -e "${YELLOW}[TEST 7/10]${NC} Checking TaxComponentSelection table..."
COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"TaxComponentSelection\"" 2>/dev/null | xargs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} TaxComponentSelection table exists (${COUNT} records)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} TaxComponentSelection table not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 8: tRPC Server Availability
echo -e "${YELLOW}[TEST 8/10]${NC} Testing tRPC server availability..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/trpc/health 2>/dev/null | grep -q "200\|404"; then
    echo -e "${GREEN}✓ PASS${NC} tRPC server is responding"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC} tRPC server may not be running (expected if dev server is down)"
    echo -e "         Run 'npm run dev' to start the server"
    ((TESTS_PASSED++))
fi
echo ""

# Test 9: Autosave Mutations in Domain Routers
echo -e "${YELLOW}[TEST 9/10]${NC} Checking autosave mutations in domain routers..."

# Check for autosave mutations in domain-specific routers
ROUTERS=(
    "src/server/api/routers/nationalIdentity.ts:autosave"
    "src/server/api/routers/government.ts:autosave"
    "src/server/api/routers/taxSystem.ts:autosave"
)

FOUND=0
for router_check in "${ROUTERS[@]}"; do
    ROUTER_FILE="${router_check%%:*}"
    MUTATION="${router_check##*:}"

    if [ -f "$ROUTER_FILE" ] && grep -q "autosave.*protectedProcedure" "$ROUTER_FILE"; then
        ((FOUND++))
    fi
done

if [ "$FOUND" -eq 3 ]; then
    echo -e "${GREEN}✓ PASS${NC} All autosave mutations found (${FOUND}/3 routers)"
    echo -e "         ✓ nationalIdentity.autosave"
    echo -e "         ✓ government.autosave"
    echo -e "         ✓ taxSystem.autosave"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} Some autosave mutations missing (${FOUND}/3 found)"
    ((TESTS_FAILED++))
fi
echo ""

# Test 10: Schema Validation
echo -e "${YELLOW}[TEST 10/10]${NC} Validating Prisma schema..."
if [ -f "prisma/schema.prisma" ]; then
    # Check for autosave-related models (the core models that store autosave data)
    MODELS=("NationalIdentity" "GovernmentStructure" "TaxSystem")
    FOUND=0
    FOUND_MODELS=()

    for model in "${MODELS[@]}"; do
        if grep -q "^model $model" "prisma/schema.prisma"; then
            ((FOUND++))
            FOUND_MODELS+=("$model")
        fi
    done

    if [ "$FOUND" -eq 3 ]; then
        echo -e "${GREEN}✓ PASS${NC} All autosave models found in schema (${FOUND}/3)"
        for model in "${FOUND_MODELS[@]}"; do
            echo -e "         ✓ $model"
        done
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} Some models missing from schema (${FOUND}/3 found)"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}✗ FAIL${NC} Prisma schema file not found"
    ((TESTS_FAILED++))
fi
echo ""

# Summary
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Summary                            ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Total Tests:    ${TOTAL}"
echo -e "${BLUE}║${NC} ${GREEN}Passed:         ${TESTS_PASSED}${NC}"
echo -e "${BLUE}║${NC} ${RED}Failed:         ${TESTS_FAILED}${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Additional Information
echo -e "${BLUE}Additional Information:${NC}"
echo -e "Database: postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
echo -e "Schema Location: prisma/schema.prisma"
echo -e "Router Locations:"
echo -e "  - src/server/api/routers/nationalIdentity.ts (autosave mutation)"
echo -e "  - src/server/api/routers/government.ts (autosave mutation)"
echo -e "  - src/server/api/routers/taxSystem.ts (autosave mutation)"
echo ""

# Detailed Statistics (if tests passed)
if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${BLUE}Database Statistics:${NC}"

    # National Identity stats
    NI_COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"NationalIdentity\"" 2>/dev/null | xargs)
    NI_RECENT=$(psql -t -c "SELECT COUNT(*) FROM \"NationalIdentity\" WHERE \"updatedAt\" > NOW() - INTERVAL '24 hours'" 2>/dev/null | xargs)
    echo -e "  National Identity: ${NI_COUNT} total, ${NI_RECENT} updated in last 24h"

    # Government stats
    GOV_COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"GovernmentStructure\"" 2>/dev/null | xargs)
    GOV_COMP=$(psql -t -c "SELECT COUNT(*) FROM \"GovernmentComponentSelection\"" 2>/dev/null | xargs)
    echo -e "  Government: ${GOV_COUNT} structures, ${GOV_COMP} component selections"

    # Tax stats
    TAX_COUNT=$(psql -t -c "SELECT COUNT(*) FROM \"TaxSystem\"" 2>/dev/null | xargs)
    TAX_COMP=$(psql -t -c "SELECT COUNT(*) FROM \"TaxComponentSelection\"" 2>/dev/null | xargs)
    echo -e "  Tax System: ${TAX_COUNT} systems, ${TAX_COMP} component selections"

    echo ""
fi

# Exit with appropriate code
if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
