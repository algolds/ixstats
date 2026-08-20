#!/bin/bash
# scripts/setup-flag-cache-cron.sh
# Setup script for monthly flag cache update cron job

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UPDATE_SCRIPT="$SCRIPT_DIR/update-flag-cache.js"
LOG_DIR="/var/log/ixstats"
CRON_LOG="$LOG_DIR/flag-cache-update.log"
CRON_ERROR_LOG="$LOG_DIR/flag-cache-update-error.log"

# Default values
APP_URL=""
CRON_SCHEDULE="0 2 1 * *" # 2 AM on the 1st of every month
USER=$(whoami)

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Flag Cache Cron Setup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL           Application URL (required)"
    echo "  -s, --schedule SCHEDULE  Cron schedule (default: '0 2 1 * *')"
    echo "  -l, --log-dir DIR        Log directory (default: /var/log/ixstats)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -u https://stats.ixwiki.com"
    echo "  $0 -u https://stats.ixwiki.com -s '0 3 1 * *'"
    echo "  $0 -u https://stats.ixwiki.com -l /home/user/logs"
    echo ""
    echo "Cron Schedule Format:"
    echo "  minute hour day month weekday"
    echo "  Examples:"
    echo "    '0 2 1 * *'     - 2 AM on the 1st of every month"
    echo "    '0 3 15 * *'    - 3 AM on the 15th of every month"
    echo "    '0 1 * * 0'     - 1 AM every Sunday"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            APP_URL="$2"
            shift 2
            ;;
        -s|--schedule)
            CRON_SCHEDULE="$2"
            shift 2
            ;;
        -l|--log-dir)
            LOG_DIR="$2"
            CRON_LOG="$LOG_DIR/flag-cache-update.log"
            CRON_ERROR_LOG="$LOG_DIR/flag-cache-update-error.log"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$APP_URL" ]]; then
    print_error "Application URL is required"
    show_usage
    exit 1
fi

# Validate URL format
if [[ ! "$APP_URL" =~ ^https?:// ]]; then
    print_error "Invalid URL format: $APP_URL"
    exit 1
fi

print_status "Setting up flag cache cron job..."
print_status "Application URL: $APP_URL"
print_status "Cron Schedule: $CRON_SCHEDULE"
print_status "Log Directory: $LOG_DIR"
print_status "User: $USER"

# Check if update script exists
if [[ ! -f "$UPDATE_SCRIPT" ]]; then
    print_error "Update script not found: $UPDATE_SCRIPT"
    exit 1
fi

# Make update script executable
print_status "Making update script executable..."
chmod +x "$UPDATE_SCRIPT"
print_success "Update script is now executable"

# Create log directory
print_status "Creating log directory..."
if [[ ! -d "$LOG_DIR" ]]; then
    if mkdir -p "$LOG_DIR" 2>/dev/null; then
        print_success "Created log directory: $LOG_DIR"
    else
        print_warning "Could not create log directory: $LOG_DIR"
        print_warning "You may need to create it manually or run with sudo"
    fi
else
    print_success "Log directory already exists: $LOG_DIR"
fi

# Set log directory permissions
if [[ -d "$LOG_DIR" ]]; then
    print_status "Setting log directory permissions..."
    chmod 755 "$LOG_DIR" 2>/dev/null || print_warning "Could not set log directory permissions"
fi

# Create log files if they don't exist
print_status "Creating log files..."
touch "$CRON_LOG" 2>/dev/null || print_warning "Could not create log file: $CRON_LOG"
touch "$CRON_ERROR_LOG" 2>/dev/null || print_warning "Could not create error log file: $CRON_ERROR_LOG"

# Set log file permissions
if [[ -f "$CRON_LOG" ]]; then
    chmod 644 "$CRON_LOG" 2>/dev/null || print_warning "Could not set log file permissions"
fi

if [[ -f "$CRON_ERROR_LOG" ]]; then
    chmod 644 "$CRON_ERROR_LOG" 2>/dev/null || print_warning "Could not set error log file permissions"
fi

# Create the cron job command
CRON_COMMAND="$CRON_SCHEDULE cd $PROJECT_DIR && NEXT_PUBLIC_APP_URL=$APP_URL node $UPDATE_SCRIPT update >> $CRON_LOG 2>> $CRON_ERROR_LOG"

# Check if cron job already exists
print_status "Checking for existing cron job..."
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "$UPDATE_SCRIPT" || true)

if [[ -n "$EXISTING_CRON" ]]; then
    print_warning "Existing cron job found:"
    echo "$EXISTING_CRON"
    echo ""
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setup cancelled"
        exit 0
    fi
    
    # Remove existing cron job
    print_status "Removing existing cron job..."
    (crontab -l 2>/dev/null | grep -v -F "$UPDATE_SCRIPT") | crontab -
    print_success "Existing cron job removed"
fi

# Add new cron job
print_status "Adding new cron job..."
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -
print_success "Cron job added successfully"

# Verify cron job was added
print_status "Verifying cron job..."
VERIFIED_CRON=$(crontab -l 2>/dev/null | grep -F "$UPDATE_SCRIPT" || true)

if [[ -n "$VERIFIED_CRON" ]]; then
    print_success "Cron job verified:"
    echo "$VERIFIED_CRON"
else
    print_error "Failed to verify cron job was added"
    exit 1
fi

# Test the script
print_status "Testing the update script..."
if cd "$PROJECT_DIR" && NEXT_PUBLIC_APP_URL="$APP_URL" node "$UPDATE_SCRIPT" status >/dev/null 2>&1; then
    print_success "Script test passed"
else
    print_warning "Script test failed - this may be normal if the application is not running"
fi

# Show current crontab
print_status "Current crontab:"
crontab -l 2>/dev/null || print_warning "No crontab found"

echo ""
print_success "Flag cache cron job setup completed!"
echo ""
echo "Summary:"
echo "  - Cron job will run: $CRON_SCHEDULE"
echo "  - Application URL: $APP_URL"
echo "  - Log file: $CRON_LOG"
echo "  - Error log: $CRON_ERROR_LOG"
echo ""
echo "To manually test the script:"
echo "  cd $PROJECT_DIR"
echo "  NEXT_PUBLIC_APP_URL=$APP_URL node $UPDATE_SCRIPT status"
echo ""
echo "To view logs:"
echo "  tail -f $CRON_LOG"
echo "  tail -f $CRON_ERROR_LOG"
echo ""
echo "To remove the cron job:"
echo "  crontab -e"
echo "  (then delete the line containing $UPDATE_SCRIPT)" 