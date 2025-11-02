-- Add buffered polygon geometries for rivers
-- This creates proper polygon fills for high-zoom rendering

-- Add a new geometry column for buffered polygons (handles both Polygon and MultiPolygon)
ALTER TABLE map_layer_rivers
ADD COLUMN IF NOT EXISTS geometry_buffered geometry(Geometry, 4326);

-- Create buffered polygons with adaptive width based on river importance
-- Using a base buffer of 0.005 degrees (~500m at equator)
-- Adjust buffer size if you have a 'width' or 'importance' column
UPDATE map_layer_rivers
SET geometry_buffered = ST_Buffer(
  geometry,
  0.005,  -- Base buffer in degrees
  'endcap=round join=round'  -- Round caps and joins for natural appearance
);

-- Create spatial index on buffered geometry for performance
CREATE INDEX IF NOT EXISTS idx_map_layer_rivers_buffered
ON map_layer_rivers USING GIST (geometry_buffered);

-- Create a materialized view for vector tiles with both geometries
DROP MATERIALIZED VIEW IF EXISTS map_layer_rivers_polygons CASCADE;
CREATE MATERIALIZED VIEW map_layer_rivers_polygons AS
SELECT
  ogc_fid,
  id,
  ixmap_subgroup,
  fill,
  country_id,
  geometry as geometry_line,
  geometry_buffered as geometry
FROM map_layer_rivers
WHERE geometry_buffered IS NOT NULL;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_rivers_polygons_geom
ON map_layer_rivers_polygons USING GIST (geometry);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_river_polygons()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW map_layer_rivers_polygons;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON MATERIALIZED VIEW map_layer_rivers_polygons IS
'Buffered polygon geometries for rivers, used for high-zoom fill rendering';
