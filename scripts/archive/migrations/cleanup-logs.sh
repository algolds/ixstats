#!/bin/bash

# IxStats Log and Report Cleanup Script (Shell Version)
# 
# This script performs automated cleanup of logs and audit reports:
# - Deletes files older than 3 days
# - Truncates large files to 10,000 lines
# - Removes duplicate reports
# - Cleans up node_modules logs
#
# Usage: ./scripts/cleanup-logs.sh
# For cron: 0 2 * * * /path/to/ixstats/scripts/cleanup-logs.sh

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/scripts/audit/reports"
MAX_LINES=10000
MAX_AGE_DAYS=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics
DELETED_FILES=0
TRUNCATED_FILES=0
TOTAL_SPACE_SAVED=0

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

format_bytes() {
    local bytes=$1
    if [ $bytes -eq 0 ]; then
        echo "0 B"
    else
        local k=1024
        local sizes=("B" "KB" "MB" "GB")
        local i=$(echo "l($bytes)/l($k)" | bc -l | cut -d. -f1)
        if [ -z "$i" ]; then i=0; fi
        local size=$(echo "scale=2; $bytes/($k^$i)" | bc)
        echo "$size ${sizes[$i]}"
    fi
}

cleanup_old_reports() {
    log "📊 Cleaning up old audit reports..."
    
    if [ ! -d "$REPORTS_DIR" ]; then
        warning "Reports directory not found: $REPORTS_DIR"
        return
    fi
    
    local cutoff_date=$(date -d "$MAX_AGE_DAYS days ago" '+%Y-%m-%d %H:%M:%S')
    
    find "$REPORTS_DIR" -name "*.json" -type f | while read -r file; do
        if [ -f "$file" ]; then
            local file_date=$(stat -c %y "$file" 2>/dev/null || echo "1970-01-01 00:00:00")
            if [[ "$file_date" < "$cutoff_date" ]]; then
                local size=$(stat -c %s "$file" 2>/dev/null || echo 0)
                rm -f "$file"
                DELETED_FILES=$((DELETED_FILES + 1))
                TOTAL_SPACE_SAVED=$((TOTAL_SPACE_SAVED + size))
                echo "  🗑️  Deleted old report: $(basename "$file") ($(format_bytes $size))"
            fi
        fi
    done
}

truncate_large_files() {
    log "📏 Truncating large files..."
    
    if [ ! -d "$REPORTS_DIR" ]; then
        warning "Reports directory not found: $REPORTS_DIR"
        return
    fi
    
    find "$REPORTS_DIR" -name "*.json" -type f | while read -r file; do
        if [ -f "$file" ]; then
            local line_count=$(wc -l < "$file" 2>/dev/null || echo 0)
            if [ $line_count -gt $MAX_LINES ]; then
                local original_size=$(stat -c %s "$file")
                
                # Create backup
                cp "$file" "$file.backup"
                
                # Truncate to last MAX_LINES
                tail -n $MAX_LINES "$file.backup" > "$file"
                
                local new_size=$(stat -c %s "$file")
                local space_saved=$((original_size - new_size))
                
                TRUNCATED_FILES=$((TRUNCATED_FILES + 1))
                TOTAL_SPACE_SAVED=$((TOTAL_SPACE_SAVED + space_saved))
                
                echo "  ✂️  Truncated $(basename "$file"): $line_count → $MAX_LINES lines ($(format_bytes $space_saved) saved)"
                
                # Remove backup
                rm -f "$file.backup"
            fi
        fi
    done
}

remove_duplicate_reports() {
    log "🔄 Removing duplicate reports..."
    
    if [ ! -d "$REPORTS_DIR" ]; then
        warning "Reports directory not found: $REPORTS_DIR"
        return
    fi
    
    # Group files by type and keep only the 3 most recent of each type
    for type in "consolidated" "prod-issues" "live-wiring"; do
        local files=($(find "$REPORTS_DIR" -name "${type}*" -type f | sort -r))
        local count=${#files[@]}
        
        if [ $count -gt 3 ]; then
            local files_to_delete=("${files[@]:3}")
            for file in "${files_to_delete[@]}"; do
                local size=$(stat -c %s "$file" 2>/dev/null || echo 0)
                rm -f "$file"
                DELETED_FILES=$((DELETED_FILES + 1))
                TOTAL_SPACE_SAVED=$((TOTAL_SPACE_SAVED + size))
                echo "  🗑️  Removed duplicate $type: $(basename "$file") ($(format_bytes $size))"
            done
        fi
    done
}

cleanup_log_files() {
    log "📝 Cleaning up log files..."
    
    # Clean up dev.log if it exists and is too large
    local dev_log="$PROJECT_ROOT/dev.log"
    if [ -f "$dev_log" ]; then
        local line_count=$(wc -l < "$dev_log" 2>/dev/null || echo 0)
        if [ $line_count -gt $MAX_LINES ]; then
            local original_size=$(stat -c %s "$dev_log")
            
            # Create backup and truncate
            cp "$dev_log" "$dev_log.backup"
            tail -n $MAX_LINES "$dev_log.backup" > "$dev_log"
            
            local new_size=$(stat -c %s "$dev_log")
            local space_saved=$((original_size - new_size))
            
            TRUNCATED_FILES=$((TRUNCATED_FILES + 1))
            TOTAL_SPACE_SAVED=$((TOTAL_SPACE_SAVED + space_saved))
            
            echo "  ✂️  Truncated dev.log: $line_count → $MAX_LINES lines ($(format_bytes $space_saved) saved)"
            rm -f "$dev_log.backup"
        fi
    fi
    
    # Find and clean up other log files older than MAX_AGE_DAYS
    find "$PROJECT_ROOT" -name "*.log" -type f -not -path "*/node_modules/*" | while read -r file; do
        if [ -f "$file" ] && [ "$file" != "$dev_log" ]; then
            local file_date=$(stat -c %y "$file" 2>/dev/null || echo "1970-01-01 00:00:00")
            local cutoff_date=$(date -d "$MAX_AGE_DAYS days ago" '+%Y-%m-%d %H:%M:%S')
            
            if [[ "$file_date" < "$cutoff_date" ]]; then
                local size=$(stat -c %s "$file" 2>/dev/null || echo 0)
                rm -f "$file"
                DELETED_FILES=$((DELETED_FILES + 1))
                TOTAL_SPACE_SAVED=$((TOTAL_SPACE_SAVED + size))
                echo "  🗑️  Deleted old log: $(basename "$file") ($(format_bytes $size))"
            fi
        fi
    done
}

cleanup_node_modules_logs() {
    log "📦 Cleaning up node_modules logs..."
    
    # Remove yarn-error.log files
    find "$PROJECT_ROOT/node_modules" -name "yarn-error.log" -type f -delete 2>/dev/null || true
    
    # Remove npm-debug.log files
    find "$PROJECT_ROOT/node_modules" -name "npm-debug.log*" -type f -delete 2>/dev/null || true
    
    echo "  🧹 Cleaned up node_modules log files"
}

display_summary() {
    echo ""
    log "📊 Cleanup Summary:"
    echo "  🗑️  Files deleted: $DELETED_FILES"
    echo "  ✂️  Files truncated: $TRUNCATED_FILES"
    echo "  💾 Space saved: $(format_bytes $TOTAL_SPACE_SAVED)"
    echo ""
    success "Cleanup completed successfully!"
}

# Main execution
main() {
    log "🧹 Starting IxStats log and report cleanup..."
    echo ""
    
    cleanup_old_reports
    truncate_large_files
    remove_duplicate_reports
    cleanup_log_files
    cleanup_node_modules_logs
    display_summary
}

# Run main function
main "$@"
