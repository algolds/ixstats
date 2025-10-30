#!/bin/bash

# Transform GeoJSON from custom IxMaps CRS to true WGS84 (EPSG:4326)
#
# The source data uses a custom Equidistant Cylindrical projection with:
# - Prime meridian shifted to 26.09°
# - Proj4: +proj=eqc +lat_ts=0 +lat_0=0 +lon_0=26.09 +x_0=0 +y_0=0 +ellps=WGS84 +pm=26.09 +units=m +no_defs +type=crs
#
# This script transforms it to proper WGS84 for use in MapLibre GL JS

set -e

SOURCE_DIR="/ixwiki/public/projects/maps/scripting/geojson_4326"
OUTPUT_DIR="/ixwiki/public/projects/ixstats/scripts/geojson_transformed"

# Custom IxMaps CRS definition
IXMAPS_CRS='+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=26.09 +x_0=0 +y_0=0 +ellps=WGS84 +pm=26.09 +units=m +no_defs +type=crs'

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🗺️  Transforming GeoJSON from IxMaps CRS to WGS84..."
echo ""

# Transform each layer
for layer in political climate altitudes rivers lakes icecaps background; do
  INPUT_FILE="$SOURCE_DIR/${layer}.geojson"
  OUTPUT_FILE="$OUTPUT_DIR/${layer}.geojson"

  if [ ! -f "$INPUT_FILE" ]; then
    echo "⚠️  Skipping $layer (file not found)"
    continue
  fi

  echo "📍 Transforming $layer..."

  ogr2ogr \
    -f "GeoJSON" \
    -s_srs "$IXMAPS_CRS" \
    -t_srs "EPSG:4326" \
    -dim XY \
    "$OUTPUT_FILE" \
    "$INPUT_FILE"

  # Get feature count
  COUNT=$(ogrinfo -so "$OUTPUT_FILE" "$layer" 2>/dev/null | grep "Feature Count" | awk '{print $3}' || echo "unknown")

  echo "   ✓ $layer transformed ($COUNT features)"
done

echo ""
echo "✅ Transformation complete! Transformed files in: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Import political boundaries to PostgreSQL:"
echo "   ogr2ogr -f \"PostgreSQL\" PG:\"host=localhost port=5433 dbname=ixstats user=postgres\" \\"
echo "     $OUTPUT_DIR/political.geojson \\"
echo "     -nln temp_political_import -overwrite"
echo ""
echo "2. Run the import script:"
echo "   DATABASE_URL=\"postgresql://postgres:postgres@localhost:5433/ixstats\" npx tsx scripts/import-geographic-boundaries.ts"
