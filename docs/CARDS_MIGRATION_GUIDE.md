# Cards Database Migration Guide

## Issue
The NS card importer is failing with the error:
```
The column `cards.name` does not exist in the current database.
```

This happens because the Prisma schema has `name` and `metadata` fields that don't exist in the actual database yet.

## Solution
Apply the migration to add the missing columns.

## Steps to Apply Migration

### Method 1: Using the Migration Script (Recommended)

```bash
# Set your DATABASE_URL if not already set
export DATABASE_URL="postgresql://user:password@localhost:5433/ixstats"

# Run the migration script
./scripts/apply-cards-migration.sh
```

### Method 2: Direct SQL Execution

```bash
# Using psql directly
psql "$DATABASE_URL" -f prisma/migrations/add-cards-missing-columns.sql

# Or if you have connection details
psql -h localhost -p 5433 -U postgres -d ixstats -f prisma/migrations/add-cards-missing-columns.sql
```

### Method 3: Copy-Paste SQL

If you have database admin access (pgAdmin, DBeaver, etc.), run this SQL directly:

```sql
-- Add missing columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS cards_metadata_idx ON cards USING GIN (metadata);

-- Add helpful comments
COMMENT ON COLUMN cards.name IS 'Alternate card name field for NS imports';
COMMENT ON COLUMN cards.metadata IS 'Complete metadata from NS API and other sources (JSON)';
```

## Verification

After applying the migration, verify the columns exist:

```bash
psql "$DATABASE_URL" -c "\d cards"
```

You should see `name` and `metadata` in the column list.

## What These Columns Do

### `name` Column
- Type: TEXT (nullable)
- Purpose: Stores alternate card names
- Used by: NS imports (stores nation name as alternate to title)

### `metadata` Column
- Type: JSONB (nullable)
- Purpose: Stores complete raw data from NS API and other sources
- Contains: Full NS card data, import timestamps, source information
- Indexed with GIN for fast JSON queries

## After Migration

1. **Restart your dev server** to pick up the schema changes:
   ```bash
   # Stop the dev server (Ctrl+C)
   npm run dev
   ```

2. **Test the NS import** again - it should now work correctly

3. **Verify data storage** by importing a test nation and checking the database:
   ```bash
   psql "$DATABASE_URL" -c "SELECT id, title, name, metadata->'nsData'->>'region' as region FROM cards WHERE ns_card_id IS NOT NULL LIMIT 5;"
   ```

## Rollback (if needed)

If you need to remove these columns:

```sql
ALTER TABLE cards DROP COLUMN IF EXISTS name;
ALTER TABLE cards DROP COLUMN IF EXISTS metadata;
DROP INDEX IF EXISTS cards_metadata_idx;
```

## Related Documentation

- [NS API Field Mapping](./NS_API_FIELD_MAPPING.md) - Complete field mapping documentation
- [Cards System Documentation](./systems/cards.md) - Overall cards system guide
- [NS Integration Summary](../NS_INTEGRATION_SUMMARY.md) - NS integration overview

## Troubleshooting

### Migration fails with "permission denied"
- Ensure your database user has ALTER TABLE permissions
- Try running as a superuser or contact your DBA

### Column already exists error
- This is safe to ignore - the migration uses `IF NOT EXISTS`
- Verify columns exist with `\d cards` command

### Still getting "column does not exist" after migration
1. Verify columns were added: `psql "$DATABASE_URL" -c "\d cards"`
2. Restart your dev server completely
3. Clear Next.js build cache: `rm -rf .next`
4. Regenerate Prisma client: `npx prisma generate`

## Success Indicators

✅ Migration script completes without errors  
✅ `\d cards` shows `name` and `metadata` columns  
✅ Dev server restarts successfully  
✅ NS card import works without errors  
✅ Cards display in the UI with proper data  

## Next Steps After Migration

1. Test importing NS cards from different nations
2. Verify all card data displays correctly in the UI
3. Check that card images (flags) load properly
4. Confirm metadata is being stored in the JSON fields



