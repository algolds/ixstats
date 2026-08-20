#!/bin/bash

# Setup script for automated log cleanup via cron
# This script sets up a cron job to run the log cleanup daily at 2 AM

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLEANUP_SCRIPT="$PROJECT_ROOT/scripts/cleanup-logs.sh"
CRON_LOG="$PROJECT_ROOT/logs/cron-cleanup.log"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

setup_cron() {
    log "Setting up automated log cleanup cron job..."
    
    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Create the cron job entry
    local cron_entry="0 2 * * * $CLEANUP_SCRIPT >> $CRON_LOG 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "cleanup-logs.sh"; then
        warning "Cron job for log cleanup already exists"
        echo "Current cron jobs:"
        crontab -l | grep -E "(cleanup|log)" || echo "  (none found)"
    else
        # Add the cron job
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        success "Cron job added successfully"
        echo "  Schedule: Daily at 2:00 AM"
        echo "  Script: $CLEANUP_SCRIPT"
        echo "  Log: $CRON_LOG"
    fi
    
    echo ""
    log "Current cron jobs:"
    crontab -l | grep -v "^#" | grep -v "^$" || echo "  (no cron jobs found)"
}

remove_cron() {
    log "Removing log cleanup cron job..."
    
    # Remove the cron job
    crontab -l 2>/dev/null | grep -v "cleanup-logs.sh" | crontab -
    success "Cron job removed successfully"
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  setup     Set up the cron job for automated log cleanup"
    echo "  remove    Remove the cron job"
    echo "  status    Show current cron job status"
    echo "  help      Show this help message"
    echo ""
    echo "The cron job will run daily at 2:00 AM and clean up:"
    echo "  - Log files older than 3 days"
    echo "  - Audit reports older than 3 days"
    echo "  - Large files (truncate to 10,000 lines)"
    echo "  - Duplicate reports (keep only 3 most recent)"
    echo "  - Node modules log files"
}

show_status() {
    log "Checking cron job status..."
    
    if crontab -l 2>/dev/null | grep -q "cleanup-logs.sh"; then
        success "Log cleanup cron job is active"
        echo "Schedule: Daily at 2:00 AM"
        echo "Script: $CLEANUP_SCRIPT"
        echo "Log: $CRON_LOG"
        
        if [ -f "$CRON_LOG" ]; then
            echo ""
            echo "Last cleanup run:"
            tail -n 5 "$CRON_LOG" 2>/dev/null || echo "  (no log entries found)"
        fi
    else
        warning "Log cleanup cron job is not set up"
        echo "Run '$0 setup' to configure automated cleanup"
    fi
}

# Main execution
case "${1:-setup}" in
    "setup")
        setup_cron
        ;;
    "remove")
        remove_cron
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
