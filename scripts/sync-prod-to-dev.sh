#!/bin/bash

# Database Sync Script - Syncs production database to development
# This ensures dev database is always up-to-date with production data
#
# ⚠️  POSTGRESQL MIGRATION NOTICE ⚠️
# This script has been disabled as IxStats now uses PostgreSQL instead of SQLite.
#
# To sync production data to development with PostgreSQL, use:
#
#   1. Dump production database:
#      pg_dump -h <prod_host> -U <prod_user> -d <prod_db> > prod_dump.sql
#
#   2. Restore to development database:
#      psql -h localhost -U <dev_user> -d <dev_db> < prod_dump.sql
#
# For schema-only sync (recommended for development):
#   pg_dump -h <prod_host> -U <prod_user> -d <prod_db> --schema-only > schema.sql
#   psql -h localhost -U <dev_user> -d <dev_db> < schema.sql
#
# SQLite operations below have been commented out and are no longer functional.

set -e

echo "⚠️  This script is deprecated - IxStats now uses PostgreSQL"
echo ""
echo "📖 PostgreSQL Database Sync Instructions:"
echo ""
echo "1. Export production database:"
echo "   pg_dump -h <prod_host> -U <prod_user> -d <prod_db> > prod_dump.sql"
echo ""
echo "2. Import to development database:"
echo "   psql -h localhost -U <dev_user> -d <dev_db> < prod_dump.sql"
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

# # Check if production database exists
# PROD_DB_PATH="./prisma/prod.db"
# DEV_DB_PATH="./prisma/dev.db"

# if [ ! -f "$PROD_DB_PATH" ]; then
#     echo "❌ Error: Production database not found at $PROD_DB_PATH"
#     echo "   Please ensure the production database exists first."
#     exit 1
# fi

# # Backup current development database if it exists
# if [ -f "$DEV_DB_PATH" ]; then
#     BACKUP_PATH="./prisma/backups/dev.db.backup.$(date +%Y%m%d_%H%M%S)"
#     mkdir -p ./prisma/backups
#     echo "📦 Backing up current development database to: $BACKUP_PATH"
#     cp "$DEV_DB_PATH" "$BACKUP_PATH"
#     echo "✅ Development database backed up"
# fi

# # Copy production database to development
# echo "🔄 Copying production database to development..."
# cp "$PROD_DB_PATH" "$DEV_DB_PATH"

# if [ $? -eq 0 ]; then
#     echo "✅ Development database synced with production!"
#     echo ""
#     echo "📊 Database Status:"
#     echo "   Production DB: $PROD_DB_PATH"
#     echo "   Development DB: $DEV_DB_PATH"
#     echo "   Both databases are now in sync"
#
#     # Show database sizes
#     PROD_SIZE=$(du -h "$PROD_DB_PATH" | cut -f1)
#     DEV_SIZE=$(du -h "$DEV_DB_PATH" | cut -f1)
#     echo "   Production size: $PROD_SIZE"
#     echo "   Development size: $DEV_SIZE"
# else
#     echo "❌ Failed to sync development database"
#     if [ -f "$BACKUP_PATH" ]; then
#         echo "   Previous development database backup available at: $BACKUP_PATH"
#     fi
#     exit 1
# fi

# echo ""
# echo "✨ Sync complete! Development server will now use production data."
# echo "💡 Run 'npm run dev' to start the development server with production data."