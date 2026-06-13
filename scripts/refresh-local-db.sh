#!/bin/bash
set -euo pipefail

echo "Dumping database from production server..."
ssh ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump

echo "Restoring database to local container..."
docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean --if-exists --no-owner < /tmp/ixstats-prod.dump

echo "Local DB refreshed ($(du -h /tmp/ixstats-prod.dump | cut -f1))"

# Ensure local database schema is aligned with the codebase (Prisma 6 CLI doesn't autoload env with config files)
echo "🚀 Syncing database schema with codebase..."
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi
bun run db:push:force


