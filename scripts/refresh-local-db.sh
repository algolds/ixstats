#!/bin/bash
set -euo pipefail

echo "Dumping database from production server..."
ssh ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump

# Detect if docker can be run without sudo, fallback to sudo if needed
if docker ps >/dev/null 2>&1; then
    DOCKER_CMD="docker"
else
    DOCKER_CMD="sudo docker"
fi

echo "Restoring database to local container..."
# Ensure the ixstats_readonly role exists in the local postgres cluster so pg_restore doesn't fail on
# grants. The password comes from IXSTATS_READONLY_PASSWORD (set it to the one in your .env.local.dev
# DATABASE_URL if you connect as ixstats_readonly); without it the role is created without login.
# When the password is supplied, an existing role (e.g. one created earlier without login) is
# updated to it.
READONLY_PASSWORD="${IXSTATS_READONLY_PASSWORD:-}"
if [ -n "$READONLY_PASSWORD" ]; then
    READONLY_ROLE_OPTS="LOGIN PASSWORD '${READONLY_PASSWORD//\'/\'\'}'"
    READONLY_EXISTING="ALTER ROLE ixstats_readonly WITH $READONLY_ROLE_OPTS;"
else
    READONLY_ROLE_OPTS="NOLOGIN"
    READONLY_EXISTING="NULL;"
    echo "ℹ️  IXSTATS_READONLY_PASSWORD not set: a missing ixstats_readonly role is created without login."
fi
$DOCKER_CMD exec -i ixstats-postgres psql -U postgres -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ixstats_readonly') THEN CREATE ROLE ixstats_readonly WITH $READONLY_ROLE_OPTS; ELSE $READONLY_EXISTING END IF; END \$\$;"

$DOCKER_CMD exec -i ixstats-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ixstats WITH (FORCE);"
$DOCKER_CMD exec -i ixstats-postgres psql -U postgres -d postgres -c "CREATE DATABASE ixstats;"
$DOCKER_CMD exec -i ixstats-postgres pg_restore -U postgres -d ixstats --no-owner < /tmp/ixstats-prod.dump

echo "Local DB refreshed ($(du -h /tmp/ixstats-prod.dump | cut -f1))"

echo "🖼️  Syncing gitignored static assets (images, flags, textures, sounds)..."
rsync -avz --exclude="images/uploads/" --exclude="images/downloaded/" --exclude="images/uploads_backup/" ixwiki:/ixwiki/public/projects/ixstats/public/ public/
echo "✓ Static assets synced."

# Ensure local database schema is aligned with the codebase (Prisma 6 CLI doesn't autoload env with config files)
echo "🚀 Syncing database schema with codebase..."
bun run db:push:force

# Verify and auto-heal WikiOS articles and categories in PostgreSQL
echo "📚 Verifying WikiOS database persistence..."
bun run scripts/setup/check-wikios-db.ts



