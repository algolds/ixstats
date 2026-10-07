-- PostGIS geometry sync triggers for the map tables (docs/systems/maps.md, "Runtime Requirements").
-- The app writes GeoJSON to `geometry` / `coordinates` and reads `geom_postgis` in its spatial SQL; these triggers
-- keep the two in step. They lived only in the archived scripts/archive/migrations/migrations/setup-map-triggers.ts,
-- so a database created with `db push` (which knows nothing of triggers) had none and every spatial query found
-- nothing. Same functions and triggers as that script. Idempotent: safe to re-run, and a no-op on a database that
-- already has them apart from the backfill of rows still missing `geom_postgis`.
--
-- Apply after `db push` (scripts/setup/bootstrap-dev-db.ts does on a fresh dev database):
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261007_map_geometry_sync_triggers.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- GeoJSON `geometry` → `geom_postgis` (map_layers, subdivisions). An invalid geometry stores NULL with a warning
-- instead of failing the write.
CREATE OR REPLACE FUNCTION sync_map_layer_geom()
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

-- `coordinates` ([lng, lat]) → point `geom_postgis` (cities, points_of_interest).
CREATE OR REPLACE FUNCTION sync_coordinate_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.coordinates IS NOT NULL AND NEW.coordinates->>0 IS NOT NULL AND NEW.coordinates->>1 IS NOT NULL THEN
    BEGIN
      NEW.geom_postgis = ST_SetSRID(
        ST_MakePoint((NEW.coordinates->>0)::double precision, (NEW.coordinates->>1)::double precision),
        4326
      );
    EXCEPTION WHEN OTHERS THEN
      NEW.geom_postgis = NULL;
      RAISE WARNING 'Invalid coordinates for %: %', NEW.id, SQLERRM;
    END;
  ELSE
    NEW.geom_postgis = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS map_layer_geom_sync ON map_layers;
CREATE TRIGGER map_layer_geom_sync
  BEFORE INSERT OR UPDATE OF geometry ON map_layers
  FOR EACH ROW EXECUTE FUNCTION sync_map_layer_geom();

DROP TRIGGER IF EXISTS subdivision_geom_sync ON subdivisions;
CREATE TRIGGER subdivision_geom_sync
  BEFORE INSERT OR UPDATE OF geometry ON subdivisions
  FOR EACH ROW EXECUTE FUNCTION sync_map_layer_geom();

DROP TRIGGER IF EXISTS city_geom_sync ON cities;
CREATE TRIGGER city_geom_sync
  BEFORE INSERT OR UPDATE OF coordinates ON cities
  FOR EACH ROW EXECUTE FUNCTION sync_coordinate_geom();

DROP TRIGGER IF EXISTS poi_geom_sync ON points_of_interest;
CREATE TRIGGER poi_geom_sync
  BEFORE INSERT OR UPDATE OF coordinates ON points_of_interest
  FOR EACH ROW EXECUTE FUNCTION sync_coordinate_geom();

-- Backfill rows written before the triggers existed. Re-assigning the source column fires the trigger, which
-- skips an invalid geometry with a warning instead of failing the whole UPDATE.
UPDATE map_layers SET geometry = geometry WHERE geometry IS NOT NULL AND geom_postgis IS NULL;
UPDATE subdivisions SET geometry = geometry WHERE geometry IS NOT NULL AND geom_postgis IS NULL;
UPDATE cities SET coordinates = coordinates WHERE coordinates IS NOT NULL AND geom_postgis IS NULL;
UPDATE points_of_interest SET coordinates = coordinates
  WHERE coordinates IS NOT NULL AND geom_postgis IS NULL;
