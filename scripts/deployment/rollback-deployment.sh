#!/bin/bash

# Rollback Deployment Script for IxStats v1.2
# Restores previous version in case of deployment failure

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/ixwiki/public/projects/ixstats"
LOG_DIR="$PROJECT_ROOT/deployment-logs"
BACKUP_DIR="$PROJECT_ROOT/prisma/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/rollback-$TIMESTAMP.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
  send_discord_notification "❌ **Rollback Failed**" "$1" "error"
  exit 1
}

warn() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

success() {
  echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

# Discord notification function
send_discord_notification() {
  local title="$1"
  local message="$2"
  local level="${3:-info}"

  if [ -n "$DISCORD_WEBHOOK_URL" ] && [ "$DISCORD_WEBHOOK_ENABLED" = "true" ]; then
    local color="3447003" # Blue
    case "$level" in
      error) color="15158332" ;; # Red
      warning) color="16776960" ;; # Yellow
      success) color="3066993" ;; # Green
    esac

    curl -H "Content-Type: application/json" -X POST -d "{
      \"embeds\": [{
        \"title\": \"$title\",
        \"description\": \"$message\",
        \"color\": $color,
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }]
    }" "$DISCORD_WEBHOOK_URL" 2>/dev/null || warn "Failed to send Discord notification"
  fi
}

# Parse command line arguments
ENVIRONMENT="production"
TARGET_COMMIT=""
TARGET_BACKUP=""
SKIP_DB_RESTORE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --environment=*)
      ENVIRONMENT="${1#*=}"
      shift
      ;;
    --commit=*)
      TARGET_COMMIT="${1#*=}"
      shift
      ;;
    --backup=*)
      TARGET_BACKUP="${1#*=}"
      shift
      ;;
    --skip-db-restore)
      SKIP_DB_RESTORE=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --environment=ENV     Target environment (default: production)"
      echo "  --commit=HASH        Specific commit to rollback to"
      echo "  --backup=FILE        Specific backup file to restore"
      echo "  --skip-db-restore    Skip database restoration"
      echo "  --help               Display this help message"
      exit 0
      ;;
    *)
      error "Unknown option: $1 (use --help for usage)"
      ;;
  esac
done

# Banner
echo -e "${RED}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║         IxStats v1.2 - Rollback Script               ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

ROLLBACK_START=$(date +%s)

warn "⚠️  ROLLBACK INITIATED ⚠️"
log "Environment: $ENVIRONMENT"
log "Timestamp: $TIMESTAMP"
log "Log file: $LOG_FILE"

send_discord_notification "⚠️  **Rollback Initiated**" "Rolling back IxStats deployment\nEnvironment: $ENVIRONMENT\nTime: $(date)" "warning"

# Change to project directory
cd "$PROJECT_ROOT" || error "Failed to change to project directory"
log "Working directory: $(pwd)"

# Confirmation prompt (skip if specific commit/backup provided)
if [ -z "$TARGET_COMMIT" ] && [ -z "$TARGET_BACKUP" ]; then
  echo ""
  warn "⚠️  WARNING: This will rollback the deployment to the previous version."
  warn "This action will:"
  warn "  1. Stop the current application"
  warn "  2. Restore previous code version"
  warn "  3. Restore previous database backup (optional)"
  warn "  4. Rebuild and restart application"
  echo ""
  read -p "Are you sure you want to proceed? (type 'yes' to confirm): " confirm

  if [ "$confirm" != "yes" ]; then
    log "Rollback cancelled by user"
    exit 0
  fi
fi

# Load environment
if [ -f ".env.$ENVIRONMENT" ]; then
    log "Loading $ENVIRONMENT environment variables..."
    set -a
    source ".env.$ENVIRONMENT"
    set +a
elif [ -f ".env.production" ]; then
    log "Loading production environment variables..."
    set -a
    source .env.production
    set +a
else
    error "No environment file found"
fi

export NODE_ENV=$ENVIRONMENT
export BASE_PATH=${BASE_PATH:-/projects/ixstats}
export NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}

# ============================================================================
# PHASE 1: STOP CURRENT APPLICATION
# ============================================================================

info "Phase 1: Stopping current application"

if [ -f ".production.pid" ]; then
    CURRENT_PID=$(cat .production.pid)
    if ps -p "$CURRENT_PID" > /dev/null 2>&1; then
        log "Stopping process (PID: $CURRENT_PID)..."
        kill -TERM "$CURRENT_PID" || warn "Failed to send TERM signal"

        # Wait for graceful shutdown (max 20 seconds)
        for i in {1..20}; do
            if ! ps -p "$CURRENT_PID" > /dev/null 2>&1; then
                log "✓ Process stopped gracefully"
                break
            fi
            sleep 1
        done

        # Force kill if still running
        if ps -p "$CURRENT_PID" > /dev/null 2>&1; then
            warn "Forcing process termination..."
            kill -9 "$CURRENT_PID" || warn "Failed to kill process"
            sleep 2
        fi
    fi
    rm -f .production.pid
fi

log "✓ Application stopped"

# ============================================================================
# PHASE 2: RESTORE CODE VERSION
# ============================================================================

info "Phase 2: Restoring code version"

if [ -d ".git" ]; then
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    log "Current commit: $CURRENT_COMMIT"

    # Determine target commit
    if [ -n "$TARGET_COMMIT" ]; then
        ROLLBACK_COMMIT="$TARGET_COMMIT"
        log "Rolling back to specified commit: $ROLLBACK_COMMIT"
    else
        # Get previous commit
        ROLLBACK_COMMIT=$(git rev-parse --short HEAD~1)
        log "Rolling back to previous commit: $ROLLBACK_COMMIT"
    fi

    # Show commits that will be reverted
    log "Commits being reverted:"
    git log --oneline "$ROLLBACK_COMMIT..HEAD" | tee -a "$LOG_FILE"

    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        warn "Local changes detected, stashing..."
        git stash
    fi

    # Checkout previous commit
    git checkout "$ROLLBACK_COMMIT" || error "Failed to checkout commit $ROLLBACK_COMMIT"
    log "✓ Code rolled back to $ROLLBACK_COMMIT"
else
    error "Not a git repository - cannot rollback code automatically"
fi

# ============================================================================
# PHASE 3: RESTORE DATABASE BACKUP
# ============================================================================

info "Phase 3: Database restoration"

if [ "$SKIP_DB_RESTORE" = true ]; then
    warn "Skipping database restoration (--skip-db-restore flag set)"
elif [ -n "$DATABASE_URL" ]; then
    # Determine backup file
    if [ -n "$TARGET_BACKUP" ]; then
        BACKUP_FILE="$TARGET_BACKUP"
    else
        # Find most recent backup
        BACKUP_FILE=$(ls -t "$BACKUP_DIR"/pre-deployment-*.backup 2>/dev/null | head -1)
    fi

    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        log "Restoring database from: $BACKUP_FILE"

        # PostgreSQL database restoration
        if [[ "$DATABASE_URL" == postgres* ]] || [[ "$DATABASE_URL" == postgresql* ]]; then
            log "PostgreSQL database detected - initiating restoration"

            # Create backup of current state before restore
            CURRENT_DB_BACKUP="$BACKUP_DIR/before-rollback-$TIMESTAMP.backup"
            log "Creating backup of current database state..."
            npm run db:backup 2>/dev/null || warn "Failed to backup current database state"

            # Restore from backup
            log "Restoring database from backup file: $BACKUP_FILE"
            warn "⚠️  Manual PostgreSQL restoration required:"
            warn "   1. Review backup file: $BACKUP_FILE"
            warn "   2. Use: npm run db:restore --backup=$BACKUP_FILE"
            warn "   3. Or use: pg_restore -d ixstats $BACKUP_FILE"
            warn "   4. Or manually restore from SQL dump if available"
            warn ""
            warn "Database rollback must be completed manually before proceeding."

            # Attempt automated restore if db:restore script exists
            if npm run db:restore --backup="$BACKUP_FILE" 2>/dev/null; then
                success "✓ Database restored successfully via npm script"
            else
                warn "Automated restore not available - manual intervention required"
                warn "Press Enter when database has been manually restored, or Ctrl+C to abort"
                read -r
            fi
        else
            error "Production requires PostgreSQL database. Current DATABASE_URL format not recognized."
        fi
    else
        warn "No backup file found - database not restored"
        warn "If database migrations were run, you may need to manually restore"
        warn "Check backup directory: $BACKUP_DIR"
    fi
else
    warn "DATABASE_URL not set, skipping database restoration"
fi

# ============================================================================
# PHASE 4: REINSTALL DEPENDENCIES
# ============================================================================

info "Phase 4: Reinstalling dependencies"

log "Removing node_modules..."
rm -rf node_modules

log "Installing dependencies..."
npm ci --production=false || error "Failed to install dependencies"
log "✓ Dependencies installed"

# ============================================================================
# PHASE 5: REBUILD APPLICATION
# ============================================================================

info "Phase 5: Rebuilding application"

log "Generating Prisma client..."
npm run db:generate || error "Failed to generate Prisma client"

log "Cleaning previous build..."
npm run clean || warn "Failed to clean build directory"

BUILD_START=$(date +%s)
log "Building application..."
npm run build || error "Build failed - rollback incomplete"
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

success "✓ Build completed in ${BUILD_TIME}s"

# ============================================================================
# PHASE 6: START APPLICATION
# ============================================================================

info "Phase 6: Starting application"

PORT=${PORT:-3550}
log "Starting server on port $PORT..."

nohup npm run start:prod > "$LOG_DIR/rollback-server-$TIMESTAMP.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > .production.pid

log "Server started with PID: $SERVER_PID"

# Wait for server to start
log "Waiting for server to start (30s timeout)..."
for i in {1..30}; do
    sleep 1
    if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
        error "Server process died. Check logs: $LOG_DIR/rollback-server-$TIMESTAMP.log"
    fi

    # Check if server is responding
    if curl -f -s -o /dev/null "http://localhost:$PORT$BASE_PATH" 2>/dev/null; then
        success "✓ Server is responding"
        break
    fi

    if [ $i -eq 30 ]; then
        error "Server failed to respond within 30 seconds"
    fi
done

log "✓ Application started successfully"

# ============================================================================
# PHASE 7: VERIFY ROLLBACK
# ============================================================================

info "Phase 7: Verifying rollback"

ALL_TESTS_PASSED=true

# Test 1: Health check
info "Test 1/3: Health endpoint..."
if curl -f -s -o /dev/null "http://localhost:$PORT$BASE_PATH/api/health" 2>/dev/null; then
    log "✓ Health check passed"
else
    warn "Health check failed"
    ALL_TESTS_PASSED=false
fi

# Test 2: Homepage
info "Test 2/3: Homepage..."
if curl -f -s -o /dev/null "http://localhost:$PORT$BASE_PATH" 2>/dev/null; then
    log "✓ Homepage accessible"
else
    warn "Homepage not accessible"
    ALL_TESTS_PASSED=false
fi

# Test 3: Database
info "Test 3/3: Database connectivity..."
npm run test:db > /dev/null 2>&1 && log "✓ Database connectivity verified" || { warn "Database connectivity issues"; ALL_TESTS_PASSED=false; }

# ============================================================================
# ROLLBACK COMPLETE
# ============================================================================

ROLLBACK_END=$(date +%s)
ROLLBACK_TIME=$((ROLLBACK_END - ROLLBACK_START))

if [ "$ALL_TESTS_PASSED" = true ]; then
    send_discord_notification "✅ **Rollback Successful**" "IxStats rolled back successfully\nCommit: $ROLLBACK_COMMIT\nTime: ${ROLLBACK_TIME}s\nServer PID: $SERVER_PID" "success"
else
    send_discord_notification "⚠️  **Rollback Completed with Warnings**" "IxStats rolled back but some tests failed\nCommit: $ROLLBACK_COMMIT\nManual verification required" "warning"
fi

# Final summary
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║            Rollback Completed!                       ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
success "Rollback Time: ${ROLLBACK_TIME}s (~$((ROLLBACK_TIME / 60))m $((ROLLBACK_TIME % 60))s)"
success "Rolled back to commit: $ROLLBACK_COMMIT"
success "Server PID: $SERVER_PID"
if [ -n "$BACKUP_FILE" ] && [ "$SKIP_DB_RESTORE" = false ]; then
    success "Database restored from: $BACKUP_FILE"
fi
echo ""
log "📋 View logs: tail -f $LOG_DIR/rollback-server-$TIMESTAMP.log"
log "🔍 Monitor process: watch -n 1 'ps aux | grep $SERVER_PID'"
log "🌐 Test URL: http://localhost:$PORT$BASE_PATH"
echo ""

if [ "$ALL_TESTS_PASSED" = true ]; then
    success "✅ All verification tests passed"
    success "Application is running on previous version"
    log ""
    log "Next steps:"
    log "  1. Verify critical features manually"
    log "  2. Monitor logs for errors"
    log "  3. Investigate root cause of deployment failure"
    log "  4. Fix issues before attempting next deployment"
    exit 0
else
    warn "⚠️  Some verification tests failed"
    warn "Manual verification strongly recommended"
    log ""
    log "Next steps:"
    log "  1. Check application logs: tail -f $LOG_DIR/rollback-server-$TIMESTAMP.log"
    log "  2. Verify critical features manually"
    log "  3. Check database integrity"
    log "  4. Contact development team if issues persist"
    exit 0
fi
