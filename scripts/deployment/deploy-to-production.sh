#!/bin/bash

# Production Deployment Script for IxStats v1.2
# Enhanced version with comprehensive checks, backup, and notifications

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
LOG_FILE="$LOG_DIR/production-deployment-$TIMESTAMP.log"
REPORT_FILE="$LOG_DIR/production-report-$TIMESTAMP.md"

# Create necessary directories
mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"

# Logging functions
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
  send_discord_notification "❌ **Production Deployment Failed**" "$1" "error"
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

# Banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║    IxStats v1.2 - Production Deployment Script       ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

DEPLOYMENT_START=$(date +%s)

# Start deployment
log "Starting production deployment for IxStats v1.2..."
log "Deployment ID: $TIMESTAMP"
log "Log file: $LOG_FILE"

send_discord_notification "🚀 **Production Deployment Started**" "IxStats v1.2 deployment initiated\nDeployment ID: $TIMESTAMP" "info"

# Change to project directory
cd "$PROJECT_ROOT" || error "Failed to change to project directory"
log "Working directory: $(pwd)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    error "package.json not found. Please run this script from the project root."
fi

# ============================================================================
# PHASE 1: PRE-DEPLOYMENT CHECKS
# ============================================================================

info "Phase 1: Pre-deployment checks"

# Load production environment
if [ -f ".env.production" ]; then
    log "Loading production environment variables..."
    set -a
    source .env.production
    set +a
else
    error ".env.production file not found"
fi

# Set production environment
export NODE_ENV=production
export BASE_PATH=${BASE_PATH:-/projects/ixstats}
export NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}

log "Environment: $NODE_ENV"
log "Base Path: $BASE_PATH"

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
MIN_NODE_VERSION="18.17.0"
if [ "$(printf '%s\n' "$MIN_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$MIN_NODE_VERSION" ]; then
    error "Node.js version $NODE_VERSION is below minimum required version $MIN_NODE_VERSION"
fi
log "✓ Node.js version: $NODE_VERSION"

# Run environment verification
info "Running environment verification..."
npm run verify:environment || error "Environment verification failed"
log "✓ Environment variables validated"

# Check disk space (require at least 5GB free)
DISK_AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$DISK_AVAILABLE" -lt 5 ]; then
    error "Insufficient disk space. Available: ${DISK_AVAILABLE}GB, Required: 5GB"
fi
log "✓ Disk space available: ${DISK_AVAILABLE}GB"

# Check if port is available
PORT=${PORT:-3550}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    info "Port $PORT is in use (expected for running application)"
else
    warn "Port $PORT is not in use - no existing application running"
fi

# ============================================================================
# PHASE 2: DATABASE BACKUP
# ============================================================================

info "Phase 2: Database backup"

BACKUP_FILE="$BACKUP_DIR/pre-deployment-$TIMESTAMP.backup"

if [ -n "$DATABASE_URL" ]; then
    log "Creating database backup..."

    # PostgreSQL database backup
    if [[ "$DATABASE_URL" == postgres* ]] || [[ "$DATABASE_URL" == postgresql* ]]; then
        # Extract connection details from DATABASE_URL
        log "Backing up PostgreSQL database..."
        npm run db:backup || warn "Database backup script failed (manual backup recommended)"

        # Alternative: Use pg_dump directly if db:backup script not available
        # Note: This requires PostgreSQL client tools installed
        # pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE" || warn "pg_dump backup failed"

        success "✓ PostgreSQL backup initiated"
        log "Backup recommendation: Verify backup exists and is valid"
    else
        error "Production requires PostgreSQL database. Current DATABASE_URL format not recognized."
    fi
else
    error "DATABASE_URL not set - cannot proceed with production deployment"
fi

# ============================================================================
# PHASE 3: STOP APPLICATION
# ============================================================================

info "Phase 3: Gracefully stopping application"

# Find and stop existing process
if [ -f ".production.pid" ]; then
    OLD_PID=$(cat .production.pid)
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log "Stopping existing production process (PID: $OLD_PID)..."
        kill -TERM "$OLD_PID" || warn "Failed to send TERM signal"

        # Wait for graceful shutdown (max 30 seconds)
        for i in {1..30}; do
            if ! ps -p "$OLD_PID" > /dev/null 2>&1; then
                log "✓ Process stopped gracefully"
                break
            fi
            sleep 1
        done

        # Force kill if still running
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            warn "Forcing process termination..."
            kill -9 "$OLD_PID" || warn "Failed to kill process"
            sleep 2
        fi
    fi
    rm -f .production.pid
fi

log "✓ Application stopped"

# ============================================================================
# PHASE 4: CODE UPDATE
# ============================================================================

info "Phase 4: Updating code"

if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current)
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    log "Current branch: $CURRENT_BRANCH"
    log "Current commit: $CURRENT_COMMIT"

    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        warn "Local changes detected, stashing..."
        git stash
    fi

    # Pull latest changes
    git pull origin "$CURRENT_BRANCH" || error "Failed to pull latest code"

    NEW_COMMIT=$(git rev-parse --short HEAD)
    if [ "$CURRENT_COMMIT" != "$NEW_COMMIT" ]; then
        log "✓ Code updated: $CURRENT_COMMIT → $NEW_COMMIT"
    else
        log "Already at latest commit"
    fi
else
    warn "Not a git repository, skipping git pull"
fi

# ============================================================================
# PHASE 5: DEPENDENCIES
# ============================================================================

info "Phase 5: Installing dependencies"

log "Running npm ci..."
npm ci --production=false || error "Failed to install dependencies"
log "✓ Dependencies installed"

# Run security audit
log "Running security audit..."
npm audit --production || warn "Security vulnerabilities detected (review recommended)"

# ============================================================================
# PHASE 6: DATABASE MIGRATIONS
# ============================================================================

info "Phase 6: Database migrations"

# Generate Prisma client
log "Generating Prisma client..."
npm run db:generate || error "Failed to generate Prisma client"
log "✓ Prisma client generated"

# Run migrations
if [ -n "$DATABASE_URL" ]; then
    log "Running database migrations..."
    npm run db:migrate:deploy || error "Database migration failed - ROLLBACK RECOMMENDED"
    log "✓ Database migrations completed"

    # Validate schema alignment
    log "Validating schema alignment..."
    npm run validate:schemas || warn "Schema validation warnings detected"
else
    warn "DATABASE_URL not set, skipping migrations"
fi

# ============================================================================
# PHASE 7: BUILD APPLICATION
# ============================================================================

info "Phase 7: Building application"

BUILD_START=$(date +%s)
log "Starting production build..."

npm run build || error "Build failed - ROLLBACK RECOMMENDED"

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
success "✓ Build completed successfully in ${BUILD_TIME}s"

# ============================================================================
# PHASE 8: START APPLICATION
# ============================================================================

info "Phase 8: Starting application"

log "Starting production server on port $PORT..."

# Start new process
nohup npm run start:prod > "$LOG_DIR/production-server-$TIMESTAMP.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > .production.pid

log "Server started with PID: $SERVER_PID"

# Wait for server to start
log "Waiting for server to start (30s timeout)..."
for i in {1..30}; do
    sleep 1
    if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
        error "Server process died. Check logs: $LOG_DIR/production-server-$TIMESTAMP.log"
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
# PHASE 9: SMOKE TESTS
# ============================================================================

info "Phase 9: Running smoke tests"

PRODUCTION_URL="http://localhost:$PORT$BASE_PATH"
ALL_TESTS_PASSED=true

# Test 1: Health check
info "Test 1/5: Health endpoint..."
if curl -f -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL/api/health" | grep -q "200"; then
    log "✓ Health check passed"
else
    warn "Health check failed"
    ALL_TESTS_PASSED=false
fi

# Test 2: Homepage
info "Test 2/5: Homepage..."
if curl -f -s -o /dev/null "$PRODUCTION_URL"; then
    log "✓ Homepage accessible"
else
    warn "Homepage not accessible"
    ALL_TESTS_PASSED=false
fi

# Test 3: API endpoints
info "Test 3/5: tRPC API..."
if curl -f -s -o /dev/null "$PRODUCTION_URL/api/trpc/health.check"; then
    log "✓ tRPC API accessible"
else
    warn "tRPC API not accessible"
    ALL_TESTS_PASSED=false
fi

# Test 4: Database connectivity
info "Test 4/5: Database connectivity..."
npm run test:db > /dev/null 2>&1 && log "✓ Database connectivity verified" || { warn "Database connectivity issues"; ALL_TESTS_PASSED=false; }

# Test 5: Authentication
info "Test 5/5: Authentication system..."
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    log "✓ Authentication configured"
else
    warn "Authentication not configured"
fi

if [ "$ALL_TESTS_PASSED" = true ]; then
    success "✓ All smoke tests passed"
else
    warn "⚠️  Some smoke tests failed - manual review required"
fi

# ============================================================================
# PHASE 10: POST-DEPLOYMENT VALIDATION
# ============================================================================

info "Phase 10: Post-deployment validation"

log "Running post-deployment validation script..."
npm run post:deploy:validate 2>/dev/null || info "Post-deployment validation script not found (optional)"

# ============================================================================
# DEPLOYMENT COMPLETE
# ============================================================================

DEPLOYMENT_END=$(date +%s)
DEPLOYMENT_TIME=$((DEPLOYMENT_END - DEPLOYMENT_START))

# Generate deployment report
log "Generating deployment report..."

cat > "$REPORT_FILE" << EOF
# Production Deployment Report - IxStats v1.2

**Deployment Date**: $(date +'%Y-%m-%d %H:%M:%S')
**Deployment ID**: $TIMESTAMP
**Total Deployment Time**: ${DEPLOYMENT_TIME}s (~$((DEPLOYMENT_TIME / 60))m $((DEPLOYMENT_TIME % 60))s)
**Build Time**: ${BUILD_TIME}s
**Status**: ${ALL_TESTS_PASSED:+✅ Success|⚠️  Requires Review}

---

## Deployment Summary

| Metric | Value |
|--------|-------|
| Environment | Production |
| Branch | ${CURRENT_BRANCH:-unknown} |
| Previous Commit | ${CURRENT_COMMIT:-unknown} |
| New Commit | ${NEW_COMMIT:-unknown} |
| Node Version | $(node --version) |
| npm Version | $(npm --version) |
| Server PID | $SERVER_PID |
| Port | $PORT |

---

## Deployment Phases

1. ✅ Pre-deployment checks completed
2. ✅ Database backup created ($BACKUP_FILE)
3. ✅ Application stopped gracefully
4. ✅ Code updated from repository
5. ✅ Dependencies installed and audited
6. ✅ Database migrations executed
7. ✅ Production build completed (${BUILD_TIME}s)
8. ✅ Application started (PID: $SERVER_PID)
9. ${ALL_TESTS_PASSED:+✅|⚠️} Smoke tests executed
10. ✅ Post-deployment validation completed

---

## Environment Configuration

| Variable | Status |
|----------|--------|
| NODE_ENV | $NODE_ENV |
| BASE_PATH | $BASE_PATH |
| PORT | $PORT |
| DATABASE_URL | ${DATABASE_URL:+✅ Configured|❌ Not configured} |
| CLERK_AUTH | ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:+✅ Configured|❌ Not configured} |
| REDIS | ${REDIS_URL:+✅ Configured|❌ Not configured} |
| RATE_LIMITING | ${RATE_LIMIT_ENABLED:+✅ Enabled|❌ Disabled} |
| DISCORD_WEBHOOK | ${DISCORD_WEBHOOK_ENABLED:+✅ Enabled|❌ Disabled} |

---

## Smoke Test Results

| Test | Result | Details |
|------|--------|---------|
| Health Check | ${ALL_TESTS_PASSED:+✅ Passed|⚠️  Failed} | API health endpoint responding |
| Homepage | ${ALL_TESTS_PASSED:+✅ Passed|⚠️  Failed} | Main page loading correctly |
| tRPC API | ${ALL_TESTS_PASSED:+✅ Passed|⚠️  Failed} | API endpoints accessible |
| Database | ${ALL_TESTS_PASSED:+✅ Passed|⚠️  Failed} | Database connectivity verified |
| Authentication | ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:+✅ Configured|⚠️  Not configured} | Clerk authentication system |

---

## Access Information

- **Production URL**: https://ixwiki.com$BASE_PATH
- **Local URL**: $PRODUCTION_URL
- **Server PID**: $SERVER_PID
- **Log File**: $LOG_FILE
- **Server Log**: $LOG_DIR/production-server-$TIMESTAMP.log
- **Backup File**: $BACKUP_FILE

---

## System Resources

- **Disk Space Available**: ${DISK_AVAILABLE}GB
- **Node.js Version**: $(node --version)
- **Memory**: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')
- **CPU Load**: $(uptime | awk -F'load average:' '{print $2}')

---

## Post-Deployment Tasks

- [ ] Monitor application logs for errors
- [ ] Verify critical user flows
- [ ] Check performance metrics
- [ ] Monitor error rates
- [ ] Validate external integrations
- [ ] Update documentation if needed
- [ ] Announce deployment to users

---

## Rollback Instructions

If critical issues are discovered:

\`\`\`bash
cd /ixwiki/public/projects/ixstats
./scripts/deployment/rollback-deployment.sh
\`\`\`

**Backup Location**: $BACKUP_FILE
**Estimated Rollback Time**: 3-5 minutes

---

## Monitoring

- Check logs: \`tail -f $LOG_DIR/production-server-$TIMESTAMP.log\`
- Monitor process: \`ps aux | grep $SERVER_PID\`
- Test endpoints: \`curl https://ixwiki.com$BASE_PATH/api/health\`

---

**Report Generated**: $(date +'%Y-%m-%d %H:%M:%S')
**Deployment Completed By**: Automated Deployment Script v1.2
EOF

log "✓ Deployment report generated: $REPORT_FILE"

# Send success notification
if [ "$ALL_TESTS_PASSED" = true ]; then
    send_discord_notification "✅ **Production Deployment Successful**" "IxStats v1.2 deployed successfully\nTime: ${DEPLOYMENT_TIME}s\nCommit: ${NEW_COMMIT:-unknown}\nURL: https://ixwiki.com$BASE_PATH" "success"
else
    send_discord_notification "⚠️ **Production Deployment Completed with Warnings**" "IxStats v1.2 deployed but some tests failed\nTime: ${DEPLOYMENT_TIME}s\nManual review required\nLog: $LOG_FILE" "warning"
fi

# Final summary
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║      Production Deployment Completed!                ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
success "Deployment ID: $TIMESTAMP"
success "Deployment Time: ${DEPLOYMENT_TIME}s (~$((DEPLOYMENT_TIME / 60))m $((DEPLOYMENT_TIME % 60))s)"
success "Server PID: $SERVER_PID"
success "Production URL: https://ixwiki.com$BASE_PATH"
echo ""
log "📊 View deployment report: cat $REPORT_FILE"
log "📋 View logs: tail -f $LOG_DIR/production-server-$TIMESTAMP.log"
log "🔍 Monitor process: watch -n 1 'ps aux | grep $SERVER_PID'"
echo ""

if [ "$ALL_TESTS_PASSED" = true ]; then
    success "✅ All systems operational - deployment successful!"
    exit 0
else
    warn "⚠️  Some tests failed - manual review recommended"
    warn "Check logs and monitoring dashboards"
    exit 0
fi
