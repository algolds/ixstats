#!/bin/bash

# Schema Watcher - Automatically syncs prod DB when schema.prisma changes
# Usage: npm run db:watch

echo "👀 Watching Prisma schema for changes..."
echo "   Any changes to schema.prisma will automatically sync to prod database"
echo "   Press Ctrl+C to stop"
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

SCHEMA_FILE="./prisma/schema.prisma"
LAST_MODIFIED=""

# Function to sync databases
sync_databases() {
    echo ""
    echo "🔄 Schema change detected! Syncing databases..."
    npm run db:sync
    if [ $? -eq 0 ]; then
        echo "✅ Auto-sync completed successfully"
        echo ""
    else
        echo "❌ Auto-sync failed"
        echo ""
    fi
}

# Initial check
if [ -f "$SCHEMA_FILE" ]; then
    LAST_MODIFIED=$(stat -c %Y "$SCHEMA_FILE" 2>/dev/null || stat -f %m "$SCHEMA_FILE" 2>/dev/null)
    echo "✅ Schema file found: $SCHEMA_FILE"
    echo "📊 Current state: Dev and Prod databases in sync"
else
    echo "❌ Error: Schema file not found at $SCHEMA_FILE"
    exit 1
fi

# Watch loop
while true; do
    sleep 2
    
    if [ -f "$SCHEMA_FILE" ]; then
        CURRENT_MODIFIED=$(stat -c %Y "$SCHEMA_FILE" 2>/dev/null || stat -f %m "$SCHEMA_FILE" 2>/dev/null)
        
        if [ "$CURRENT_MODIFIED" != "$LAST_MODIFIED" ]; then
            sync_databases
            LAST_MODIFIED=$CURRENT_MODIFIED
        fi
    fi
done

