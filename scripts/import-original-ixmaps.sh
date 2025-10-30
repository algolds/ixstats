#!/bin/bash

# Import ORIGINAL IxMaps files without any transformation
# This uses the raw IxMaps coordinates (no prime meridian shift, no dateline fixing)
# Maps will be positioned at IxMaps original location, but without crazy boundaries

set -e

SOURCE_DIR="/ixwiki/public/projects/maps/scripting/geojson_4326"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing ORIGINAL IxMaps files (NO transformation)..."
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Target database: localhost:5433/ixstats"
echo "⚠️  NO prime meridian shift applied - using raw IxMaps coordinates"
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

  # Import directly without any transformation
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

echo "✅ Original IxMaps data imported successfully!"
echo ""
echo "⚠️  IMPORTANT: Map is using ORIGINAL IxMaps coordinates"
echo "   - NO prime meridian shift applied"
echo "   - Countries appear at their IxMaps location (not WGS84 standard)"
echo "   - NO dateline crossing issues (all coords in range ~130-200°)"
echo ""
echo "Next steps:"
echo "1. Check coordinates: PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \\"
echo "     -c \"SELECT country_id, ROUND(ST_XMin(geometry)::numeric, 2) as min_lon, ROUND(ST_XMax(geometry)::numeric, 2) as max_lon FROM map_layer_political WHERE country_id='Oyashima';\""
echo "2. Test vector tiles: curl http://localhost:3000/api/tiles/political/2/1/1"
echo "3. View map: http://localhost:3000/maps"
echo ""
