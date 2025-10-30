-- PostGIS Vector Tile Optimization Indexes
-- Run this to dramatically improve tile generation performance
-- Execute: psql $DATABASE_URL -f scripts/create-vector-tile-indexes.sql

-- =============================================================================
-- SPATIAL INDEXES FOR VECTOR TILE GENERATION
-- =============================================================================
-- These GIST indexes enable PostGIS to quickly find features that intersect
-- with the tile bounding box, reducing tile generation time from ~500ms to ~50ms

-- Political boundaries (temp_political_import)
CREATE INDEX IF NOT EXISTS idx_political_geom_gist
ON temp_political_import USING GIST (wkb_geometry);

-- Background layer
CREATE INDEX IF NOT EXISTS idx_background_geom_gist
ON map_layer_background USING GIST (wkb_geometry);

-- Icecaps layer
CREATE INDEX IF NOT EXISTS idx_icecaps_geom_gist
ON map_layer_icecaps USING GIST (wkb_geometry);

-- Altitudes layer (4,068 features - most critical for performance)
CREATE INDEX IF NOT EXISTS idx_altitudes_geom_gist
ON map_layer_altitudes USING GIST (wkb_geometry);

-- Climate layer (632 features)
CREATE INDEX IF NOT EXISTS idx_climate_geom_gist
ON map_layer_climate USING GIST (wkb_geometry);

-- Lakes layer (350 features)
CREATE INDEX IF NOT EXISTS idx_lakes_geom_gist
ON map_layer_lakes USING GIST (wkb_geometry);

-- Rivers layer (1,041 features)
CREATE INDEX IF NOT EXISTS idx_rivers_geom_gist
ON map_layer_rivers USING GIST (wkb_geometry);

-- =============================================================================
-- VACUUM ANALYZE FOR QUERY PLANNER OPTIMIZATION
-- =============================================================================
-- Update statistics so PostgreSQL's query planner can make optimal decisions

VACUUM ANALYZE temp_political_import;
VACUUM ANALYZE map_layer_background;
VACUUM ANALYZE map_layer_icecaps;
VACUUM ANALYZE map_layer_altitudes;
VACUUM ANALYZE map_layer_climate;
VACUUM ANALYZE map_layer_lakes;
VACUUM ANALYZE map_layer_rivers;

-- =============================================================================
-- VERIFY INDEXES
-- =============================================================================
-- Check that indexes were created successfully

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'temp_political_import',
  'map_layer_background',
  'map_layer_icecaps',
  'map_layer_altitudes',
  'map_layer_climate',
  'map_layer_lakes',
  'map_layer_rivers'
)
AND indexname LIKE '%_geom_gist'
ORDER BY tablename, indexname;

-- =============================================================================
-- PERFORMANCE TESTING QUERY
-- =============================================================================
-- Test tile generation performance for a sample tile
-- Should complete in <100ms with indexes, >500ms without

\timing on

-- Example: Generate a vector tile for political boundaries at zoom 4, tile (8, 5)
-- This query mimics what the API endpoint does
WITH tile_bounds AS (
  SELECT ST_MakeEnvelope(-5009377.085697312, -2504688.542848654, -2504688.542848656, 0, 3857) AS geom
),
tile_features AS (
  SELECT
    ogc_fid,
    COALESCE(id, 'unknown') as name,
    fill,
    ST_AsMVTGeom(
      wkb_geometry,
      (SELECT geom FROM tile_bounds),
      256,
      0,
      true
    ) as geom
  FROM temp_political_import
  WHERE wkb_geometry IS NOT NULL
    AND ST_Intersects(wkb_geometry, (SELECT geom FROM tile_bounds))
)
SELECT pg_column_size(ST_AsMVT(tile_features.*, 'political', 256, 'geom')) as tile_size_bytes
FROM tile_features
WHERE geom IS NOT NULL;

\timing off

-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================
-- Without indexes: 500-2000ms per tile
-- With indexes: 50-200ms per tile
-- ~10x performance improvement
--
-- This is critical for user experience:
-- - Without indexes: 10+ seconds to load all visible tiles
-- - With indexes: 1-2 seconds to load all visible tiles
