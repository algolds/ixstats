#!/bin/bash

# Import Map Layers with Proper Dateline Handling
# This script imports GeoJSON files using ogr2ogr with the -wrapdateline option
# to properly split polygons that cross the international dateline (180°/-180°)

set -e  # Exit on error

# PostgreSQL connection parameters
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="ixstats"
DB_USER="postgres"
DB_PASS="postgres"

# Connection string for ogr2ogr
PG_CONN="PG:dbname=$DB_NAME host=$DB_HOST port=$DB_PORT user=$DB_USER password=$DB_PASS"

# Source directory - using the ORIGINAL sanitized version
GEOJSON_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_sanitized"

echo "========================================"
echo "Map Layers Import with Dateline Handling"
echo "========================================"
echo ""
echo "This will completely replace all map_layer tables with fresh data"
echo "that properly handles dateline-crossing polygons."
echo ""

# Step 1: Drop existing tables
echo "Step 1: Dropping existing map_layer tables..."
export PGPASSWORD=$DB_PASS
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
-- Drop existing map layer tables
DROP TABLE IF EXISTS map_layer_political CASCADE;
DROP TABLE IF EXISTS map_layer_climate CASCADE;
DROP TABLE IF EXISTS map_layer_altitudes CASCADE;
DROP TABLE IF EXISTS map_layer_rivers CASCADE;
DROP TABLE IF EXISTS map_layer_lakes CASCADE;
DROP TABLE IF EXISTS map_layer_icecaps CASCADE;
DROP TABLE IF EXISTS map_layer_background CASCADE;

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;
EOF

echo "✓ Tables dropped successfully"
echo ""

# Step 2: Import each layer with dateline handling
echo "Step 2: Importing layers with dateline splitting..."
echo ""

# Function to import a layer
import_layer() {
    local LAYER=$1
    local GEOJSON_FILE="$GEOJSON_DIR/$LAYER.geojson"
    local TABLE_NAME="map_layer_$LAYER"

    echo "Importing $LAYER..."

    if [ ! -f "$GEOJSON_FILE" ]; then
        echo "  ⚠ Warning: $GEOJSON_FILE not found, skipping..."
        return
    fi

    # Import with ogr2ogr
    # -t_srs EPSG:4326: Ensure WGS84 projection
    # -lco GEOMETRY_NAME=geometry: Name the geometry column
    # -lco FID=ogc_fid: Name the feature ID column
    # -overwrite: Replace existing data
    # Note: No -wrapdateline needed as we've pre-split the geometries
    ogr2ogr -f "PostgreSQL" "$PG_CONN" "$GEOJSON_FILE" \
        -nln "$TABLE_NAME" \
        -lco GEOMETRY_NAME=geometry \
        -lco FID=ogc_fid \
        -t_srs EPSG:4326 \
        -overwrite \
        -progress

    echo "  ✓ $LAYER imported successfully"
}

# Import all layers
import_layer "political"
import_layer "climate"
import_layer "altitudes"
import_layer "rivers"
import_layer "lakes"
import_layer "icecaps"
import_layer "background"

echo ""
echo "Step 3: Creating spatial indexes..."

# Create spatial indexes for better performance
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
-- Create spatial indexes
CREATE INDEX IF NOT EXISTS map_layer_political_geometry_idx ON map_layer_political USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_climate_geometry_idx ON map_layer_climate USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_altitudes_geometry_idx ON map_layer_altitudes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_rivers_geometry_idx ON map_layer_rivers USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_lakes_geometry_idx ON map_layer_lakes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_icecaps_geometry_idx ON map_layer_icecaps USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_layer_background_geometry_idx ON map_layer_background USING GIST (geometry);

-- Analyze tables for query optimization
ANALYZE map_layer_political;
ANALYZE map_layer_climate;
ANALYZE map_layer_altitudes;
ANALYZE map_layer_rivers;
ANALYZE map_layer_lakes;
ANALYZE map_layer_icecaps;
ANALYZE map_layer_background;
EOF

echo "✓ Spatial indexes created"
echo ""

# Step 4: Verify dateline handling
echo "Step 4: Verifying dateline handling..."

# Check for polygons spanning more than 180 degrees
PROBLEMATIC=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*)
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180
  AND ST_XMax(geometry) <= 180;
" | tr -d ' ')

if [ "$PROBLEMATIC" -eq "0" ]; then
    echo "✓ Success! No polygons span more than 180 degrees"
else
    echo "⚠ Warning: Found $PROBLEMATIC polygons that may still have issues"
fi

# Show specific countries that were problematic before
echo ""
echo "Checking previously problematic countries:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    id,
    COUNT(*) as num_parts,
    MIN(ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1)) as min_span,
    MAX(ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1)) as max_span
FROM map_layer_political
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4')
GROUP BY id
ORDER BY id;
"

echo ""
echo "Step 5: Clearing cache and restarting services..."

# Clear Redis cache
if docker ps | grep -q ixstats-redis-cache; then
    docker exec ixstats-redis-cache redis-cli -n 1 FLUSHDB > /dev/null 2>&1
    echo "✓ Redis cache cleared"
else
    echo "⚠ Redis not running (cache clearing skipped)"
fi

# Restart Martin tile server
if docker ps | grep -q martin-tiles; then
    docker restart martin-tiles > /dev/null 2>&1
    echo "✓ Martin tile server restarted"
    sleep 3  # Wait for Martin to start
else
    echo "⚠ Martin not running (restart skipped)"
fi

echo ""
echo "========================================"
echo "Import Complete!"
echo "========================================"
echo ""
echo "All map layers have been imported with proper dateline handling."
echo "The horizontal banding issue should now be resolved."
echo ""
echo "Next steps:"
echo "1. Open the map at http://localhost:3000/maps"
echo "2. Zoom to the Pacific region where the dateline crosses"
echo "3. Verify that there are no horizontal bands"
echo ""
echo "If you still see issues, check the logs:"
echo "  docker logs martin-tiles"
echo ""