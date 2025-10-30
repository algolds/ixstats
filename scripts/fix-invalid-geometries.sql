/**
 * Fix Invalid Geometries in Map Layers
 *
 * Uses PostGIS ST_MakeValid() to fix:
 * - Self-intersecting polygons
 * - Invalid ring orientations
 * - Duplicate vertices
 * - Other topological issues
 *
 * ST_MakeValid() automatically repairs geometries to make them valid
 * according to OGC standards while preserving as much data as possible.
 *
 * Usage: PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/fix-invalid-geometries.sql
 */

\echo '========================================================================'
\echo 'Fixing Invalid Geometries in Map Layers'
\echo '========================================================================'
\echo ''

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

\echo 'Counting invalid geometries before fix...'
\echo ''

-- Count invalid geometries per layer
DO $$
DECLARE
  layer_name TEXT;
  invalid_count INTEGER;
BEGIN
  FOREACH layer_name IN ARRAY ARRAY['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM map_layer_%s WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry)',
      layer_name
    ) INTO invalid_count;

    IF invalid_count > 0 THEN
      RAISE NOTICE 'map_layer_%: % invalid geometries', layer_name, invalid_count;
    ELSE
      RAISE NOTICE 'map_layer_%: all geometries valid', layer_name;
    END IF;
  END LOOP;
END$$;

\echo ''
\echo '========================================================================'
\echo 'Applying ST_MakeValid() to fix invalid geometries...'
\echo '========================================================================'
\echo ''

-- Fix political boundaries
\echo 'Fixing map_layer_political...'
UPDATE map_layer_political
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_climate...'
UPDATE map_layer_climate
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_altitudes...'
UPDATE map_layer_altitudes
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_rivers...'
UPDATE map_layer_rivers
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_lakes...'
UPDATE map_layer_lakes
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_icecaps...'
UPDATE map_layer_icecaps
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo 'Fixing map_layer_background...'
UPDATE map_layer_background
SET geometry = ST_MakeValid(geometry)
WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);

\echo ''
\echo '========================================================================'
\echo 'Verification: Counting invalid geometries after fix...'
\echo '========================================================================'
\echo ''

-- Count invalid geometries after fix
DO $$
DECLARE
  layer_name TEXT;
  invalid_count INTEGER;
  total_count INTEGER;
BEGIN
  FOREACH layer_name IN ARRAY ARRAY['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM map_layer_%s', layer_name) INTO total_count;
    EXECUTE format(
      'SELECT COUNT(*) FROM map_layer_%s WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry)',
      layer_name
    ) INTO invalid_count;

    IF invalid_count > 0 THEN
      RAISE NOTICE 'map_layer_%: % invalid geometries remaining (out of %)', layer_name, invalid_count, total_count;
    ELSE
      RAISE NOTICE 'map_layer_%: ✓ All % geometries are now valid!', layer_name, total_count;
    END IF;
  END LOOP;
END$$;

\echo ''
\echo '========================================================================'
\echo 'Geometry fix complete!'
\echo '========================================================================'
\echo ''
\echo 'All geometries should now be valid and ready for vector tile generation.'
\echo ''
\echo 'Next steps:'
\echo '1. Verify with validation script: npx tsx scripts/validate-postgis-geometries.ts'
\echo '2. Test vector tiles: curl http://localhost:3000/api/tiles/political/2/1/1'
\echo ''
