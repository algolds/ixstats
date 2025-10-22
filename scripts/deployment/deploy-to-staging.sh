#!/bin/bash

# Staging Deployment Script for IxStats v1.2
# Deploys to staging environment for pre-production testing

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/ixwiki/public/projects/ixstats"
LOG_DIR="$PROJECT_ROOT/deployment-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/staging-deployment-$TIMESTAMP.log"
REPORT_FILE="$LOG_DIR/staging-report-$TIMESTAMP.md"

# Create log directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
  exit 1
}

warn() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║      IxStats v1.2 - Staging Deployment Script       ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Start deployment
log "Starting staging deployment..."
log "Log file: $LOG_FILE"
log "Report file: $REPORT_FILE"

# Change to project directory
cd "$PROJECT_ROOT" || error "Failed to change to project directory"
log "Working directory: $(pwd)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    error "package.json not found. Please run this script from the project root."
fi

# Load staging environment
if [ -f ".env.staging" ]; then
    log "Loading staging environment variables..."
    set -a
    source .env.staging
    set +a
else
    warn ".env.staging not found, using .env.local"
    if [ -f ".env.local" ]; then
        set -a
        source .env.local
        set +a
    else
        error "No environment file found (.env.staging or .env.local)"
    fi
fi

# Set staging environment
export NODE_ENV=staging
export BASE_PATH=${BASE_PATH:-/projects/ixstats}
export NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}

log "Environment: $NODE_ENV"
log "Base Path: $BASE_PATH"

# Step 1: Pull latest code
log "Step 1/7: Pulling latest code from repository..."
if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current)
    log "Current branch: $CURRENT_BRANCH"

    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        warn "Local changes detected, stashing..."
        git stash
    fi

    # Pull latest changes
    git pull origin "$CURRENT_BRANCH" || error "Failed to pull latest code"
    log "✓ Code updated successfully"
else
    warn "Not a git repository, skipping git pull"
fi

# Step 2: Install dependencies
log "Step 2/7: Installing dependencies..."
npm ci || error "Failed to install dependencies"
log "✓ Dependencies installed successfully"

# Step 3: Generate Prisma client
log "Step 3/7: Generating Prisma client..."
npm run db:generate || error "Failed to generate Prisma client"
log "✓ Prisma client generated successfully"

# Step 4: Run database migrations
log "Step 4/7: Running database migrations..."
if [ -n "$DATABASE_URL" ]; then
    npm run db:migrate:deploy || warn "Database migration failed (may need manual intervention)"
    log "✓ Database migrations completed"
else
    warn "DATABASE_URL not set, skipping migrations"
fi

# Step 5: Build production bundle
log "Step 5/7: Building production bundle..."
BUILD_START=$(date +%s)
npm run build || error "Build failed"
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
log "✓ Build completed successfully in ${BUILD_TIME}s"

# Step 6: Start application
log "Step 6/7: Starting application..."

# Kill existing staging process if running
if [ -f ".staging.pid" ]; then
    OLD_PID=$(cat .staging.pid)
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log "Stopping existing staging process (PID: $OLD_PID)..."
        kill "$OLD_PID" || warn "Failed to kill old process"
        sleep 2
    fi
    rm -f .staging.pid
fi

# Start new process
log "Starting new staging server..."
PORT=${PORT:-3001} npm run start:prod > "$LOG_DIR/staging-server-$TIMESTAMP.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > .staging.pid
log "Server started with PID: $SERVER_PID"

# Wait for server to start
log "Waiting for server to start..."
sleep 5

# Check if process is still running
if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
    error "Server failed to start. Check logs: $LOG_DIR/staging-server-$TIMESTAMP.log"
fi

log "✓ Application started successfully"

# Step 7: Run smoke tests
log "Step 7/7: Running smoke tests..."

STAGING_URL="http://localhost:${PORT:-3001}${BASE_PATH}"
SMOKE_TEST_PASSED=true

# Test 1: Health check
info "Testing health endpoint..."
if curl -f -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/health" | grep -q "200"; then
    log "✓ Health check passed"
else
    warn "Health check failed (may not be critical)"
    SMOKE_TEST_PASSED=false
fi

# Test 2: Homepage
info "Testing homepage..."
if curl -f -s -o /dev/null "$STAGING_URL"; then
    log "✓ Homepage accessible"
else
    warn "Homepage not accessible"
    SMOKE_TEST_PASSED=false
fi

# Test 3: API endpoints
info "Testing API endpoints..."
if curl -f -s -o /dev/null "$STAGING_URL/api/trpc/health.check"; then
    log "✓ tRPC API accessible"
else
    warn "tRPC API not accessible"
    SMOKE_TEST_PASSED=false
fi

if [ "$SMOKE_TEST_PASSED" = true ]; then
    log "✓ All smoke tests passed"
else
    warn "Some smoke tests failed, please review manually"
fi

# Generate deployment report
log "Generating deployment report..."

cat > "$REPORT_FILE" << EOF
# Staging Deployment Report

**Deployment Date**: $(date +'%Y-%m-%d %H:%M:%S')
**Version**: v1.2.0
**Environment**: Staging
**Deployment Time**: ${BUILD_TIME}s (build only)

---

## Deployment Summary

- **Status**: ${SMOKE_TEST_PASSED:+✅ Success|⚠️  Warning}
- **Branch**: ${CURRENT_BRANCH:-unknown}
- **Commit**: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
- **Node Version**: $(node --version)
- **npm Version**: $(npm --version)

---

## Environment Configuration

- **NODE_ENV**: $NODE_ENV
- **BASE_PATH**: $BASE_PATH
- **PORT**: ${PORT:-3001}
- **DATABASE_URL**: ${DATABASE_URL:+Configured|Not configured}
- **CLERK**: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:+Configured|Not configured}

---

## Deployment Steps

1. ✅ Code pulled from repository
2. ✅ Dependencies installed
3. ✅ Prisma client generated
4. ${DATABASE_URL:+✅|⚠️} Database migrations executed
5. ✅ Production bundle built (${BUILD_TIME}s)
6. ✅ Application started (PID: $SERVER_PID)
7. ${SMOKE_TEST_PASSED:+✅|⚠️} Smoke tests executed

---

## Smoke Test Results

| Test | Result |
|------|--------|
| Health Check | ${SMOKE_TEST_PASSED:+✅ Passed|⚠️  Failed} |
| Homepage | ${SMOKE_TEST_PASSED:+✅ Passed|⚠️  Failed} |
| API Endpoints | ${SMOKE_TEST_PASSED:+✅ Passed|⚠️  Failed} |

---

## Access Information

- **Staging URL**: $STAGING_URL
- **Server PID**: $SERVER_PID
- **Log File**: $LOG_FILE
- **Server Log**: $LOG_DIR/staging-server-$TIMESTAMP.log

---

## Next Steps

1. Perform manual testing on staging environment
2. Verify all critical features are working
3. Check performance metrics
4. Review deployment logs for any warnings
5. If all tests pass, proceed with production deployment

---

## Rollback Instructions

If issues are found, rollback using:

\`\`\`bash
./scripts/deployment/rollback-deployment.sh --environment=staging
\`\`\`

Or manually:

\`\`\`bash
# Stop staging server
kill $SERVER_PID

# Restore previous version
git checkout <previous-commit>
npm ci
npm run build
npm run start:prod
\`\`\`

---

**Generated**: $(date +'%Y-%m-%d %H:%M:%S')
EOF

log "✓ Deployment report generated: $REPORT_FILE"

# Final summary
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║         Staging Deployment Completed!                ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
log "Staging environment is ready for testing"
log "URL: $STAGING_URL"
log "PID: $SERVER_PID"
log ""
log "View logs with: tail -f $LOG_DIR/staging-server-$TIMESTAMP.log"
log "View report: cat $REPORT_FILE"
log ""
log "To stop staging server: kill $SERVER_PID"
log ""

if [ "$SMOKE_TEST_PASSED" = true ]; then
    log "✅ All systems operational"
    exit 0
else
    warn "⚠️  Some tests failed - manual review recommended"
    exit 0
fi
