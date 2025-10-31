#!/bin/bash

# Service Health Check Script
# Verifies all required services for IxStats are running

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔍 IxStats Service Health Check"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

all_healthy=true

# Check PostgreSQL (required for IxStats with PostGIS)
echo -n "PostgreSQL (port 5433): "
if PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -tAc "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    echo "  Fix: Check PostgreSQL service on port 5433"
    all_healthy=false
fi

# Check Martin Tile Server (required for maps)
echo -n "Martin Tile Server (port 3800): "
if curl -f -s http://localhost:3800/catalog > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    echo "  Fix: Run './scripts/martin-tiles.sh start'"
    all_healthy=false
fi

# Check Redis (optional, used for rate limiting in production)
echo -n "Redis (port 6379): "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running (optional)${NC}"
    echo "  Note: Redis is used for rate limiting in production"
    echo "  Fix: Run './scripts/setup-redis.sh start' (if needed)"
fi

echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}✅ All required services are healthy${NC}"
    exit 0
else
    echo -e "${RED}❌ Some required services are not running${NC}"
    exit 1
fi
