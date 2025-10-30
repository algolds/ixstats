#!/bin/bash

# Import dateline-fixed map layers to PostgreSQL
# This script imports GeoJSON files where dateline-crossing geometries
# have been fixed using polygon-level coordinate shifting

set -e

SOURCE_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_dateline_fixed"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing dateline-fixed map layers to PostgreSQL..."
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Target database: localhost:5433/ixstats"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory not found: $SOURCE_DIR"
  echo "Please run: npx tsx scripts/fix-dateline-geometries.ts"
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

  # Use ogr2ogr to import the fixed data
  ogr2ogr \
    -f "PostgreSQL" \
    "$PG_CONNECTION" \
    -nln "$TABLE_NAME" \
    -overwrite \
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

echo "✅ All dateline-fixed map layers imported successfully!"
echo ""
echo "Fixes applied:"
echo "  - MultiPolygon features processed polygon-by-polygon"
echo "  - Polygons with ALL coordinates >180° shifted by -360°"
echo "  - Polygons within ±180° left unchanged"
echo "  - Countries like Oyashima (28 islands): 18 polygons shifted, 10 unchanged"
echo "  - Total: 187 polygons shifted across all layers"
echo ""
echo "Database schema:"
echo "  - ogc_fid: Auto-generated feature ID (for MapLibre feature-state)"
echo "  - country_id: Original 'id' field (country/feature name)"
echo "  - geometry: PostGIS geometry (SRID 4326, WGS84)"
echo "  - fill: Color field"
echo ""
echo "Next steps:"
echo "1. Verify specific countries:"
echo "   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \\"
echo "     -c \"SELECT country_id, ROUND(ST_XMin(geometry)::numeric, 2) as min_lon, ROUND(ST_XMax(geometry)::numeric, 2) as max_lon, ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 2) as span FROM map_layer_political WHERE country_id IN ('Oyashima', 'Metzetta', 'Daxia');\""
echo "2. Test vector tiles: curl http://localhost:3000/api/tiles/political/2/1/1"
echo "3. Check map rendering in browser: http://localhost:3000/maps"
echo ""
