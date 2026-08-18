#!/bin/bash
# IxStates Local Dev Startup Script
set -e

CONTROL_PATH="/tmp/ssh-control-%r@%h:%p"

# Trap Ctrl+C to clean up background SSH tunnel on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down local development environment..."
    echo "🔌 Closing SSH master connection..."
    ssh -S "$CONTROL_PATH" -O exit ixwiki 2>/dev/null || true
    echo "👋 Local development environment stopped."
}
trap cleanup EXIT

echo "🔌 Opening SSH master connection to VPS (Discord-bot on 13001, DB inspector on 15433)..."
# Start the master multiplex connection in background (prompts for passphrase exactly once)
ssh -f -N -M -S "$CONTROL_PATH" -o ControlPersist=10m ixwiki

echo "🐳 Starting local Docker containers..."
docker compose up -d

# Auto-sync local DB from production
echo "🔄 Syncing database from production..."
if ssh -q -o ConnectTimeout=3 -S "$CONTROL_PATH" ixwiki "true" 2>/dev/null; then
    if ssh -S "$CONTROL_PATH" ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump 2>/dev/null; then
        docker exec -i ixstats-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ixstats WITH (FORCE);"
        docker exec -i ixstats-postgres psql -U postgres -d postgres -c "CREATE DATABASE ixstats;"
        docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --no-owner --no-privileges < /tmp/ixstats-prod.dump
        rm -f .prisma/.schema-push-stamp
        echo "✓ Local database refreshed from production dump."
        
        echo "🖼️  Syncing gitignored static assets (images, flags, textures, sounds)..."
        if rsync -avz -e "ssh -S '$CONTROL_PATH'" --exclude="images/uploads/" --exclude="images/downloaded/" --exclude="images/uploads_backup/" ixwiki:/ixwiki/public/projects/ixstats/public/ public/ 2>/dev/null; then
            echo "✓ Static assets synced."
        else
            echo "⚠️  Warning: Failed to sync static assets. Continuing with existing assets."
        fi
    else
        echo "⚠️  Warning: Failed to dump production database. Skipping database sync and using existing local data."
    fi
else
    echo "⚠️  Warning: Production server (ixwiki) is not reachable. Skipping database sync and using existing local data."
fi

# Execute start-development.sh to run Next.js and Redis
echo "🚀 Booting development server..."
./start-development.sh

