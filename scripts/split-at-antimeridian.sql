/**
 * Split dateline-crossing polygons at the antimeridian using ST_Split
 *
 * This creates a cutting line at 180°/-180° and splits polygons that cross it
 *
 * Usage:
 * PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/split-at-antimeridian.sql
 */

\echo '========================================'
\echo 'Splitting Polygons at Antimeridian'
\echo '========================================'
\echo ''

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create a meridian line for splitting
-- This line runs from south pole to north pole at 180° longitude
DROP TABLE IF EXISTS meridian_line;
CREATE TEMPORARY TABLE meridian_line AS
SELECT ST_MakeLine(
    ST_MakePoint(180, -90),
    ST_MakePoint(180, 90)
) as line;

\echo 'Creating new table with split geometries...'
\echo ''

-- Create new table for split results
DROP TABLE IF EXISTS map_layer_political_split;
CREATE TABLE map_layer_political_split AS
WITH split_geoms AS (
    SELECT
        p.ogc_fid,
        p.id,
        p.ixmap_subgroup,
        p.fill,
        CASE
            -- If polygon spans more than 180 degrees, try to split it
            WHEN (ST_XMax(p.geometry) - ST_XMin(p.geometry)) > 180 THEN
                ST_Split(p.geometry, m.line)
            ELSE
                p.geometry
        END as geometry
    FROM map_layer_political p
    CROSS JOIN meridian_line m
)
SELECT
    ogc_fid,
    id,
    ixmap_subgroup,
    fill,
    geometry
FROM split_geoms;

-- Check if splitting worked
SELECT
    'After Split' as status,
    id,
    ST_GeometryType(geometry) as geom_type,
    ST_NumGeometries(geometry) as num_geoms
FROM map_layer_political_split
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4')
ORDER BY id;

\echo ''
\echo 'Alternative: Using ST_Shift_Longitude to normalize coordinates...'
\echo ''

-- Let's try ST_Shift_Longitude which normalizes to 0-360 then back to -180-180
DROP TABLE IF EXISTS map_layer_political_shifted;
CREATE TABLE map_layer_political_shifted AS
SELECT
    ogc_fid,
    id,
    ixmap_subgroup,
    fill,
    CASE
        WHEN (ST_XMax(geometry) - ST_XMin(geometry)) > 180 THEN
            -- For dateline crossers, shift then split
            ST_MakeValid(
                ST_Multi(
                    ST_Intersection(
                        geometry,
                        ST_MakeEnvelope(-180, -90, 180, 90, 4326)
                    )
                )
            )
        ELSE
            geometry
    END as geometry
FROM map_layer_political;

-- Check results
SELECT
    'After Intersection' as status,
    id,
    ROUND(ST_XMin(geometry)::numeric, 1) as min_lon,
    ROUND(ST_XMax(geometry)::numeric, 1) as max_lon,
    ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1) as lon_span
FROM map_layer_political_shifted
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4')
ORDER BY id;

\echo ''
\echo 'Replacing original table with fixed version...'
\echo ''

-- Replace the original table
DROP TABLE IF EXISTS map_layer_political_old;
ALTER TABLE map_layer_political RENAME TO map_layer_political_old;
ALTER TABLE map_layer_political_shifted RENAME TO map_layer_political;

-- Recreate spatial index
CREATE INDEX map_layer_political_geometry_idx ON map_layer_political USING GIST (geometry);

-- Final verification
\echo ''
\echo 'Final verification:'
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Success! No polygons span more than 180 degrees.'
        ELSE 'Warning: ' || COUNT(*) || ' polygons still span more than 180 degrees.'
    END as result
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All coordinates are within -180 to 180 range.'
        ELSE 'Warning: ' || COUNT(*) || ' geometries have coordinates outside valid range.'
    END as result
FROM map_layer_political
WHERE ST_XMax(geometry) > 180 OR ST_XMin(geometry) < -180;

\echo ''
\echo '========================================'
\echo 'Antimeridian Split Complete!'
\echo '========================================'
\echo ''