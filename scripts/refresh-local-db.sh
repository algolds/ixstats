#!/bin/bash
set -euo pipefail

echo "Dumping database from production server..."
ssh ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump

echo "Restoring database to local container..."
docker exec -i ixstats-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ixstats WITH (FORCE);"
docker exec -i ixstats-postgres psql -U postgres -d postgres -c "CREATE DATABASE ixstats;"
docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --no-owner < /tmp/ixstats-prod.dump

echo "Local DB refreshed ($(du -h /tmp/ixstats-prod.dump | cut -f1))"

echo "🖼️  Syncing gitignored static assets (images, flags, textures, sounds)..."
rsync -avz --exclude="images/uploads/" --exclude="images/downloaded/" --exclude="images/uploads_backup/" ixwiki:/ixwiki/public/projects/ixstats/public/ public/
echo "✓ Static assets synced."

# Ensure local database schema is aligned with the codebase (Prisma 6 CLI doesn't autoload env with config files)
echo "🚀 Syncing database schema with codebase..."
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi
bun run db:push:force


