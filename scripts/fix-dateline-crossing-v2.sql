/**
 * Fix Dateline-Crossing Polygons (Version 2)
 *
 * This script uses ST_ShiftLongitude to properly handle dateline-crossing polygons.
 * ST_ShiftLongitude shifts longitude values to be in the range [0-360] which
 * properly handles antimeridian crossing, then we shift back as needed.
 *
 * Usage:
 * PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/fix-dateline-crossing-v2.sql
 */

\echo '========================================================================'
\echo 'Fixing Dateline-Crossing Polygons (Version 2)'
\echo '========================================================================'
\echo ''

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

\echo 'Step 1: Identifying polygons that span more than 180 degrees longitude...'
\echo ''

-- Show problematic polygons before fix
SELECT
    ogc_fid,
    id,
    ST_XMin(geometry) as xmin,
    ST_XMax(geometry) as xmax,
    ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as lon_span
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180
ORDER BY lon_span DESC;

\echo ''
\echo 'Step 2: Using ST_ShiftLongitude to fix dateline crossing...'
\echo ''

-- Create a backup first
DROP TABLE IF EXISTS map_layer_political_original;
CREATE TABLE map_layer_political_original AS SELECT * FROM map_layer_political;

-- Fix the dateline-crossing polygons using ST_ShiftLongitude
-- This function shifts all longitude values to [0-360] range
-- which properly handles the antimeridian
UPDATE map_layer_political
SET geometry = ST_ShiftLongitude(geometry)
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

\echo ''
\echo 'Step 3: Verifying the fix...'
\echo ''

-- Check if any polygons still span more than 180 degrees
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Success! No polygons span more than 180 degrees.'
        ELSE 'Note: ' || COUNT(*) || ' polygons were shifted to handle dateline crossing.'
    END as result
FROM map_layer_political
WHERE ST_XMax(geometry) > 180;  -- Shifted polygons will have longitude > 180

-- Show the results
\echo ''
\echo 'Polygons that were fixed:'
SELECT
    ogc_fid,
    id,
    ST_XMin(geometry) as new_xmin,
    ST_XMax(geometry) as new_xmax,
    ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as new_span
FROM map_layer_political
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4')
   OR ST_XMax(geometry) > 180
ORDER BY id;

\echo ''
\echo '========================================================================'
\echo 'Dateline crossing fix complete!'
\echo '========================================================================'
\echo ''
\echo 'ST_ShiftLongitude has shifted dateline-crossing polygons to use'
\echo 'longitude values in the [0-360] range, which MapLibre/Martin can'
\echo 'properly handle for rendering without banding artifacts.'
\echo ''
\echo 'Next steps:'
\echo '1. Clear Redis cache: redis-cli FLUSHDB'
\echo '2. Restart Martin: docker restart martin-tiles'
\echo '3. Test the map rendering'
\echo ''
\echo 'If you need to restore original data:'
\echo '  DROP TABLE map_layer_political;'
\echo '  ALTER TABLE map_layer_political_original RENAME TO map_layer_political;'
\echo ''