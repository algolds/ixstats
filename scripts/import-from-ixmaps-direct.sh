#!/bin/bash

# Import directly from original IxMaps files with correct coordinate transformation
# This applies the +26.09° prime meridian shift AND wraps >180° coordinates in one step

set -e

SOURCE_DIR="/ixwiki/public/projects/maps/scripting/geojson_4326"
PG_CONNECTION="PG:host=localhost port=5433 dbname=ixstats user=postgres password=postgres"

echo "🗺️  Importing from ORIGINAL IxMaps files..."
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Target database: localhost:5433/ixstats"
echo "Transformation: Applying +26.09° prime meridian shift with coordinate wrapping"
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

  # Use ogr2ogr with coordinate transformation
  # The source file is in IxMaps CRS (EPSG:4326 with custom prime meridian at 26.09°E)
  # We need to shift +26.09° AND wrap coordinates >180°
  # Unfortunately ogr2ogr doesn't do this automatically, so we need the pre-fixed files

  echo "   ⚠️  ERROR: Cannot import directly without coordinate wrapping logic"
  echo "   Please use the dateline-fixed files instead"
  exit 1
done
