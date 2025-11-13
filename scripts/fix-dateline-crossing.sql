/**
 * Fix Dateline-Crossing Polygons
 *
 * This script splits polygons that incorrectly span more than 180 degrees
 * of longitude (crossing the antimeridian/dateline) into separate polygons.
 *
 * The issue: Countries like Daxia, Metzetta, and Oyashima cross the dateline
 * and their geometries incorrectly span nearly 360 degrees, causing horizontal
 * banding artifacts in map rendering.
 *
 * Solution: Split these polygons at 180°/-180° longitude into separate parts.
 *
 * Usage:
 * PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats -f scripts/fix-dateline-crossing.sql
 */

\echo '========================================================================'
\echo 'Fixing Dateline-Crossing Polygons'
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
\echo 'Step 2: Creating temporary table for split geometries...'
\echo ''

-- Create temporary table to store the split results
DROP TABLE IF EXISTS map_layer_political_split;
CREATE TABLE map_layer_political_split AS
SELECT * FROM map_layer_political WHERE false;

\echo 'Step 3: Processing dateline-crossing polygons...'
\echo ''

-- Process each dateline-crossing polygon
DO $$
DECLARE
    rec RECORD;
    split_geom geometry;
    west_part geometry;
    east_part geometry;
    new_ogc_fid bigint;
BEGIN
    -- Get the next available ogc_fid
    SELECT COALESCE(MAX(ogc_fid), 0) + 1 INTO new_ogc_fid FROM map_layer_political;

    -- Process each polygon that spans more than 180 degrees
    FOR rec IN
        SELECT *
        FROM map_layer_political
        WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180
    LOOP
        RAISE NOTICE 'Processing: % (ogc_fid: %)', rec.id, rec.ogc_fid;

        BEGIN
            -- Method 1: Split at 180° using ST_Split with a vertical line
            -- Create a splitting line at 180° longitude (with correct SRID)
            split_geom := ST_Split(
                rec.geometry,
                ST_SetSRID(ST_MakeLine(
                    ST_MakePoint(180, -90),
                    ST_MakePoint(180, 90)
                ), 4326)
            );

            -- If split was successful, we'll have a GeometryCollection
            IF ST_GeometryType(split_geom) = 'ST_GeometryCollection' THEN
                -- Extract the individual parts
                FOR i IN 1..ST_NumGeometries(split_geom) LOOP
                    INSERT INTO map_layer_political_split (
                        ogc_fid, id, ixmap_subgroup, fill, geometry
                    ) VALUES (
                        new_ogc_fid,
                        rec.id,
                        rec.ixmap_subgroup,
                        rec.fill,
                        ST_GeometryN(split_geom, i)
                    );
                    new_ogc_fid := new_ogc_fid + 1;
                END LOOP;
            ELSE
                -- If split didn't work, try Method 2: Manual splitting using bounding box approach
                RAISE NOTICE 'ST_Split failed for %, trying alternative method...', rec.id;

                -- Split into western part (longitude < 0) and eastern part (longitude > 0)
                -- This is a simplified approach that works for most dateline-crossing polygons

                -- Western part: clip to longitude < 0
                west_part := ST_Intersection(
                    rec.geometry,
                    ST_MakeEnvelope(-180, -90, 0, 90, 4326)
                );

                -- Eastern part: clip to longitude > 0
                east_part := ST_Intersection(
                    rec.geometry,
                    ST_MakeEnvelope(0, -90, 180, 90, 4326)
                );

                -- Add western part if not empty
                IF NOT ST_IsEmpty(west_part) THEN
                    INSERT INTO map_layer_political_split (
                        ogc_fid, id, ixmap_subgroup, fill, geometry
                    ) VALUES (
                        new_ogc_fid,
                        rec.id,
                        rec.ixmap_subgroup,
                        rec.fill,
                        west_part
                    );
                    new_ogc_fid := new_ogc_fid + 1;
                END IF;

                -- Add eastern part if not empty
                IF NOT ST_IsEmpty(east_part) THEN
                    INSERT INTO map_layer_political_split (
                        ogc_fid, id, ixmap_subgroup, fill, geometry
                    ) VALUES (
                        new_ogc_fid,
                        rec.id,
                        rec.ixmap_subgroup,
                        rec.fill,
                        east_part
                    );
                    new_ogc_fid := new_ogc_fid + 1;
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing %: %', rec.id, SQLERRM;
            -- If all methods fail, keep the original (though it will cause rendering issues)
            INSERT INTO map_layer_political_split
            SELECT * FROM map_layer_political WHERE ogc_fid = rec.ogc_fid;
        END;
    END LOOP;

    -- Add all non-problematic polygons as-is
    INSERT INTO map_layer_political_split
    SELECT * FROM map_layer_political
    WHERE (ST_XMax(geometry) - ST_XMin(geometry)) <= 180;

END$$;

\echo ''
\echo 'Step 4: Validating split geometries...'
\echo ''

-- Make sure all geometries are valid
UPDATE map_layer_political_split
SET geometry = ST_MakeValid(geometry)
WHERE NOT ST_IsValid(geometry);

-- Check results
SELECT
    'Original polygons' as type,
    COUNT(*) as count,
    COUNT(CASE WHEN (ST_XMax(geometry) - ST_XMin(geometry)) > 180 THEN 1 END) as crossing_dateline
FROM map_layer_political
UNION ALL
SELECT
    'Split polygons' as type,
    COUNT(*) as count,
    COUNT(CASE WHEN (ST_XMax(geometry) - ST_XMin(geometry)) > 180 THEN 1 END) as crossing_dateline
FROM map_layer_political_split;

\echo ''
\echo 'Step 5: Replacing original table with split version...'
\echo ''

-- Replace the original table with the split version
BEGIN;
    DROP TABLE map_layer_political;
    ALTER TABLE map_layer_political_split RENAME TO map_layer_political;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS map_layer_political_geometry_idx
    ON map_layer_political USING GIST (geometry);
COMMIT;

\echo ''
\echo 'Step 6: Final verification...'
\echo ''

-- Show that no polygons now span more than 180 degrees
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Success! No polygons span more than 180 degrees.'
        ELSE 'Warning: ' || COUNT(*) || ' polygons still span more than 180 degrees.'
    END as result
FROM map_layer_political
WHERE (ST_XMax(geometry) - ST_XMin(geometry)) > 180;

-- Show the split results for the previously problematic polygons
\echo ''
\echo 'Split results for previously problematic countries:'
SELECT
    id,
    COUNT(*) as num_parts,
    MIN(ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1)) as min_span,
    MAX(ROUND((ST_XMax(geometry) - ST_XMin(geometry))::numeric, 1)) as max_span
FROM map_layer_political
WHERE id IN ('Daxia', 'Metzetta', 'Oyashima', 'path190-4')
GROUP BY id
ORDER BY id;

\echo ''
\echo '========================================================================'
\echo 'Dateline crossing fix complete!'
\echo '========================================================================'
\echo ''
\echo 'The horizontal banding issue should now be resolved.'
\echo 'Next steps:'
\echo '1. Clear Redis cache: redis-cli FLUSHDB'
\echo '2. Restart Martin: docker restart martin-tiles'
\echo '3. Test the map rendering'
\echo ''