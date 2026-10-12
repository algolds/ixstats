-- Atlas Release 0 (docs/specs/2026-10-11-atlas-release-0-performance-design.md). Hand-written and idempotent: safe
-- to re-run, and a no-op on a database that already has it apart from the backfill of rows still missing
-- `geom_postgis`.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261021120000_atlas_r0/migration.sql

-- The realm's map version: incremented by invalidateRealmMap (src/server/shared/map-invalidation.ts) on every map
-- change. Versioned layer and tile URLs carry it, so a change is a new URL.
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "mapVersion" INTEGER NOT NULL DEFAULT 0;

-- `Country.geometry` (GeoJSON) -> `geom_postgis`, as sync_map_layer_geom does for map_layers (20261007_map_geometry_sync_triggers.sql).
-- An invalid geometry stores NULL with a warning instead of failing the write.
CREATE OR REPLACE FUNCTION sync_country_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geometry IS NOT NULL THEN
    BEGIN
      NEW.geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(NEW.geometry::text), 4326));
    EXCEPTION WHEN OTHERS THEN
      NEW.geom_postgis = NULL;
      RAISE WARNING 'Invalid geometry for %: %', NEW.id, SQLERRM;
    END;
  ELSE
    NEW.geom_postgis = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS country_geom_sync ON "Country";
CREATE TRIGGER country_geom_sync
  BEFORE INSERT OR UPDATE OF geometry ON "Country"
  FOR EACH ROW EXECUTE FUNCTION sync_country_geom();

-- Backfill countries written before the trigger existed. Re-assigning the source column fires the trigger, which
-- skips an invalid geometry with a warning instead of failing the whole UPDATE.
UPDATE "Country" SET geometry = geometry WHERE geometry IS NOT NULL AND geom_postgis IS NULL;
