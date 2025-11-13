#!/bin/bash

# Map System Health Check Script
# Checks all components of the IxStats map system

echo "========================================"
echo "IxStats Map System Health Check"
echo "========================================"
echo ""

# 1. Check PostgreSQL/PostGIS
echo "1. PostgreSQL/PostGIS Status:"
export PGPASSWORD=postgres
if psql -U postgres -h localhost -p 5433 -d ixstats -c "SELECT PostGIS_version();" > /dev/null 2>&1; then
    echo "   ✓ PostgreSQL is running"
    echo "   ✓ PostGIS extension is loaded"

    # Check for dateline-crossing issues
    CROSSING_COUNT=$(psql -U postgres -h localhost -p 5433 -d ixstats -t -c "SELECT COUNT(*) FROM map_layer_political WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180 AND ST_XMax(geometry) <= 180;" | tr -d ' ')
    if [ "$CROSSING_COUNT" -eq "0" ]; then
        echo "   ✓ No dateline-crossing issues detected"
    else
        echo "   ⚠ Warning: $CROSSING_COUNT polygons have dateline-crossing issues"
    fi
else
    echo "   ✗ PostgreSQL connection failed"
fi
echo ""

# 2. Check Martin Tile Server
echo "2. Martin Tile Server:"
if docker ps | grep -q martin-tiles; then
    echo "   ✓ Martin container is running"

    if curl -s http://localhost:3800/catalog > /dev/null 2>&1; then
        echo "   ✓ Martin API is responding"
        LAYERS=$(curl -s http://localhost:3800/catalog | jq -r '.tiles | keys | length')
        echo "   ✓ Serving $LAYERS map layers"
    else
        echo "   ✗ Martin API not responding"
    fi
else
    echo "   ✗ Martin container not running"
fi
echo ""

# 3. Check Redis Cache
echo "3. Redis Cache:"
if docker ps | grep -q ixstats-redis-cache; then
    echo "   ✓ Redis container is running"

    if docker exec ixstats-redis-cache redis-cli PING > /dev/null 2>&1; then
        echo "   ✓ Redis is responding"
        KEYS=$(docker exec ixstats-redis-cache redis-cli -n 1 DBSIZE | cut -d' ' -f2)
        echo "   ✓ Cache contains $KEYS"
    else
        echo "   ✗ Redis not responding"
    fi
else
    echo "   ✗ Redis container not running"
fi
echo ""

# 4. Check Next.js API
echo "4. Next.js Tile API:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tiles/political/0/0/0 | grep -q "200"; then
    echo "   ✓ Tile API is responding"

    # Test a few tiles
    SUCCESS=0
    TOTAL=0
    for layer in political climate altitudes rivers; do
        TOTAL=$((TOTAL + 1))
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tiles/$layer/2/1/1 | grep -q "200"; then
            SUCCESS=$((SUCCESS + 1))
        fi
    done
    echo "   ✓ Tile generation working ($SUCCESS/$TOTAL layers tested)"
else
    echo "   ✗ Tile API not responding"
fi
echo ""

# 5. Summary
echo "========================================"
echo "Summary:"
echo "========================================"

ISSUES=0

# Check each component
if ! psql -U postgres -h localhost -p 5433 -d ixstats -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ PostgreSQL is DOWN"
    ISSUES=$((ISSUES + 1))
fi

if ! docker ps | grep -q martin-tiles; then
    echo "❌ Martin is DOWN"
    ISSUES=$((ISSUES + 1))
fi

if ! docker ps | grep -q ixstats-redis-cache; then
    echo "⚠️  Redis is DOWN (performance will be degraded)"
fi

CROSSING_COUNT=$(psql -U postgres -h localhost -p 5433 -d ixstats -t -c "SELECT COUNT(*) FROM map_layer_political WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180 AND ST_XMax(geometry) <= 180;" 2>/dev/null | tr -d ' ')
if [ "$CROSSING_COUNT" != "0" ] && [ -n "$CROSSING_COUNT" ]; then
    echo "⚠️  Dateline-crossing issues detected in political layer"
    echo "   Run: psql -d ixstats -f scripts/fix-dateline-crossing-v2.sql"
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ All map system components are healthy!"
else
    echo "❌ Found $ISSUES critical issues that need attention"
fi
echo ""