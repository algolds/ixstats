#!/bin/bash
# Test Custom Projection Endpoints
# Verifies all 18 projection functions are accessible via Martin and Next.js API

echo "========================================="
echo "Custom Projection Endpoint Testing"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL=0
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local url=$1
    local description=$2

    TOTAL=$((TOTAL + 1))

    # Make request and check HTTP status
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} $description (HTTP $http_code)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $description (HTTP $http_code)"
        FAILED=$((FAILED + 1))
    fi
}

echo "Testing Martin Tile Server (localhost:3800)..."
echo "-----------------------------------------------"

# Test all layer × projection combinations
layers=("political" "altitudes" "lakes" "rivers" "icecaps" "climate")
projections=("equalearth" "naturalearth" "ixmaps")

for layer in "${layers[@]}"; do
    for projection in "${projections[@]}"; do
        url="http://localhost:3800/mvt_${layer}_${projection}/2/1/1"
        test_endpoint "$url" "Martin: ${layer} × ${projection}"
    done
done

echo ""
echo "Testing Next.js API Proxy (localhost:3000)..."
echo "-----------------------------------------------"

for layer in "${layers[@]}"; do
    for projection in "${projections[@]}"; do
        url="http://localhost:3000/api/tiles/projections/${projection}/${layer}/2/1/1"
        test_endpoint "$url" "API: ${projection}/${layer}"
    done
done

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo "Failed: $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All projection endpoints working!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some endpoints failed. Check Martin and API logs.${NC}"
    exit 1
fi
