#!/bin/bash
# deploy-ixworld.sh - Optimized Build and Deploy for IxWorld standalone maps
#
# Usage: ./scripts/deploy-ixworld.sh
#
# Improvements:
# - Lockfile to prevent concurrent deploys
# - Atomic-style update using rsync (no rm -rf)
# - Graceful PM2 management (reload instead of delete/start)
# - Comprehensive logging to /ixwiki/private/logs/deploy-ixworld.log

set -euo pipefail

# --- Configuration ---
IXSTATS_DIR="/ixwiki/public/projects/ixstats"
IXWORLD_DIR="/ixwiki/public/maps/ixworld"
LOG_FILE="/ixwiki/private/logs/deploy-ixworld.log"
LOCK_FILE="/tmp/deploy-ixworld.lock"
PM2_APP_NAME="ixworld"
ECOSYSTEM_FILE="ecosystem.ixworld.config.cjs"

# --- Setup Logging ---
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Pre-flight Checks ---
log "=== Starting IxWorld Deployment ==="

# 1. Lockfile check
if [ -f "$LOCK_FILE" ]; then
    log "ERROR: Deployment already in progress (lockfile exists at $LOCK_FILE)"
    exit 1
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# 2. Check dependencies
for cmd in bun bunx pm2 rsync; do
    if ! command -v "$cmd" &> /dev/null; then
        log "ERROR: Required command '$cmd' not found."
        exit 1
    fi
done

cd "$IXSTATS_DIR"

# Step 1: Install & Build
log "[1/3] Preparing build environment..."
# bun install --frozen-lockfile # Optional: Ensure dependencies are fresh

log "[1/3] Building Next.js application..."
# Export variables for the build process
export BASE_PATH=""
export NEXT_PUBLIC_BASE_PATH=""
export NEXT_PUBLIC_IXWORLD_STANDALONE=true
export NEXT_PUBLIC_CLERK_DOMAIN="clerk.ixwiki.com"
export NEXT_PUBLIC_CLERK_SIGN_IN_URL="https://accounts.ixwiki.com/sign-in"
export NEXT_PUBLIC_CLERK_SIGN_UP_URL="https://accounts.ixwiki.com/sign-up"
export NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="https://maps.ixwiki.com/maps"
export NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="https://maps.ixwiki.com/maps"
export NODE_ENV=production

# Clean old build
rm -rf .next

# Run build
if ! bunx next build; then
    log "ERROR: Build failed!"
    exit 1
fi

# Step 2: Deploy
log "[2/3] Deploying to $IXWORLD_DIR..."
mkdir -p "$IXWORLD_DIR"

# Sync standalone output
# --delete ensures old files are removed, but existing files are kept until replaced
rsync -avh --delete .next/standalone/ "$IXWORLD_DIR/"
rsync -avh --delete .next/static/ "$IXWORLD_DIR/.next/static/"
rsync -avh --delete public/ "$IXWORLD_DIR/public/"

# Sync PM2 config
if [ -f "$ECOSYSTEM_FILE" ]; then
    cp "$ECOSYSTEM_FILE" "$IXWORLD_DIR/"
fi

# Step 3: PM2 Management
log "[3/3] Updating PM2 process..."
if pm2 show "$PM2_APP_NAME" &>/dev/null; then
    log "Reloading existing PM2 process..."
    pm2 reload "$PM2_APP_NAME" --silent
else
    log "Starting new PM2 process..."
    pm2 start "$IXWORLD_DIR/$ECOSYSTEM_FILE" --silent
fi

pm2 save --silent &>/dev/null

log "=== Deployment Successful ==="
pm2 status "$PM2_APP_NAME" | grep "$PM2_APP_NAME"
