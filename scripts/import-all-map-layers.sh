#!/bin/bash

# Import all transformed map layers to PostgreSQL
set -e

SOURCE_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_wgs84"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing all map layers to PostgreSQL..."
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

  ogr2ogr \
    -f "PostgreSQL" \
    "$PG_CONNECTION" \
    -nln "$TABLE_NAME" \
    -overwrite \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=id \
    -lco SPATIAL_INDEX=GIST \
    "$INPUT_FILE"

  # Get feature count
  FEATURE_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -t -c "SELECT COUNT(*) FROM $TABLE_NAME;" | tr -d ' ')

  echo "   ✓ $layer imported ($FEATURE_COUNT features)"
done

echo ""
echo "✅ All map layers imported successfully!"
echo ""
echo "Layers imported:"
echo "  - map_layer_political (country boundaries)"
echo "  - map_layer_climate (climate zones)"
echo "  - map_layer_altitudes (elevation/terrain)"
echo "  - map_layer_rivers (rivers and waterways)"
echo "  - map_layer_lakes (lakes and water bodies)"
echo "  - map_layer_icecaps (polar ice coverage)"
echo "  - map_layer_background (base map features)"
