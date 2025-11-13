#!/bin/bash
# Apply the cards missing columns migration
# Usage: ./scripts/apply-cards-migration.sh

echo "Applying cards missing columns migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it in your .env file or export it"
  exit 1
fi

# Apply the migration
psql "$DATABASE_URL" -f prisma/migrations/add-cards-missing-columns.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully!"
  
  # Verify the columns exist
  echo ""
  echo "Verifying columns..."
  psql "$DATABASE_URL" -c "\d cards" | grep -E "(name|metadata)"
  
  echo ""
  echo "Migration complete. You can now import NS cards."
else
  echo "❌ Migration failed. Please check the error above."
  exit 1
fi



