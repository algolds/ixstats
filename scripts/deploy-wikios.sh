#!/bin/bash
# deploy-wikios.sh - Build and deploy the WikiOS standalone app (ixwiki.com/wiki/*, port 3560).
#
# Usage: ./scripts/deploy-wikios.sh
#
# Structure copied from scripts/deploy-ixworld.sh (plan 417); the differences are the target
# (WIKIOS_DIR, PM2 app `wikios`, port 3560) and the build flags (NEXT_PUBLIC_WIKIOS_STANDALONE).
#
# Prerequisites (one-time, see docs/operations/wikios-v1-cutover.md):
# - The server's next.config.js resolveBasePath() honours NEXT_PUBLIC_WIKIOS_STANDALONE
#   (deploy/wikios/next-config-snippet.md).
# - $WIKIOS_DIR/ecosystem.wikios.config.cjs exists (copy of
#   deploy/wikios/ecosystem.wikios.config.cjs.example) and $WIKIOS_DIR/.env.production.local holds
#   the runtime environment. Both are preserved across deploys.
#
# Behaviour:
# - Builds the WikiOS-flavoured Next.js standalone bundle WITHOUT clobbering the IxStats
#   production `.next` (the IxStats prod server runs `next start` from it). The existing `.next`
#   is saved aside before the build and restored afterwards.
# - flock-based lock so a crashed deploy never wedges future deploys. The IxWorld deploy lock is
#   taken too, because both scripts move the same IxStats `.next` aside.
# - Snapshot of the current release (hardlinks) before swap, with automatic rollback
#   if the post-deploy health check fails.
# - Graceful `pm2 startOrReload` instead of delete/start.
# - HTTP health probe against the running app before declaring success.
# - Log rotation so the deploy log does not grow without bound.

set -euo pipefail

# --- Configuration ---
IXSTATS_DIR="/ixwiki/public/projects/ixstats"
WIKIOS_DIR="/ixwiki/public/wikios"
LOG_FILE="/ixwiki/private/logs/deploy-wikios.log"
LOCK_FILE="/tmp/deploy-wikios.lock"
IXWORLD_LOCK_FILE="/tmp/deploy-ixworld.lock"
PM2_APP_NAME="wikios"
ECOSYSTEM_FILE="ecosystem.wikios.config.cjs"
HEALTH_URL="http://127.0.0.1:3560/wiki/Main_Page"
HEALTH_RETRIES=20
HEALTH_INTERVAL=3
SAVED_NEXT="$IXSTATS_DIR/.next.ixstats-saved"
PREV_RELEASE="${WIKIOS_DIR}.prev"

# --- Setup Logging (with simple rotation) ---
mkdir -p "$(dirname "$LOG_FILE")"
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 10485760 ]; then
    mv -f "$LOG_FILE" "${LOG_FILE}.1"
fi
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Lockfiles (flock: auto-released on any exit, including kill -9) ---
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    log "ERROR: Deployment already in progress (could not acquire lock at $LOCK_FILE)"
    exit 1
fi
# Same SAVED_NEXT as deploy-ixworld.sh, so the two must never run at once.
exec 201>"$IXWORLD_LOCK_FILE"
if ! flock -n 201; then
    log "ERROR: An IxWorld deployment is in progress (could not acquire lock at $IXWORLD_LOCK_FILE)"
    exit 1
fi

log "=== Starting WikiOS Deployment ==="

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

# The PM2 ecosystem file and the runtime env live in $WIKIOS_DIR (operator-installed, see header).
# They are not build output and the git sync below would delete untracked copies in $IXSTATS_DIR.
if [ ! -f "$WIKIOS_DIR/$ECOSYSTEM_FILE" ]; then
    log "ERROR: $WIKIOS_DIR/$ECOSYSTEM_FILE not found. Copy deploy/wikios/ecosystem.wikios.config.cjs.example there first."
    exit 1
fi

cd "$IXSTATS_DIR"

# Auto git sync if in production VPS directory
if [ "$(pwd)" = "/ixwiki/public/projects/ixstats" ]; then
    log "Production directory detected. Force-syncing with the latest git commit..."
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "master")
    if [ -z "$CURRENT_BRANCH" ]; then
        CURRENT_BRANCH="master"
    fi
    # Production deploys master (rose-garden is nightly, development is stable-experimental;
    # see docs/processes/contributing.md#branches). Override only on purpose.
    if [ "$CURRENT_BRANCH" != "master" ] && [ "${ALLOW_NON_MASTER_DEPLOY:-}" != "1" ]; then
        log "ERROR: Refusing to deploy branch '$CURRENT_BRANCH' to production: check out master, or set ALLOW_NON_MASTER_DEPLOY=1"
        exit 1
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

# Save the existing IxStats .next so the WikiOS build does not clobber it.
if [ -d ".next" ]; then
    log "Saving existing IxStats .next -> $SAVED_NEXT"
    rm -rf "$SAVED_NEXT"
    mv ".next" "$SAVED_NEXT"
fi

log "[2/4] Building Next.js application (WikiOS standalone)..."
# next.config.js resolveBasePath() returns "" for NEXT_PUBLIC_WIKIOS_STANDALONE=true
# (deploy/wikios/next-config-snippet.md); the empty BASE_PATH values keep the proxy and the
# client in step with it.
export BASE_PATH=""
export NEXT_PUBLIC_BASE_PATH=""
export NEXT_PUBLIC_WIKIOS_STANDALONE=true
export NODE_ENV=production

if ! bun run next build; then
    log "ERROR: Build failed! IxStats .next will be restored on exit."
    exit 1
fi

# Step 2: Snapshot current release for rollback, then deploy
log "[3/4] Deploying to $WIKIOS_DIR..."
mkdir -p "$WIKIOS_DIR"

# Hardlink snapshot of the current release (instant, space-efficient). rsync replaces
# files via temp+rename so the snapshot's inodes are preserved for rollback.
if [ -d "$WIKIOS_DIR" ] && [ -n "$(ls -A "$WIKIOS_DIR" 2>/dev/null)" ]; then
    log "Snapshotting current release -> $PREV_RELEASE"
    rm -rf "$PREV_RELEASE"
    cp -al "$WIKIOS_DIR" "$PREV_RELEASE" 2>/dev/null || cp -a "$WIKIOS_DIR" "$PREV_RELEASE"
fi

# Sync standalone output. Note: standalone server.js expects static under .next/static
# and the public/ dir alongside it. The operator-installed ecosystem file, runtime env files and
# data/ are excluded so --delete never removes them.
rsync -ah --delete \
    --exclude "/$ECOSYSTEM_FILE" \
    --exclude '/.env*' \
    --exclude '/data/' \
    .next/standalone/ "$WIKIOS_DIR/"
rsync -ah --delete .next/static/ "$WIKIOS_DIR/.next/static/"
rsync -ah --delete \
    --exclude 'images/discord' \
    --exclude 'images/uploads' \
    --exclude 'images/downloaded' \
    public/ "$WIKIOS_DIR/public/"

# Ensure shared dynamic assets are symlinked to preserve real-time updates
ln -sfn "$IXSTATS_DIR/public/images/discord" "$WIKIOS_DIR/public/images/discord"
ln -sfn "$IXSTATS_DIR/public/images/uploads" "$WIKIOS_DIR/public/images/uploads"
ln -sfn "$IXSTATS_DIR/public/images/downloaded" "$WIKIOS_DIR/public/images/downloaded"

# data/ holds runtime-generated content (cache, etc.) and is not build output, so do NOT
# use --delete here.
if [ -d "data" ]; then
    rsync -ah data/ "$WIKIOS_DIR/data/"
fi

# Step 3: Graceful PM2 reload (starts if absent, reloads if present)
log "[4/4] Reloading PM2 processes..."
pm2 startOrReload "$WIKIOS_DIR/$ECOSYSTEM_FILE" --silent
pm2 save --silent &>/dev/null

# Step 4: Health check with automatic rollback
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
        rsync -ah --delete "$PREV_RELEASE/" "$WIKIOS_DIR/"
        pm2 startOrReload "$WIKIOS_DIR/$ECOSYSTEM_FILE" --silent
        pm2 save --silent &>/dev/null
        log "Rollback complete."
    else
        log "No previous release snapshot available for rollback."
    fi
    exit 1
fi

log "=== Deployment Successful ==="
pm2 status "$PM2_APP_NAME" | grep "$PM2_APP_NAME" || true
