-- Map Layer Spatial Index Migration
-- Creates the GiST spatial index on map_layers.geom_postgis.
--
-- WHY: The Prisma schema declares `@@index([geom_postgis], type: Gist)` on the
-- MapLayer model, but Prisma does NOT reliably create GiST indexes on
-- `Unsupported("geometry")` columns via `db push` — which is why every other
-- spatial table (subdivisions, cities, points_of_interest, Country, territories)
-- gets its GiST index from an explicit raw-SQL migration like this one. map_layers
-- was missing that explicit migration, so the index never existed in the DB.
--
-- IMPACT: geoCore.getPointInfo runs
--   ST_Contains(geom_postgis, point) over the 'altitudes' | 'climate' | 'political'
-- layers. With no usable spatial index this is a sequential scan + point-in-polygon
-- against world-scale multipolygons, taking ~20-40s per call. Those slow calls
-- saturate the browser connection pool during map editing, so the
-- countryGeo.upsertSubdivision POST queues until its short-lived Clerk JWT expires
-- and the save is rejected UNAUTHORIZED — i.e. "province geometry won't save".
--
-- Run with: psql -h localhost -p 5433 -U postgres -d ixstats -f add-map-layer-geom-index.sql
--
-- On the live production DB prefer the CONCURRENTLY form (see note at bottom) so the
-- build does not take a write lock on a table that is in active use.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Standard (locking) build — fine for dev / maintenance windows.
CREATE INDEX IF NOT EXISTS "idx_map_layer_geom" ON "map_layers" USING GIST ("geom_postgis");

ANALYZE "map_layers";

-- ── Production note ───────────────────────────────────────────────────────────
-- To build without locking writes on the live table, run this instead of the
-- CREATE INDEX above (CONCURRENTLY cannot run inside a transaction block, so run it
-- as its own statement, not via -f inside an implicit transaction):
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_map_layer_geom"
--     ON "map_layers" USING GIST ("geom_postgis");
--   ANALYZE "map_layers";
--
-- Verify afterwards:
--   \d+ map_layers            -- should list idx_map_layer_geom
--   EXPLAIN ANALYZE SELECT 1 FROM map_layers
--     WHERE geom_postgis IS NOT NULL
--       AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint(23.6, -29.1), 4326));
--   -- expect an "Index Scan using idx_map_layer_geom", not a "Seq Scan".
