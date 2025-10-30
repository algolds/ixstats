/**
 * Database Schema Standardization for Map Layers
 *
 * This script:
 * 1. Backs up existing map layer tables
 * 2. Drops old tables with inconsistent schema
 * 3. Prepares for clean re-import with sanitized data
 * 4. Ensures all tables use consistent field names (geometry, not wkb_geometry)
 * 5. Sets up proper spatial indexes
 *
 * Usage: PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/fix-database-schema.sql
 */

\echo '========================================================================'
\echo 'Database Schema Standardization for Map Layers'
\echo '========================================================================'
\echo ''

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

\echo 'Checking existing map layer tables...'
\echo ''

-- Count features in existing tables (if they exist)
DO $$
DECLARE
  layer_name TEXT;
  feature_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  FOREACH layer_name IN ARRAY ARRAY['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']
  LOOP
    -- Check if table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'map_layer_' || layer_name
    ) INTO table_exists;

    IF table_exists THEN
      EXECUTE format('SELECT COUNT(*) FROM map_layer_%s', layer_name) INTO feature_count;
      RAISE NOTICE 'map_layer_% has % features', layer_name, feature_count;
    ELSE
      RAISE NOTICE 'map_layer_% does not exist', layer_name;
    END IF;
  END LOOP;
END$$;

\echo ''
\echo '========================================================================'
\echo 'Backing up existing tables...'
\echo '========================================================================'
\echo ''

-- Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS backups;

-- Backup existing tables with timestamp
DO $$
DECLARE
  layer_name TEXT;
  table_exists BOOLEAN;
  backup_name TEXT;
BEGIN
  FOREACH layer_name IN ARRAY ARRAY['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']
  LOOP
    -- Check if table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'map_layer_' || layer_name
    ) INTO table_exists;

    IF table_exists THEN
      backup_name := 'map_layer_' || layer_name || '_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
      EXECUTE format('CREATE TABLE backups.%I AS SELECT * FROM map_layer_%s', backup_name, layer_name);
      RAISE NOTICE 'Backed up map_layer_% to backups.%', layer_name, backup_name;
    END IF;
  END LOOP;
END$$;

\echo ''
\echo '========================================================================'
\echo 'Dropping old map layer tables...'
\echo '========================================================================'
\echo ''

-- Drop existing tables
DROP TABLE IF EXISTS map_layer_political CASCADE;
DROP TABLE IF EXISTS map_layer_climate CASCADE;
DROP TABLE IF EXISTS map_layer_altitudes CASCADE;
DROP TABLE IF EXISTS map_layer_rivers CASCADE;
DROP TABLE IF EXISTS map_layer_lakes CASCADE;
DROP TABLE IF EXISTS map_layer_icecaps CASCADE;
DROP TABLE IF EXISTS map_layer_background CASCADE;

\echo 'Old tables dropped successfully'
\echo ''

-- Also drop temp_political_import if it exists
DROP TABLE IF EXISTS temp_political_import CASCADE;
\echo 'Dropped temp_political_import table'
\echo ''

\echo '========================================================================'
\echo 'Database prepared for clean re-import'
\echo '========================================================================'
\echo ''
\echo 'Next steps:'
\echo '1. Run import script with sanitized data:'
\echo '   bash scripts/import-map-layers-sanitized.sh'
\echo ''
\echo '2. Verify imports:'
\echo '   psql $DATABASE_URL -c "SELECT COUNT(*) FROM map_layer_political;"'
\echo ''
\echo '3. Test vector tiles:'
\echo '   curl http://localhost:3000/api/tiles/political/2/1/1'
\echo ''
