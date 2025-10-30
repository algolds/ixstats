#!/bin/bash

# Database Sync Script - Syncs production database schema with development
# This ensures prod database is always up-to-date with schema changes
#
# ⚠️  POSTGRESQL MIGRATION NOTICE ⚠️
# This script has been disabled as IxStats now uses PostgreSQL instead of SQLite.
#
# To sync schema changes to production with PostgreSQL:
#
#   RECOMMENDED APPROACH (Schema migrations only - SAFE):
#   1. Ensure migrations are up-to-date in development:
#      npx prisma migrate dev
#
#   2. Deploy migrations to production:
#      DATABASE_URL="postgresql://..." npx prisma migrate deploy
#
#   ALTERNATIVE (Push schema directly - USE WITH CAUTION):
#   DATABASE_URL="postgresql://..." npx prisma db push
#
# For data migration (schema + data):
#   1. Backup production first:
#      pg_dump -h <prod_host> -U <prod_user> -d <prod_db> > prod_backup_$(date +%Y%m%d).sql
#
#   2. Apply schema migrations:
#      DATABASE_URL="postgresql://..." npx prisma migrate deploy
#
# SQLite operations below have been commented out and are no longer functional.

set -e

echo "⚠️  This script is deprecated - IxStats now uses PostgreSQL"
echo ""
echo "📖 PostgreSQL Schema Sync Instructions:"
echo ""
echo "RECOMMENDED: Use Prisma migrations for production schema updates"
echo ""
echo "1. Create/apply migrations in development:"
echo "   npx prisma migrate dev"
echo ""
echo "2. Deploy migrations to production:"
echo "   DATABASE_URL=\"postgresql://...\" npx prisma migrate deploy"
echo ""
echo "ALTERNATIVE (direct schema push - use with caution):"
echo "   DATABASE_URL=\"postgresql://...\" npx prisma db push"
echo ""
echo "For more details, see the comments in this script."
echo ""
exit 1

# ============================================================================
# DEPRECATED SQLite OPERATIONS (NO LONGER FUNCTIONAL)
# ============================================================================

# # Get the project root directory
# PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# cd "$PROJECT_ROOT"

# # Check if production database file exists
# PROD_DB_PATH="./prisma/prod.db"
# DEV_DB_PATH="./prisma/dev.db"

# if [ ! -f "$DEV_DB_PATH" ]; then
#     echo "❌ Error: Development database not found at $DEV_DB_PATH"
#     echo "   Please run 'npm run db:setup' to initialize the development database first."
#     exit 1
# fi

# # Backup production database if it exists
# if [ -f "$PROD_DB_PATH" ]; then
#     BACKUP_PATH="./prisma/backups/prod.db.backup.$(date +%Y%m%d_%H%M%S)"
#     mkdir -p ./prisma/backups
#     echo "📦 Backing up production database to: $BACKUP_PATH"
#     cp "$PROD_DB_PATH" "$BACKUP_PATH"
#     echo "✅ Backup created"
# fi

# # Ensure migrations directory exists
# if [ ! -d "./prisma/migrations" ]; then
#     echo "⚠️  Warning: No migrations directory found."
#     echo "   Creating initial migration from current schema..."
# fi

# echo "🗄️  Generating Prisma client..."
# npm run db:generate

# echo "🔄 Pushing schema to production database..."
# DATABASE_URL="file:./prisma/prod.db" npx prisma db push --skip-generate

# if [ $? -eq 0 ]; then
#     echo "✅ Production database schema synced successfully!"
#     echo ""
#     echo "📊 Database Status:"
#     echo "   Dev DB:  $DEV_DB_PATH"
#     echo "   Prod DB: $PROD_DB_PATH"
#     echo "   Both databases are now in sync with the Prisma schema"
# else
#     echo "❌ Failed to sync production database"
#     if [ -f "$BACKUP_PATH" ]; then
#         echo "   Backup available at: $BACKUP_PATH"
#     fi
#     exit 1
# fi

# # Optional: Show table count
# echo ""
# echo "🔍 Verifying sync..."
# echo "   All tables should now match between dev and prod databases"
# echo ""
# echo "✨ Sync complete!"

