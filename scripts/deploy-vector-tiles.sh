#!/bin/bash

# =============================================================================
# Vector Tiles Deployment Script
# =============================================================================
# This script deploys the vector tile implementation to production.
# It creates necessary indexes and verifies the deployment.
#
# Usage:
#   ./scripts/deploy-vector-tiles.sh [--production]
#
# Options:
#   --production    Deploy to production (default: development)
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT="development"

# Parse arguments
if [ "$1" == "--production" ]; then
    ENVIRONMENT="production"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Vector Tiles Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    exit 1
fi

# Step 1: Verify PostGIS is installed
echo -e "${YELLOW}Step 1: Verifying PostGIS installation...${NC}"
POSTGIS_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT PostGIS_Version();" 2>/dev/null || echo "")

if [ -z "$POSTGIS_VERSION" ]; then
    echo -e "${RED}Error: PostGIS is not installed${NC}"
    echo "Please install PostGIS extension first:"
    echo "  psql \$DATABASE_URL -c 'CREATE EXTENSION IF NOT EXISTS postgis;'"
    exit 1
fi

echo -e "${GREEN}✓ PostGIS installed: $POSTGIS_VERSION${NC}"
echo ""

# Step 2: Verify required tables exist
echo -e "${YELLOW}Step 2: Verifying required tables exist...${NC}"

REQUIRED_TABLES=(
    "temp_political_import"
    "map_layer_background"
    "map_layer_icecaps"
    "map_layer_altitudes"
    "map_layer_climate"
    "map_layer_lakes"
    "map_layer_rivers"
)

MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null || echo "f")

    if [ "$TABLE_EXISTS" != " t" ]; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required tables:${NC}"
    for table in "${MISSING_TABLES[@]}"; do
        echo "  - $table"
    done
    echo ""
    echo "Please import geographic data first using:"
    echo "  ./scripts/import-all-map-layers.sh"
    exit 1
fi

echo -e "${GREEN}✓ All required tables exist${NC}"
echo ""

# Step 3: Create spatial indexes
echo -e "${YELLOW}Step 3: Creating spatial indexes...${NC}"
echo "This may take 1-2 minutes for large datasets..."

psql "$DATABASE_URL" -f "$(dirname "$0")/create-vector-tile-indexes.sql" 2>&1 | grep -E "(CREATE INDEX|VACUUM|ERROR|WARNING)" || true

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}Error: Failed to create indexes${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Spatial indexes created successfully${NC}"
echo ""

# Step 4: Verify indexes
echo -e "${YELLOW}Step 4: Verifying indexes...${NC}"

INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%_geom_gist';" 2>/dev/null || echo "0")

if [ "$INDEX_COUNT" -lt 7 ]; then
    echo -e "${RED}Warning: Expected 7 spatial indexes, found $INDEX_COUNT${NC}"
    echo "Some indexes may not have been created successfully"
else
    echo -e "${GREEN}✓ All $INDEX_COUNT spatial indexes verified${NC}"
fi

echo ""

# Step 5: Performance test
echo -e "${YELLOW}Step 5: Testing tile generation performance...${NC}"

PERFORMANCE_TEST=$(psql "$DATABASE_URL" -t -c "
\timing on
WITH tile_bounds AS (
  SELECT ST_MakeEnvelope(-5009377.085697312, -2504688.542848654, -2504688.542848656, 0, 3857) AS geom
),
tile_features AS (
  SELECT
    ogc_fid,
    COALESCE(id, 'unknown') as name,
    fill,
    ST_AsMVTGeom(wkb_geometry, (SELECT geom FROM tile_bounds), 256, 0, true) as geom
  FROM temp_political_import
  WHERE wkb_geometry IS NOT NULL
    AND ST_Intersects(wkb_geometry, (SELECT geom FROM tile_bounds))
)
SELECT pg_column_size(ST_AsMVT(tile_features.*, 'political', 256, 'geom')) as tile_size_bytes
FROM tile_features
WHERE geom IS NOT NULL;
" 2>&1 | grep "Time:" || echo "Time: unknown")

echo "$PERFORMANCE_TEST"

# Extract time in milliseconds
TIME_MS=$(echo "$PERFORMANCE_TEST" | grep -oP 'Time: \K[0-9.]+' || echo "0")

if (( $(echo "$TIME_MS > 0.5" | bc -l) )); then
    echo -e "${YELLOW}Warning: Tile generation took ${TIME_MS}s (expected <0.2s)${NC}"
    echo "Consider running VACUUM ANALYZE on the tables"
else
    echo -e "${GREEN}✓ Tile generation performance: ${TIME_MS}s${NC}"
fi

echo ""

# Step 6: Deployment summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ PostGIS verified${NC}"
echo -e "${GREEN}✓ Required tables verified${NC}"
echo -e "${GREEN}✓ Spatial indexes created${NC}"
echo -e "${GREEN}✓ Performance test completed${NC}"
echo ""

if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}Next steps for production:${NC}"
    echo "1. Build application: npm run build"
    echo "2. Restart PM2: pm2 restart ixstats"
    echo "3. Test endpoint: curl http://localhost:3550/api/tiles/political/2/1/1"
    echo "4. Monitor logs: pm2 logs ixstats"
else
    echo -e "${YELLOW}Next steps for development:${NC}"
    echo "1. Start dev server: npm run dev"
    echo "2. Navigate to: http://localhost:3000/admin/maps"
    echo "3. Check debug panel shows: 'Mode: Vector Tiles (MVT)'"
    echo "4. Verify map loads in <2 seconds"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"

exit 0
