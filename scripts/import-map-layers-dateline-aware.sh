#!/bin/bash

# Import map layers to PostgreSQL with proper dateline handling
# This script imports from the original WGS84 GeoJSON files and uses ogr2ogr's
# -wrapdateline option to properly handle geometries that cross the antimeridian

set -e

SOURCE_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_wgs84"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing map layers with dateline-aware processing..."
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Target database: localhost:5433/ixstats"
echo "Processing: Using -wrapdateline to handle antimeridian crossing"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory not found: $SOURCE_DIR"
  exit 1
fi

# Import each layer
for layer in political climate altitudes rivers lakes icecaps background; do
  INPUT_FILE="$SOURCE_DIR/${layer}.geojson"
  TABLE_NAME="map_layer_${layer}"

  if [ ! -f "$INPUT_FILE" ]; then
    echo "⚠️  Skipping $layer (file not found: $INPUT_FILE)"
    continue
  fi

  echo "📍 Importing $layer to table: $TABLE_NAME"

  # Use ogr2ogr with dateline wrapping
  # -wrapdateline: Automatically splits geometries at 180° meridian
  # This creates proper geometries for features near/crossing the dateline
  # without manually wrapping coordinates which breaks the geometry topology
  ogr2ogr \
    -f "PostgreSQL" \
    "$PG_CONNECTION" \
    -nln "$TABLE_NAME" \
    -overwrite \
    -wrapdateline \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=ogc_fid \
    -lco SPATIAL_INDEX=GIST \
    -t_srs EPSG:4326 \
    -s_srs EPSG:4326 \
    -sql "SELECT *, id as country_id FROM \"$layer\"" \
    "$INPUT_FILE"

  # Get feature count
  FEATURE_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -t -c "SELECT COUNT(*) FROM $TABLE_NAME;" | tr -d ' ')

  echo "   ✓ $layer imported ($FEATURE_COUNT features)"
  echo ""
done

echo "✅ All map layers imported with dateline handling!"
echo ""
echo "Dateline handling applied:"
echo "  - Geometries with coordinates >180° are automatically split at the antimeridian"
echo "  - This prevents world-spanning geometries for islands near the dateline"
echo "  - Countries like Oyashima (183°), Sotsial (192°), etc. now render correctly"
echo ""
echo "Database schema:"
echo "  - ogc_fid: Auto-generated feature ID (for MapLibre feature-state)"
echo "  - country_id: Original 'id' field (country/feature name)"
echo "  - geometry: PostGIS geometry (SRID 4326, WGS84)"
echo "  - fill: Color field"
echo ""
echo "Next steps:"
echo "1. Validate geometries: npx tsx scripts/validate-postgis-geometries.ts"
echo "2. Check specific countries:"
echo "   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \\"
echo "     -c \"SELECT country_id, ST_XMin(geometry), ST_XMax(geometry), (ST_XMax(geometry)-ST_XMin(geometry)) as span FROM map_layer_political WHERE country_id IN ('Oyashima', 'Metzetta', 'Daxia');\""
echo "3. Test vector tiles: curl http://localhost:3000/api/tiles/political/2/1/1"
echo ""
