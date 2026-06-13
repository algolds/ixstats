#!/bin/bash
# IxStates Local Dev Startup Script
set -e

# Trap Ctrl+C to clean up background SSH tunnel on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down local development environment..."
    if [ -n "${TUNNEL_PID:-}" ]; then
        echo "🔌 Closing SSH tunnels (PID $TUNNEL_PID)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    echo "👋 Local development environment stopped."
}
trap cleanup EXIT

echo "🔌 Opening SSH tunnels to VPS (Discord-bot on 13001, DB inspector on 15433)..."
# Start the tunnel in the background using ssh -N
ssh -N ixwiki &
TUNNEL_PID=$!
echo "✓ SSH Tunnel PID: $TUNNEL_PID"

echo "🐳 Starting local Docker containers..."
docker compose up -d

# Auto-sync local DB from production
echo "🔄 Syncing database from production..."
if ssh -q -o ConnectTimeout=3 ixwiki "true" 2>/dev/null; then
    ssh ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump
    docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean --if-exists --no-owner --no-privileges < /tmp/ixstats-prod.dump
    echo "✓ Local database refreshed from production dump."
else
    echo "⚠️  Warning: Production server (ixwiki) is not reachable. Skipping database sync and using existing local data."
fi

# Execute start-development.sh to run Next.js and Redis
echo "🚀 Booting development server..."
./start-development.sh

