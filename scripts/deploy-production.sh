#!/bin/bash

# Production Deployment Script for IxStats
# Ensures the app is configured for https://ixwiki.com/projects/ixstates
#
# Order: git sync and checks; dependencies and the Prisma client; the database backup; the additive schema step, the
# WikiOS proof check, the hand-written SQL, db push and the post-push SQL; the build; the PM2 reload; the
# web server, and once it answers the post-deploy data SQL (run_post_deploy_sql). Nothing before the build touches the
# live build (.next), so a failure there leaves a running server serving what it has loaded; but the dependencies step
# has already replaced node_modules with the release's, so never start a stopped server on this checkout. The build moves .next to .next.prev first and puts it back if anything fails before the new server answers; .next.prev
# is deleted once it does.
#
# SKIP_SCHEMA_SYNC=1 runs everything but the schema work (the additive step, the SQL and db push): for a rollback to
# older code (scripts/deployment/rollback-deployment.sh), where an older schema must never be pushed over a newer one.

set -e

echo "🚀 Starting production deployment for IxStates..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Auto git sync if in production VPS directory
if [ "$(pwd)" = "/ixwiki/public/projects/ixstats" ]; then
    echo "🔄 Production VPS directory detected. Force-syncing with the latest git commit..."
    if command -v git &> /dev/null; then
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "master")
        if [ -z "$CURRENT_BRANCH" ]; then
            CURRENT_BRANCH="master"
        fi
        # Production deploys master (rose-garden is nightly, development is stable-experimental;
        # see docs/processes/contributing.md#branches). Override only on purpose.
        if [ "$CURRENT_BRANCH" != "master" ] && [ "${ALLOW_NON_MASTER_DEPLOY:-}" != "1" ]; then
            echo "❌ Refusing to deploy branch '$CURRENT_BRANCH' to production: check out master, or set ALLOW_NON_MASTER_DEPLOY=1"
            exit 1
        fi
        echo "📄 Fetching $CURRENT_BRANCH from master and resetting --hard to FETCH_HEAD..."
        git fetch master "$CURRENT_BRANCH"
        git checkout -f "$CURRENT_BRANCH"
        git reset --hard FETCH_HEAD
        git clean -fd
        echo "✅ Git sync complete. Current commit: $(git log -1 --oneline)"
    else
        echo "⚠️ Warning: git command not found. Skipping git sync."
    fi
fi

# The commit this deploy builds, exported so cron and the websockets (and a manual deploy-ixworld.sh) run the same one.
IXSTATS_DEPLOY_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
export IXSTATS_DEPLOY_COMMIT

# Set production environment
export NODE_ENV=production

if [ -f ".env.production" ]; then
    echo "📄 Loading production environment variables..."
    export $(grep -v '^#' .env.production | grep -v '^\s*$' | xargs 2>/dev/null)
else
    echo "❌ Error: .env.production file not found"
    exit 1
fi

if [ -f ".env.production.local" ]; then
    echo "🔐 Loading production secrets from .env.production.local..."
    export $(grep -v '^#' .env.production.local | grep -v '^\s*$' | xargs 2>/dev/null)
fi

# Ensure base path variables are present before build/start so chunks map correctly.
normalize_base_path() {
    local value="$1"

    if [ -z "$value" ]; then
        echo ""
        return
    fi

    if [[ "$value" != /* ]]; then
        value="/$value"
    fi

    if [[ "$value" != "/" ]]; then
        value="${value%/}"
    fi

    echo "$value"
}

if [ -z "${BASE_PATH+x}" ]; then
    BASE_PATH="/projects/ixstates"
fi

BASE_PATH="$(normalize_base_path "$BASE_PATH")"

if [ -z "${NEXT_PUBLIC_BASE_PATH+x}" ]; then
    NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
fi

NEXT_PUBLIC_BASE_PATH="$(normalize_base_path "$NEXT_PUBLIC_BASE_PATH")"

export BASE_PATH NEXT_PUBLIC_BASE_PATH

# Check required environment variables
required_vars=("DATABASE_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    echo "Please set these variables in .env.production before running the deployment script."
    exit 1
fi

# Check if Clerk is configured (optional)
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && [ -n "$CLERK_SECRET_KEY" ]; then
    # Validate production keys (not test keys)
    if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" == pk_test_* ]]; then
        echo "❌ Error: Using test Clerk keys in production. Please update to production keys."
        exit 1
    fi
    
    if [[ "$CLERK_SECRET_KEY" == sk_test_* ]]; then
        echo "❌ Error: Using test Clerk secret in production. Please update to production keys."
        exit 1
    fi
    
    echo "✅ Clerk authentication configured"
else
    echo "ℹ️  Clerk authentication disabled (no keys provided)"
fi

# Validate database URL (PostgreSQL required for production)
if [[ "$DATABASE_URL" == postgres* ]] || [[ "$DATABASE_URL" == postgresql* ]]; then
    # Host and database only: the URL's user:password part never reaches the deploy log.
    DB_DISPLAY="${DATABASE_URL%%\?*}"
    DB_DISPLAY="${DB_DISPLAY#*://}"
    echo "✅ Using PostgreSQL database: ${DB_DISPLAY#*@}"
else
    echo "❌ Error: Production requires PostgreSQL database."
    echo "   Current DATABASE_URL does not appear to be PostgreSQL."
    echo "   Expected format: postgresql://user:password@host:port/database"
    exit 1
fi

echo "✅ Environment variables validated"
echo "   BASE_PATH: $BASE_PATH"
echo "   NEXT_PUBLIC_BASE_PATH: $NEXT_PUBLIC_BASE_PATH"

# Set default port if not configured
if [ -z "${PORT+x}" ] || [ -z "$PORT" ]; then
    PORT="3550"
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install --frozen-lockfile

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
bun run db:generate

# Back up the database before the schema sync; never push the schema without a dump
echo "💾 Backing up production database (backups/ixstats-<UTC timestamp>.dump)..."
if bun run db:backup; then
    echo "✅ Database backup completed"
    # One line per deploy: when, the commit going live, and the dump to restore if it must be undone
    # (read by scripts/deployment/rollback-deployment.sh --restore).
    LATEST_DUMP=$(ls -1t backups/ixstats-*.dump 2>/dev/null | head -n 1 || true)
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $(git rev-parse --short HEAD 2>/dev/null || echo unknown) ${LATEST_DUMP:-none}" >> backups/deploy-history.log
else
    echo "❌ Database backup failed - aborting deployment before the schema sync"
    exit 1
fi

if [ "${SKIP_SCHEMA_SYNC:-}" != "1" ]; then
    # The SQL below reads tables and columns only db push creates (job_leases, realm_pages, wiki_mirror_jobs,
    # Country.ownerUserId, ...), and the push cannot run before it (required columns without a default meet non-empty
    # tables; it would drop what the SQL still converts). This applies only the additive part of the schema difference,
    # in one transaction, and leaves everything the SQL creates or converts to the SQL (scripts/deployment/additive-schema.ts).
    echo "🧱 Applying the additive schema changes..."
    bun scripts/deployment/apply-additive-schema.ts --apply || exit 1
fi

# WikiOS gold proof (docs/audits/wikios-proof/README.md): refuses a release whose WikiOS code has no committed passing
# proof, or whose editor round trip changes a byte of the production corpus. Reads only, besides the wikios-proof job
# lease it holds until the PM2 reload below, so the weekly proof never runs mid-deploy (a refusal releases it, and a
# deploy that dies on the way leaves it to expire in 2 hours). It runs after the backup and the additive step, which
# creates job_leases on a database that lacks it. A refusal leaves the live build (.next) serving and changes no data,
# but the steps above stay done: the checkout is reset to this release, its dependencies installed, the database backed
# up and the additive schema changes applied. WIKIOS_PROOF_OVERRIDE=1 deploys anyway.
# A rollback runs this script against an older checkout; one from before the proof existed has no proof to check.
if [ -f scripts/audit/wikios-proof.ts ]; then
    echo "🧪 Checking the WikiOS proof..."
    bun scripts/audit/wikios-proof.ts predeploy || exit 1
else
    echo "⏭️  No scripts/audit/wikios-proof.ts in this checkout (older than the WikiOS proof): proof check skipped"
fi

if [ "${SKIP_SCHEMA_SYNC:-}" = "1" ]; then
    echo "⏭️  SKIP_SCHEMA_SYNC=1: the additive step, the deploy SQL and db push are skipped; the schema stays as it is"
else
    # Realms (rose-garden runbook 5a): the schema dropped world_configs (1 row) and territory_claims, which db push
    # refuses to drop without a prompt it cannot answer here. Owner-approved data drop; the backup above keeps the row.
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realms/drop-world-configs.sql || exit 1
    # ThinkPages forum (docs/operations/deployment.md, build step 2), in order and before the push, so the push finds
    # their unique keys already there. Each is idempotent. The partial indexes (forum_categories_site_key_unique,
    # forum_posts_stale_idx), the mod log's append-only triggers and the seeded categories have no Prisma form, but
    # Prisma 6.19's db push never reads partial indexes or triggers (its index query filters `indpred IS NULL`), so
    # it leaves them alone and they need no re-apply after it. 20261015 creates forum_readers, which the forum readers
    # SQL below drops again.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261008120000_thinkpages_forum/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261009120000_thinkpages_forum_realms/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261010030000_uploaded_assets/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261010120000_thinkpages_forum_moderation/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261011120000_thinkpages_forum_import/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261012120000_thinkpages_forum_followups/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261013120000_thinkpages_forum_foundation/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261014120000_thinkpages_realm_board/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261015120000_thinkpages_forum_engagement/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261016120000_thinkpages_forum_reactions/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261017120000_action_link_rewards/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261018120000_thinkpages_realm_adverts/migration.sql || exit 1

    # Atlas and World Studio (docs/history/specs/2026-10-12-atlas-studio-design.md): creates the preset tables and drops the dead
    # procedural_worlds, world_templates and realms.templateId. Idempotent, and it must run BEFORE the push: with the models
    # gone from the schema, db push refuses to drop the non-empty procedural_worlds table and would abort the deploy.
    echo "🔄 Applying the Atlas Studio SQL..."
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261023120000_atlas_studio/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261024120000_vault_hub/migration.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120000_drop_forum_readers/migration.sql || exit 1
    # Cards refresh Phase 1 (docs/specs/2026-10-15-cards-refresh-design.md §5.5): the additive SQL, the backfill, then the
    # constraints, all BEFORE the push. The constraints convert cards.rarity and cardType to enums in place (db push would
    # drop and re-add those columns) and refuse to run until the backfill has. Stop the app before this deploy (plan
    # 2026-10-15-cards-refresh-phase-1-foundations, owner runbook). Re-runs are no-ops.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120000_cards_foundations/migration.sql || exit 1
    bun scripts/cards/backfill-cards-refresh.ts --apply || exit 1
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql || exit 1
    # Cards refresh Phase 2 (docs/specs/2026-10-15-cards-refresh-design.md §2.4): review state, import jobs, licences,
    # takedowns, Special card fields, a SET NULL transfer-event FK, the legacy Commons tag. Idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261028120000_cards_admin/migration.sql || exit 1
    # Cards refresh Phase 3 (docs/specs/2026-10-15-cards-refresh-design.md §2.3): collector numbers, the showcase pin and its
    # detach trigger, and the drop of collection likes and comments (BEFORE the push, which cannot drop them). Idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261031120000_cards_face_hub/migration.sql || exit 1
    # Cards refresh Phase 4 (docs/specs/2026-10-15-cards-refresh-design.md §2.2): listings, dust, market prices, mutes,
    # inscription reports, and the trade and auction status enums converted in place (BEFORE the push). Idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261101120000_cards_economy/migration.sql || exit 1
    # Card categories (docs/history/specs/2026-10-23-card-categories-design.md): the category source, confidence and
    # review columns and the suggestions table. Additive and idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261102120000_cards_categories/migration.sql || exit 1
    # IxnayID identity (design 2026-10-23): the name claims and revision tag tables. Additive and idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120000_ixnayid_claims/migration.sql || exit 1
    # The IxWiki links and legacy wiki names become name claims (design decision 8). A re-run writes nothing.
    bun scripts/identity/convert-wiki-name-claims.ts --apply || exit 1
    # The IxWiki link rows go (the legacy User columns stay one release, @ignore, for the old app during the build).
    # Refuses if the conversion never ran; idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120001_ixnayid_drop_legacy/migration.sql || exit 1
    # Native lore (docs/specs/2026-10-24-native-lore-design.md): the lore team and lore page curation tables.
    # Additive and idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261104120000_country_lore/migration.sql || exit 1
    # WikiOS data safety (docs/superpowers/plans/2026-10-24-wikios-data-safety.md): the conflict log, the old parks turned into
    # legacy rows, the park re-push jobs retired. Additive and idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261105120000_wikios_conflicts/migration.sql || exit 1
    # WikiOS data safety (A5): the inbound sync's dead letters (a step failing five cycles is quarantined and the mark moves
    # past it). Additive and idempotent.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261105120001_wikios_sync_dead_letters/migration.sql || exit 1

    # MyCountry fixes and realm time (docs/history/operations/deploy-mycountry-2026-10.md, deploy-realm-time-2026-10.md): the data
    # SQL in the runbooks' order. Realm time drops the legacy security tables and retypes military columns, which db push
    # refuses to do. Idempotent; the runbooks' manual run_sql steps and the starter-force reset stay as written.
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/h-meeting-intent-columns.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/a1-storyteller-effects.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/a2-units-and-scales.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/de-relation-bands.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/f-defense.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-mycountry/r1-coercive-fp-effects.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t1-realm-clocks.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t3-platform-real-time.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/t3b-sports-intervals.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d2a-defense-model.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d3-combat.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-realm-time/r3-catalog-duplicates.sql || exit 1
    # MyCountry stress test (plans: findings A/B/C): placeholder zeros to null, party drift clock, alliance founders, budget balance in currency. Idempotent.
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/a-null-placeholder-zero-economics.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/b-political-party-drifted-at.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/c-alliance-founders.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/c-budget-balance-currency.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/t-issue-template-triggers.sql || exit 1
    bunx prisma db execute --schema prisma/schema --file scripts/migrations/2026-10-stress/s-empty-component-effectiveness.sql || exit 1

    # Sync production database with schema. Without --accept-data-loss it stops (non-zero) on any data-loss warning
    # rather than prompting; the live build is still untouched at this point.
    echo "🔄 Syncing production database schema..."
    if bun run db:push:force; then
        echo "✅ Database sync completed successfully"
        # db push never runs migration SQL; this data rename is idempotent (IxWorld realm → Ixnay).
        # ponytail: one-off line; drop it once prod's realm row reads Ixnay.
        bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261019120000_rename_ixworld_realm_ixnay/migration.sql || exit 1
        # Atlas Release 0 (docs/history/specs/2026-10-11-atlas-release-0-performance-design.md): the Country geom_postgis trigger and
        # backfill and the atlas_country_union function the code calls. Idempotent; must be in place before the new code runs.
        bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261021120000_atlas_r0/migration.sql || exit 1
        # Atlas Release A (docs/history/specs/2026-10-11-atlas-release-a-world-creation-design.md): Country.worldgen and
        # Country.claimable, which db push also adds; idempotent, and must be in place before the new code runs.
        bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261022120000_atlas_ra/migration.sql || exit 1
    else
        echo "❌ Database sync failed (the live build is untouched)"
        exit 1
    fi
fi

# The live build moves aside rather than being deleted, and comes back if the deploy stops before the new server
# answers (a failed build, IxWorld or PM2 reload). A deploy killed outright leaves it in .next.prev: put it back first.
NEXT_PREV=".next.prev"
restore_previous_build() {
    if [ -d "$NEXT_PREV" ]; then
        echo "↩️  Restoring the previous build from $NEXT_PREV"
        rm -rf .next
        mv "$NEXT_PREV" .next
    fi
}
if [ -d ".next.ixstats-saved" ]; then
    # deploy-ixworld.sh was killed while the IxWorld build sat in .next
    rm -rf .next
    mv .next.ixstats-saved .next
fi
if [ -d "$NEXT_PREV" ]; then
    if [ -f ".next/BUILD_ID" ]; then
        rm -rf "$NEXT_PREV"
    else
        restore_previous_build
    fi
fi
if [ -d ".next" ]; then
    mv .next "$NEXT_PREV"
fi
trap restore_previous_build EXIT
trap 'exit 1' INT TERM

# Build the application
echo "🔨 Building application..."
if bun run build; then
    echo "✅ Build completed successfully"
else
    echo "❌ Build failed"
    exit 1
fi

# No separate IxWorld build: maps.ixwiki.com is the main app's /maps page (nginx sends the map and its requests to this
# web app, every other page to beta.ixwiki.com; 2026-10-27). scripts/deploy-ixworld.sh stays for a manual standalone build.

# A non-5xx answer on the web port: the new server is up.
wait_for_web() {
    local url="http://127.0.0.1:${PORT}${BASE_PATH}" code
    for _ in $(seq 1 60); do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)" || code="000"
        if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# Data SQL that must wait until the new code is live, because it points rows at pages the old build cannot serve. Run
# once the new server answers, idempotent, and never under SKIP_SCHEMA_SYNC (a rollback's old code lacks those
# pages). A failure only warns: the release is already up; run the file again by hand.
run_post_deploy_sql() {
    [ "${SKIP_SCHEMA_SYNC:-}" = "1" ] && return 0
    # Rose-garden runbook 5e: stored notification links to legacy URLs whose redirects the new code dropped.
    bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261028120000_rewrite_legacy_notification_links/migration.sql || echo "⚠️  Rewriting the legacy notification links failed: run prisma/migrations/20261028120000_rewrite_legacy_notification_links/migration.sql by hand"
}

# The PIDs listening on a TCP port.
port_pids() {
    { lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || fuser "$1"/tcp 2>/dev/null; } | xargs
}

# Stops whatever listens on the port: SIGTERM, up to 30 seconds to exit, then SIGKILL.
stop_port() {
    local port="$1" pids
    pids="$(port_pids "$port")"
    [ -z "$pids" ] && return 0
    echo "Stopping the process on port $port (SIGTERM: $pids)..."
    kill -TERM $pids 2>/dev/null || true
    for _ in $(seq 1 30); do
        sleep 1
        [ -z "$(port_pids "$port")" ] && return 0
    done
    pids="$(port_pids "$port")"
    echo "⚠️  Still running after 30 seconds: SIGKILL ($pids)"
    [ -n "$pids" ] && kill -KILL $pids 2>/dev/null || true
}

# The web app runs under PM2 when ecosystem.config.cjs defines ixstats-web (template: ecosystem.config.example.cjs),
# otherwise in the foreground, as start-production.sh always has.
WEB_UNDER_PM2=0
if command -v pm2 &> /dev/null && [ -f ecosystem.config.cjs ] && bun -e 'const c = require(process.cwd() + "/ecosystem.config.cjs"); process.exit((c.apps ?? []).some((a) => a.name === "ixstats-web") ? 0 : 1)' 2>/dev/null; then
    WEB_UNDER_PM2=1
fi

# Reload standalone PM2 processes (cron, websockets, sync, and the web app when it is a PM2 app)
echo "🔄 Reloading PM2 processes (cron, websockets, sync)..."
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  pm2 not found: cron, websockets and IxTwitter sync were NOT reloaded"
elif [ ! -f ecosystem.config.cjs ]; then
    echo "⚠️  ecosystem.config.cjs missing (template: ecosystem.config.example.cjs): PM2 processes were NOT reloaded"
else
    if [ "$WEB_UNDER_PM2" = "1" ]; then
        WEB_PM2_PID="$(pm2 pid ixstats-web 2>/dev/null | tail -n 1 || true)"
        if [ -z "$WEB_PM2_PID" ] || [ "$WEB_PM2_PID" = "0" ]; then
            # First deploy under PM2: the server start-production.sh ran in the foreground still holds the port.
            stop_port "$PORT"
        fi
    fi
    # A failed reload aborts the deploy instead of leaving stale cron/ws processes running silently.
    pm2 startOrReload ecosystem.config.cjs --update-env --silent
fi

# The weekly WikiOS proof may run again: release the lease the proof check took. A failed release only means the lease
# expires on its own, 2 hours after the check.
[ -f scripts/audit/wikios-proof.ts ] && { bun scripts/audit/wikios-proof.ts deployed || true; }

# Display production configuration
echo ""
echo "🎯 Production Configuration:"
echo "   Base URL: ${NEXT_PUBLIC_APP_URL:-https://ixwiki.com$BASE_PATH}"
echo "   Node Environment: $NODE_ENV"
echo "   Database: Configured"
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && [ -n "$CLERK_SECRET_KEY" ]; then
    echo "   Authentication: Clerk enabled"
else
    echo "   Authentication: Disabled"
fi
echo ""

if [ "$WEB_UNDER_PM2" = "1" ]; then
    echo "⏳ Waiting for ixstats-web on port $PORT..."
    trap - EXIT
    if wait_for_web; then
        rm -rf "$NEXT_PREV"
        echo "✅ ixstats-web is up under PM2: ${NEXT_PUBLIC_APP_URL:-https://ixwiki.com$BASE_PATH} (pm2 logs ixstats-web)"
        run_post_deploy_sql
        exit 0
    fi
    echo "❌ ixstats-web did not answer on port $PORT: check pm2 logs ixstats-web. The previous build is kept in $NEXT_PREV."
    exit 1
fi

# Stop the server on the target port (to avoid EADDRINUSE), gracefully first
echo "Stopping any existing process on port $PORT..."
stop_port "$PORT"

# Start the production server
echo "🚀 Starting production server..."
echo "   The application will be available at: ${NEXT_PUBLIC_APP_URL:-https://ixwiki.com$BASE_PATH}"
echo "   Production server will run on port: $PORT"
echo "   Press Ctrl+C to stop the server"
echo ""

# start-production.sh keeps the foreground, as before; the previous build goes once the new server answers.
trap - EXIT
(
    if wait_for_web; then
        rm -rf "$NEXT_PREV"
        run_post_deploy_sql
    else
        echo "⚠️  The server did not answer on port $PORT within 2 minutes; the previous build is kept in $NEXT_PREV"
    fi
) &

# Use simplified production start script
exec ./start-production.sh
