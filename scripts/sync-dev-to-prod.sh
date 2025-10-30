#!/bin/bash

# Database Sync Script - Syncs development database to production
# This ensures production database is updated with development changes
#
# ⚠️  POSTGRESQL MIGRATION NOTICE ⚠️
# This script has been disabled as IxStats now uses PostgreSQL instead of SQLite.
#
# To sync development data to production with PostgreSQL:
#
#   ⚠️  WARNING: This operation will OVERWRITE production data! ⚠️
#   Always create a backup first!
#
#   1. Backup production database first:
#      pg_dump -h <prod_host> -U <prod_user> -d <prod_db> > prod_backup_$(date +%Y%m%d).sql
#
#   2. Dump development database:
#      pg_dump -h localhost -U <dev_user> -d <dev_db> > dev_dump.sql
#
#   3. Restore to production (CAUTION - OVERWRITES PRODUCTION):
#      psql -h <prod_host> -U <prod_user> -d <prod_db> < dev_dump.sql
#
# For schema-only migration (safer for production):
#   Use Prisma migrations: npx prisma migrate deploy
#
# SQLite operations below have been commented out and are no longer functional.

set -e

echo "⚠️  This script is deprecated - IxStats now uses PostgreSQL"
echo ""
echo "📖 PostgreSQL Database Sync Instructions:"
echo ""
echo "⚠️  WARNING: Syncing dev to prod will OVERWRITE production data!"
echo ""
echo "1. ALWAYS backup production first:"
echo "   pg_dump -h <prod_host> -U <prod_user> -d <prod_db> > prod_backup_\$(date +%Y%m%d).sql"
echo ""
echo "2. Export development database:"
echo "   pg_dump -h localhost -U <dev_user> -d <dev_db> > dev_dump.sql"
echo ""
echo "3. Import to production (CAUTION):"
echo "   psql -h <prod_host> -U <prod_user> -d <prod_db> < dev_dump.sql"
echo ""
echo "For schema migrations only, use: npx prisma migrate deploy"
echo ""
exit 1

# ============================================================================
# DEPRECATED SQLite OPERATIONS (NO LONGER FUNCTIONAL)
# ============================================================================

# # Get the project root directory
# PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# cd "$PROJECT_ROOT"

# # Check if development database exists
# DEV_DB_PATH="./prisma/dev.db"
# PROD_DB_PATH="./prisma/prod.db"

# if [ ! -f "$DEV_DB_PATH" ]; then
#     echo "❌ Error: Development database not found at $DEV_DB_PATH"
#     echo "   Please ensure the development database exists first."
#     exit 1
# fi

# # Backup current production database if it exists
# if [ -f "$PROD_DB_PATH" ]; then
#     BACKUP_PATH="./prisma/backups/prod.db.backup.$(date +%Y%m%d_%H%M%S)"
#     mkdir -p ./prisma/backups
#     echo "📦 Backing up current production database to: $BACKUP_PATH"
#     cp "$PROD_DB_PATH" "$BACKUP_PATH"
#     echo "✅ Production database backed up"
# fi

# # Copy development database to production
# echo "🔄 Copying development database to production..."
# cp "$DEV_DB_PATH" "$PROD_DB_PATH"

# if [ $? -eq 0 ]; then
#     echo "✅ Production database synced with development!"
#     echo ""
#     echo "📊 Database Status:"
#     echo "   Development DB: $DEV_DB_PATH"
#     echo "   Production DB: $PROD_DB_PATH"
#     echo "   Both databases are now in sync"
#
#     # Show database sizes
#     DEV_SIZE=$(du -h "$DEV_DB_PATH" | cut -f1)
#     PROD_SIZE=$(du -h "$PROD_DB_PATH" | cut -f1)
#     echo "   Development size: $DEV_SIZE"
#     echo "   Production size: $PROD_SIZE"
# else
#     echo "❌ Failed to sync production database"
#     if [ -f "$BACKUP_PATH" ]; then
#         echo "   Previous production database backup available at: $BACKUP_PATH"
#     fi
#     exit 1
# fi

# echo ""
# echo "✨ Sync complete! Production database now matches development data."
# echo "💡 Both databases are now synchronized."
