#!/bin/bash

# Import all transformed map layers to PostgreSQL with proper field mapping
set -e

SOURCE_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_wgs84"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing all map layers to PostgreSQL (with proper field mapping)..."
echo ""

# Import each layer
for layer in political climate altitudes rivers lakes icecaps background; do
  INPUT_FILE="$SOURCE_DIR/${layer}.geojson"
  TABLE_NAME="map_layer_${layer}"

  if [ ! -f "$INPUT_FILE" ]; then
    echo "⚠️  Skipping $layer (file not found)"
    continue
  fi

  echo "📍 Importing $layer to table: $TABLE_NAME"

  # Use -sql to rename 'id' field to 'country_id' to avoid conflict with auto-generated primary key
  ogr2ogr \
    -f "PostgreSQL" \
    "$PG_CONNECTION" \
    -nln "$TABLE_NAME" \
    -overwrite \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=ogc_fid \
    -lco SPATIAL_INDEX=GIST \
    -sql "SELECT *, id as country_id FROM \"$layer\"" \
    "$INPUT_FILE"

  # Get feature count
  FEATURE_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -t -c "SELECT COUNT(*) FROM $TABLE_NAME;" | tr -d ' ')

  echo "   ✓ $layer imported ($FEATURE_COUNT features)"
done

echo ""
echo "✅ All map layers imported successfully with proper field mapping!"
echo ""
echo "Field mapping:"
echo "  - ogc_fid: Auto-generated feature ID (for MapLibre feature-state)"
echo "  - country_id: Original 'id' field (country/feature name)"
echo "  - ixmap_subgroup: Subgroup field"
echo "  - fill: Color field"
echo "  - geometry: PostGIS geometry (SRID 4326)"
