#!/bin/bash
# deploy-ixworld.sh - Build and deploy the IxWorld standalone maps app (maps.ixwiki.com).
#
# Usage: ./scripts/deploy-ixworld.sh
#
# Behaviour (see docs/audits/AUDIT_2026-06.md, findings D1-D8):
# - Builds the IxWorld-flavoured Next.js standalone bundle WITHOUT clobbering the
#   IxStats production `.next` (the IxStats prod server runs `next start` from it).
#   The existing `.next` is saved aside before the build and restored afterwards. (D1)
# - flock-based lock so a crashed deploy never wedges future deploys. (D6)
# - Snapshot of the current release (hardlinks) before swap, with automatic rollback
#   if the post-deploy health check fails. (D3)
# - Graceful `pm2 startOrReload` instead of delete/start. (D2)
# - HTTP health probe against the running app before declaring success. (D4)
# - Log rotation so the deploy log does not grow without bound. (D7)

set -euo pipefail

# --- Configuration ---
IXSTATS_DIR="/ixwiki/public/projects/ixstats"
IXWORLD_DIR="/ixwiki/public/maps/ixworld"
LOG_FILE="/ixwiki/private/logs/deploy-ixworld.log"
LOCK_FILE="/tmp/deploy-ixworld.lock"
PM2_APP_NAME="ixworld"
ECOSYSTEM_FILE="ecosystem.ixworld.config.cjs"
HEALTH_URL="http://127.0.0.1:3002/maps"
HEALTH_RETRIES=20
HEALTH_INTERVAL=3
SAVED_NEXT="$IXSTATS_DIR/.next.ixstats-saved"
PREV_RELEASE="${IXWORLD_DIR}.prev"

# --- Setup Logging (with simple rotation) ---
mkdir -p "$(dirname "$LOG_FILE")"
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 10485760 ]; then
    mv -f "$LOG_FILE" "${LOG_FILE}.1"
fi
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Lockfile (flock: auto-released on any exit, including kill -9) ---
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    log "ERROR: Deployment already in progress (could not acquire lock at $LOCK_FILE)"
    exit 1
fi

log "=== Starting IxWorld Deployment ==="

# --- Restore the saved IxStats .next if a previous run died mid-deploy ---
restore_next() {
    if [ -d "$SAVED_NEXT" ]; then
        log "Restoring IxStats .next from saved copy..."
        rm -rf "$IXSTATS_DIR/.next"
        mv "$SAVED_NEXT" "$IXSTATS_DIR/.next"
    fi
}
trap 'restore_next' EXIT

# If a previous deploy died mid-run, recover the saved IxStats .next before we touch it.
restore_next

# 1. Check dependencies
for cmd in bun pm2 rsync flock curl; do
    if ! command -v "$cmd" &> /dev/null; then
        log "ERROR: Required command '$cmd' not found."
        exit 1
    fi
done

cd "$IXSTATS_DIR"

# Auto git sync if in production VPS directory
if [ "$(pwd)" = "/ixwiki/public/projects/ixstats" ]; then
    log "Production directory detected. Force-syncing with the latest git commit..."
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "v2")
    if [ -z "$CURRENT_BRANCH" ]; then
        CURRENT_BRANCH="v2"
    fi
    log "Fetching $CURRENT_BRANCH from master and resetting --hard to FETCH_HEAD..."
    git fetch master "$CURRENT_BRANCH"
    git checkout -f "$CURRENT_BRANCH"
    git reset --hard FETCH_HEAD
    git clean -fd
    log "Git sync complete. Current commit: $(git log -1 --oneline)"
fi

# Step 1: Install & Build (isolated from the IxStats production .next)
log "[1/4] Preparing build environment..."
bun install --frozen-lockfile

# Run environment verification (ensures DB, Redis, and Kokoro config are valid)
log "Verifying deployment environment..."
if ! NODE_ENV=production bun run verify:environment; then
    log "ERROR: Environment verification failed! Fix environment issues before deploying."
    exit 1
fi

bun run prebuild

# Save the existing IxStats .next so the IxWorld build does not clobber it. (D1)
if [ -d ".next" ]; then
    log "Saving existing IxStats .next -> $SAVED_NEXT"
    rm -rf "$SAVED_NEXT"
    mv ".next" "$SAVED_NEXT"
fi

log "[2/4] Building Next.js application (IxWorld standalone)..."
export BASE_PATH=""
export NEXT_PUBLIC_BASE_PATH=""
export NEXT_PUBLIC_IXWORLD_STANDALONE=true
export NEXT_PUBLIC_CLERK_DOMAIN="clerk.ixwiki.com"
export NEXT_PUBLIC_CLERK_SIGN_IN_URL="https://accounts.ixwiki.com/sign-in"
export NEXT_PUBLIC_CLERK_SIGN_UP_URL="https://accounts.ixwiki.com/sign-up"
export NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="https://maps.ixwiki.com/maps"
export NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="https://maps.ixwiki.com/maps"
# Deprecated: suppress Clerk afterSignInUrl/afterSignUpUrl from .env.production.local
export NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=""
export NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=""
export NODE_ENV=production

if ! bun run next build; then
    log "ERROR: Build failed! IxStats .next will be restored on exit."
    exit 1
fi

# Step 2: Snapshot current release for rollback, then deploy
log "[3/4] Deploying to $IXWORLD_DIR..."
mkdir -p "$IXWORLD_DIR"

# Hardlink snapshot of the current release (instant, space-efficient). rsync replaces
# files via temp+rename so the snapshot's inodes are preserved for rollback. (D3)
if [ -d "$IXWORLD_DIR" ] && [ -n "$(ls -A "$IXWORLD_DIR" 2>/dev/null)" ]; then
    log "Snapshotting current release -> $PREV_RELEASE"
    rm -rf "$PREV_RELEASE"
    cp -al "$IXWORLD_DIR" "$PREV_RELEASE" 2>/dev/null || cp -a "$IXWORLD_DIR" "$PREV_RELEASE"
fi

# Sync standalone output. Note: standalone server.js expects static under .next/static
# and the public/ dir alongside it.
rsync -ah --delete .next/standalone/ "$IXWORLD_DIR/"
rsync -ah --delete .next/static/ "$IXWORLD_DIR/.next/static/"
rsync -ah --delete \
    --exclude 'images/discord' \
    --exclude 'images/uploads' \
    --exclude 'images/downloaded' \
    public/ "$IXWORLD_DIR/public/"

# Ensure shared dynamic assets are symlinked to preserve real-time updates
ln -sfn "$IXSTATS_DIR/public/images/discord" "$IXWORLD_DIR/public/images/discord"
ln -sfn "$IXSTATS_DIR/public/images/uploads" "$IXWORLD_DIR/public/images/uploads"
ln -sfn "$IXSTATS_DIR/public/images/downloaded" "$IXWORLD_DIR/public/images/downloaded"

# data/ holds runtime-generated content (cache, etc.) and is not build output, so do NOT
# use --delete here. (D8)
if [ -d "data" ]; then
    rsync -ah data/ "$IXWORLD_DIR/data/"
fi

# Sync PM2 config
if [ -f "$ECOSYSTEM_FILE" ]; then
    cp "$ECOSYSTEM_FILE" "$IXWORLD_DIR/"
fi

# Step 3: Graceful PM2 reload (starts if absent, reloads if present) (D2)
log "[4/4] Reloading PM2 processes..."
pm2 startOrReload "$IXWORLD_DIR/$ECOSYSTEM_FILE" --silent
pm2 save --silent &>/dev/null

# Step 4: Health check with automatic rollback (D4)
log "Running health check against $HEALTH_URL ..."
healthy=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)"
    # Any non-5xx, non-000 response means the server is up and routing.
    if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
        log "Health check passed (HTTP $code) on attempt $i."
        healthy=true
        break
    fi
    log "Health check attempt $i/$HEALTH_RETRIES: HTTP $code — retrying in ${HEALTH_INTERVAL}s..."
    sleep "$HEALTH_INTERVAL"
done

if [ "$healthy" != "true" ]; then
    log "ERROR: Health check failed after $HEALTH_RETRIES attempts."
    if [ -d "$PREV_RELEASE" ]; then
        log "Rolling back to previous release..."
        rsync -ah --delete "$PREV_RELEASE/" "$IXWORLD_DIR/"
        pm2 startOrReload "$IXWORLD_DIR/$ECOSYSTEM_FILE" --silent
        pm2 save --silent &>/dev/null
        log "Rollback complete."
    else
        log "No previous release snapshot available for rollback."
    fi
    exit 1
fi

log "=== Deployment Successful ==="
pm2 status "$PM2_APP_NAME" | grep "$PM2_APP_NAME" || true
