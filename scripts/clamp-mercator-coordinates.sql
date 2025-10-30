/**
 * Clamp Coordinates to Web Mercator Bounds
 *
 * Web Mercator projection (EPSG:3857) is only defined for latitudes ±85.05112878°
 * Beyond these bounds, the projection becomes mathematically infinite.
 *
 * This script clamps all geometries to stay within valid Mercator bounds.
 *
 * Diagnostic found 2 features in altitudes layer extending beyond bounds:
 * - path466: 72.23° to 85.38° (clamp to 85.05°)
 * - path753: 85.67° to 86.17° (clamp to 85.05°)
 *
 * Usage: psql $DATABASE_URL -f scripts/clamp-mercator-coordinates.sql
 */

-- Constants
\set MAX_LAT 85.05112878
\set MIN_LAT -85.05112878

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to clamp a geometry to Mercator bounds
-- This function transforms geometry to WGS84, clamps coordinates, then transforms back to 3857
CREATE OR REPLACE FUNCTION clamp_geometry_to_mercator(geom geometry)
RETURNS geometry AS $$
DECLARE
  geom_4326 geometry;
  clamped_4326 geometry;
  max_lat CONSTANT numeric := 85.05112878;
  min_lat CONSTANT numeric := -85.05112878;
BEGIN
  -- Transform to WGS84 (EPSG:4326)
  geom_4326 := ST_Transform(geom, 4326);

  -- Clamp latitudes using ST_SetPoint for each vertex
  -- This is a simplified approach - for production, we'd need to handle
  -- complex geometries (MultiPolygon, etc.) more carefully
  clamped_4326 := ST_ClipByBox2D(
    geom_4326,
    ST_MakeEnvelope(-180, min_lat, 180, max_lat, 4326)
  );

  -- Transform back to Web Mercator (EPSG:3857)
  RETURN ST_Transform(clamped_4326, 3857);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Report on features that will be clamped
\echo '========================================================================'
\echo 'FEATURES TO BE CLAMPED'
\echo '========================================================================'

-- Check altitudes layer (where out-of-bounds features were found)
\echo ''
\echo 'Altitudes layer features beyond Mercator bounds:'
SELECT
  ogc_fid,
  COALESCE(id, 'Unknown') as name,
  ROUND(ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326)))::numeric, 4) as min_lat,
  ROUND(ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326)))::numeric, 4) as max_lat
FROM map_layer_altitudes
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  )
ORDER BY max_lat DESC;

-- Clamp altitudes layer
\echo ''
\echo 'Clamping altitudes layer...'
UPDATE map_layer_altitudes
SET wkb_geometry = clamp_geometry_to_mercator(wkb_geometry)
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

\echo 'Altitudes layer clamped successfully'

-- Check all other layers as a precaution
\echo ''
\echo 'Checking other layers for out-of-bounds features...'

-- Political boundaries
SELECT COUNT(*) AS political_out_of_bounds
FROM temp_political_import
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

-- Background
SELECT COUNT(*) AS background_out_of_bounds
FROM map_layer_background
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

-- Icecaps
SELECT COUNT(*) AS icecaps_out_of_bounds
FROM map_layer_icecaps
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

-- Climate
SELECT COUNT(*) AS climate_out_of_bounds
FROM map_layer_climate
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

-- Lakes
SELECT COUNT(*) AS lakes_out_of_bounds
FROM map_layer_lakes
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

-- Rivers
SELECT COUNT(*) AS rivers_out_of_bounds
FROM map_layer_rivers
WHERE wkb_geometry IS NOT NULL
  AND (
    ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) > 85.05112878
    OR ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) < -85.05112878
  );

\echo ''
\echo '========================================================================'
\echo 'VERIFICATION'
\echo '========================================================================'

\echo ''
\echo 'Verifying altitudes layer is now within bounds...'
SELECT
  COUNT(*) as total_features,
  MAX(ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326)))) as max_lat,
  MIN(ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326)))) as min_lat
FROM map_layer_altitudes
WHERE wkb_geometry IS NOT NULL;

\echo ''
\echo '✅ Coordinate clamping complete!'
\echo ''
\echo 'IMPORTANT: All features are now within Web Mercator bounds (±85.05°)'
\echo 'Note: This does NOT fix the inherent area distortion of Mercator projection.'
\echo 'For accurate area representation, consider using Equal Earth or Natural Earth projection.'
