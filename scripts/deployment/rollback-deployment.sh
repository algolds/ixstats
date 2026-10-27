#!/bin/bash
# Roll production back to an earlier commit, following docs/operations/release-guide.md#rollback.
#
#   ./scripts/deployment/rollback-deployment.sh <remote-branch> [--restore <dump>] [--yes]
#
#   <remote-branch>   A branch on the server's `master` remote that points at the commit to run,
#                     e.g. rollback-2026-10-05 (push it first: git push origin <sha>:refs/heads/rollback-...).
#   --restore <dump>  Restore this pre-deploy dump BEFORE deploying the old code, for releases that
#                     dropped or rewrote data. The dump each deploy took is listed in
#                     backups/deploy-history.log next to the commit it replaced.
#   --yes             Skip the confirmation prompt.
#
# It then runs the deploy script of the release being rolled back (copied before the checkout, so the old
# commit's own copy, which may predate it, never runs) with ALLOW_NON_MASTER_DEPLOY=1 and SKIP_SCHEMA_SYNC=1:
# the same backup, build (the live build is kept until the new one is up), PM2 reload and restart as a
# release, but no schema change. An older schema is never pushed over a newer one: the old code runs
# against the newer additive columns, and a release that dropped or rewrote data needs --restore.
set -euo pipefail

usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

BRANCH=""
DUMP=""
ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) DUMP="${2:-}"; [ -n "$DUMP" ] || usage 1; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) usage 0 ;;
    -*) echo "Unknown option: $1" >&2; usage 1 ;;
    *) [ -z "$BRANCH" ] || usage 1; BRANCH="$1"; shift ;;
  esac
done
[ -n "$BRANCH" ] || { echo "❌ Name the remote branch to roll back to." >&2; usage 1; }

cd "$(dirname "$0")/../.."
[ -f package.json ] || { echo "❌ Run from an IxStats checkout." >&2; exit 1; }

if [ -n "$DUMP" ] && [ ! -f "$DUMP" ]; then
  echo "❌ Dump not found: $DUMP (see backups/deploy-history.log)" >&2
  exit 1
fi

echo "⏪ Rollback to master/$BRANCH"
if [ -n "$DUMP" ]; then
  echo "   then restore $DUMP before deploying"
else
  echo "   Schema: left as it is (no db push of the older schema). The old code ignores the newer additive columns;"
  echo "   if the release dropped or rewrote data, stop here and use --restore <dump> (backups/deploy-history.log)."
fi
if [ "$ASSUME_YES" != "1" ]; then
  read -r -p "Proceed? [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Aborted."; exit 1; }
fi

# This release's deploy script, taken before the checkout replaces it: it keeps the live build until the new
# one is up and honours SKIP_SCHEMA_SYNC, which an older commit's copy may not.
DEPLOY_SCRIPT="$(mktemp "${TMPDIR:-/tmp}/ixstats-rollback-deploy.XXXXXX")"
cp scripts/deploy-production.sh "$DEPLOY_SCRIPT"
chmod +x "$DEPLOY_SCRIPT"
grep -q 'SKIP_SCHEMA_SYNC' "$DEPLOY_SCRIPT" || {
  echo "❌ scripts/deploy-production.sh has no SKIP_SCHEMA_SYNC: roll back by hand (docs/operations/release-guide.md#rollback)" >&2
  exit 1
}

# The server's git remote is itself named `master` (release-guide A3).
git fetch master "$BRANCH"
git checkout -B "$BRANCH" "master/$BRANCH"
echo "✅ Checked out $(git log -1 --oneline)"

if [ -n "$DUMP" ]; then
  # Same env as the deploy script's db:backup: the template, then the secrets.
  set -a
  # shellcheck disable=SC1091
  source .env.production
  # shellcheck disable=SC1091
  [ -f .env.production.local ] && source .env.production.local
  set +a
  echo "🗄️  Restoring $DUMP ..."
  NODE_ENV=production bun run db:restore -- "$DUMP" --yes --i-know-this-is-production
fi

# No schema sync either way: after --restore the database is already at the old schema (the dump was taken
# before the release's SQL and push); without it, pushing the old schema would drop the release's additive columns
# and tables (db push refuses on any with data, which would stop the rollback).
echo "🚀 Deploying $(git log -1 --oneline) without a schema sync (SKIP_SCHEMA_SYNC=1)"
ALLOW_NON_MASTER_DEPLOY=1 SKIP_SCHEMA_SYNC=1 exec "$DEPLOY_SCRIPT"
