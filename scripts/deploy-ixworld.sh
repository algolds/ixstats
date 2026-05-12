#!/bin/bash
# deploy-ixworld.sh - Build and deploy IxWorld standalone maps app
#
# Usage: ./scripts/deploy-ixworld.sh
#
# Builds the IxStats codebase with BASE_PATH="" for maps.ixwiki.com,
# deploys to /ixwiki/public/maps/ixworld/, and restarts PM2.
# Does NOT rebuild IxStats (that runs in dev mode separately).

set -e

IXSTATS_DIR="/ixwiki/public/projects/ixstats"
IXWORLD_DIR="/ixwiki/public/maps/ixworld"

cd "$IXSTATS_DIR"

echo "=== IxWorld Standalone Build & Deploy ==="

# Step 1: Build
echo "[1/3] Building..."
BASE_PATH="" \
NEXT_PUBLIC_BASE_PATH="" \
NEXT_PUBLIC_IXWORLD_STANDALONE=true \
NODE_ENV=production \
bunx next build 2>&1 | grep -E "Route|✓|✗|Error|error" | tail -5

# Step 2: Deploy
echo "[2/3] Deploying to $IXWORLD_DIR..."
rm -rf "$IXWORLD_DIR"
mkdir -p "$IXWORLD_DIR"
rsync -a .next/standalone/ "$IXWORLD_DIR/"
mkdir -p "$IXWORLD_DIR/.next/static"
rsync -a .next/static/ "$IXWORLD_DIR/.next/static/"
cp -r public "$IXWORLD_DIR/public"
cp "$IXSTATS_DIR/ecosystem.ixworld.config.cjs" "$IXWORLD_DIR/" 2>/dev/null || true

# Step 3: Restart PM2
echo "[3/3] Restarting PM2..."
pm2 delete ixworld 2>/dev/null || true
pm2 start "$IXWORLD_DIR/ecosystem.ixworld.config.cjs" --silent
pm2 save --silent 2>/dev/null || true

echo "=== Done ==="
pm2 list | grep ixworld
