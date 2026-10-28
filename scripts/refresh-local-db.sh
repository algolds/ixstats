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
# The production dump still has procedural_worlds rows, which db push refuses to drop: the idempotent Atlas Studio SQL
# creates the preset tables and drops the dead models first (as scripts/deploy-production.sh does). Before it, as in the
# deploy: the additive schema changes the SQL reads, the Realms drop of world_configs, and the forum migrations.
bun scripts/deployment/apply-additive-schema.ts --apply
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realms/drop-world-configs.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261008120000_thinkpages_forum/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261009120000_thinkpages_forum_realms/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261010030000_uploaded_assets/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261010120000_thinkpages_forum_moderation/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261011120000_thinkpages_forum_import/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261012120000_thinkpages_forum_followups/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261013120000_thinkpages_forum_foundation/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261014120000_thinkpages_realm_board/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261015120000_thinkpages_forum_engagement/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261016120000_thinkpages_forum_reactions/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261017120000_action_link_rewards/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261018120000_thinkpages_realm_adverts/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261023120000_atlas_studio/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261024120000_vault_hub/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120000_drop_forum_readers/migration.sql
# The cards refresh SQL, in the deploy's order (Phase 1's backfill between its SQL and its constraints)
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120000_cards_foundations/migration.sql
bun scripts/cards/backfill-cards-refresh.ts --apply
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261028120000_cards_admin/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261031120000_cards_face_hub/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261101120000_cards_economy/migration.sql
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261102120000_cards_categories/migration.sql
# The IxnayID name claims and revision tag tables, the IxWiki links converted into claims, then the legacy columns
# and IxWiki links dropped
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120000_ixnayid_claims/migration.sql
bun scripts/identity/convert-wiki-name-claims.ts --apply
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120001_ixnayid_drop_legacy/migration.sql
# The native lore team and lore page curation tables
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261104120000_country_lore/migration.sql
# The WikiOS conflict log, the old parks as legacy rows, the park re-push jobs retired
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261105120000_wikios_conflicts/migration.sql
# The inbound sync's dead letters (a step failing five cycles is quarantined)
bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261105120001_wikios_sync_dead_letters/migration.sql
# MyCountry fixes and realm time (docs/history/operations/deploy-mycountry-2026-10.md, deploy-realm-time-2026-10.md): the data
# SQL in the runbooks' order. Realm time drops the legacy security tables and retypes military columns, which db push
# refuses to do. Idempotent; the runbooks' manual run_sql steps and the starter-force reset stay as written.
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/h-meeting-intent-columns.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/a1-storyteller-effects.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/a2-units-and-scales.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/de-relation-bands.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/f-defense.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/r1-coercive-fp-effects.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t1-realm-clocks.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t3-platform-real-time.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t3b-sports-intervals.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d2a-defense-model.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d3-combat.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql
bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/r3-catalog-duplicates.sql
bun run db:push:force

# Verify and auto-heal WikiOS articles and categories in PostgreSQL
echo "📚 Verifying WikiOS database persistence..."
bun run scripts/setup/check-wikios-db.ts



