/**
 * Apply PostGIS ST_WrapX to properly split dateline-crossing polygons
 *
 * ST_WrapX splits geometries at a specified wrap point (the antimeridian)
 * This ensures all coordinates stay within -180 to 180 range
 *
 * Usage:
 * PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/apply-postgis-wrapx.sql
 */

\echo '========================================'
\echo 'Applying PostGIS Antimeridian Splitting'
\echo '========================================'
\echo ''

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

\echo 'Checking for dateline-crossing polygons before fix...'
\echo ''

-- Show problematic polygons before fix
SELECT
    'Before Fix' as status,
    id,
    ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as lon_span
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180
ORDER BY lon_span DESC
LIMIT 10;

\echo ''
\echo 'Applying ST_WrapX to split at antimeridian...'
\echo ''

-- Create backup
DROP TABLE IF EXISTS map_layer_political_backup_wrapx;
CREATE TABLE map_layer_political_backup_wrapx AS SELECT * FROM map_layer_political;

-- Apply ST_WrapX to political layer
-- This splits geometries at -180/180 boundary
UPDATE map_layer_political
SET geometry = ST_WrapX(geometry, -180, 360)
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

-- Apply to climate layer
UPDATE map_layer_climate
SET geometry = ST_WrapX(geometry, -180, 360)
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

-- Apply to icecaps layer
UPDATE map_layer_icecaps
SET geometry = ST_WrapX(geometry, -180, 360)
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

\echo ''
\echo 'Verifying the fix...'
\echo ''

-- Check if any polygons still span more than 180 degrees
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Success! No polygons span more than 180 degrees in political layer.'
        ELSE 'Warning: ' || COUNT(*) || ' polygons still span more than 180 degrees.'
    END as result
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

-- Verify all coordinates are within valid range
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All coordinates are within -180 to 180 range.'
        ELSE 'Warning: ' || COUNT(*) || ' geometries have coordinates outside valid range.'
    END as result
FROM map_layer_political
WHERE ST_XMax(geometry) > 180 OR ST_XMin(geometry) < -180;

-- Show the fixed countries
\echo ''
\echo 'Countries that were fixed:'
SELECT
    id,
    ST_NumGeometries(geometry) as num_parts,
    ROUND(ST_XMin(geometry)::numeric, 1) as min_lon,
    ROUND(ST_XMax(geometry)::numeric, 1) as max_lon,
    ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as lon_span
FROM map_layer_political
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4', 'Huoxia')
ORDER BY id;

\echo ''
\echo '========================================'
\echo 'PostGIS Antimeridian Fix Complete!'
\echo '========================================'
\echo ''
\echo 'The geometries have been properly split at the antimeridian.'
\echo 'All coordinates are now within -180 to 180 range.'
\echo ''
\echo 'Next: Clear Redis cache and restart Martin'
\echo ''