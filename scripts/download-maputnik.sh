#!/usr/bin/env bash
set -euo pipefail

# Scripts to download and host Maputnik pre-compiled assets locally.
# Scrapes the latest hashed assets from MapLibre's live production hosting.

TARGET_DIR="public/admin/maputnik"
ASSETS_DIR="$TARGET_DIR/assets"

echo "Creating directories..."
mkdir -p "$ASSETS_DIR"

echo "Downloading index.html..."
curl -sS "https://maplibre.org/maputnik/index.html" > "$TARGET_DIR/index.html"

# Extract asset names using grep/sed
MANIFEST=$(grep -o 'assets/manifest-[^"]*\.json' "$TARGET_DIR/index.html" | cut -d/ -f2)
FAVICON=$(grep -o 'assets/favicon-[^"]*\.ico' "$TARGET_DIR/index.html" | cut -d/ -f2)
JS_FILE=$(grep -o 'assets/index-[^"]*\.js' "$TARGET_DIR/index.html" | cut -d/ -f2)
CSS_FILE=$(grep -o 'assets/index-[^"]*\.css' "$TARGET_DIR/index.html" | cut -d/ -f2)

echo "Found assets:"
echo "  Manifest: $MANIFEST"
echo "  Favicon:  $FAVICON"
echo "  JS:       $JS_FILE"
echo "  CSS:      $CSS_FILE"

echo "Downloading asset files..."
curl -sS "https://maplibre.org/maputnik/assets/$MANIFEST" > "$ASSETS_DIR/$MANIFEST"
curl -sS "https://maplibre.org/maputnik/assets/$FAVICON" > "$ASSETS_DIR/$FAVICON"
curl -sS "https://maplibre.org/maputnik/assets/$JS_FILE" > "$ASSETS_DIR/$JS_FILE"
curl -sS "https://maplibre.org/maputnik/assets/$CSS_FILE" > "$ASSETS_DIR/$CSS_FILE"

echo "Patching index.html to use relative paths..."
# Replace /maputnik/assets/ with ./assets/
sed -i 's|/maputnik/assets/|./assets/|g' "$TARGET_DIR/index.html"

echo "Maputnik assets successfully installed to $TARGET_DIR!"
ls -la "$TARGET_DIR"
ls -la "$ASSETS_DIR"
