#!/bin/bash

# Import sanitized map layers to PostgreSQL
# This script imports the cleaned/sanitized GeoJSON files with proper field mapping

set -e

SOURCE_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_sanitized"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing sanitized map layers to PostgreSQL..."
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Target database: localhost:5433/ixstats"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory not found: $SOURCE_DIR"
  echo "Please run sanitization first: npx tsx scripts/sanitize-geojson-coordinates.ts"
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

  # Use ogr2ogr with sanitized data
  # -sql renames 'id' field to 'country_id' to avoid conflict with auto-generated primary key
  # -lco GEOMETRY_NAME=geometry ensures consistent field naming (not wkb_geometry)
  # -lco FID=ogc_fid creates auto-incrementing feature ID for MapLibre feature-state
  # -lco SPATIAL_INDEX=GIST creates spatial index for performance
  # -t_srs EPSG:4326 ensures data is stored in WGS84
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

echo "✅ All sanitized map layers imported successfully!"
echo ""
echo "Database schema:"
echo "  - ogc_fid: Auto-generated feature ID (for MapLibre feature-state)"
echo "  - country_id: Original 'id' field (country/feature name)"
echo "  - geometry: PostGIS geometry (SRID 4326, WGS84)"
echo "  - fill: Color field"
echo "  - Other properties: Preserved from source GeoJSON"
echo ""
echo "Next steps:"
echo "1. Validate PostGIS geometries: npx tsx scripts/validate-postgis-geometries.ts"
echo "2. Test vector tiles: curl http://localhost:3000/api/tiles/political/2/1/1"
echo ""
