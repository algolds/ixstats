-- Add PostGIS geometry columns (not managed by Prisma)
ALTER TABLE "Country"
  ADD COLUMN IF NOT EXISTS geom_postgis geometry(MultiPolygon, 4326);

ALTER TABLE "territories"
  ADD COLUMN IF NOT EXISTS geom_postgis geometry(Polygon, 4326);

-- Create spatial indexes for fast intersection queries
CREATE INDEX IF NOT EXISTS idx_country_geom ON "Country" USING GIST(geom_postgis);
CREATE INDEX IF NOT EXISTS idx_territory_geom ON "territories" USING GIST(geom_postgis);

-- Auto-sync trigger: JSON geometry field → PostGIS column
CREATE OR REPLACE FUNCTION sync_country_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geometry IS NOT NULL THEN
    NEW.geom_postgis = ST_GeomFromGeoJSON(NEW.geometry::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for Country table
DROP TRIGGER IF EXISTS country_geom_sync ON "Country";
CREATE TRIGGER country_geom_sync
  BEFORE INSERT OR UPDATE OF geometry ON "Country"
  FOR EACH ROW EXECUTE FUNCTION sync_country_geom();

-- Triggers for Territory table
DROP TRIGGER IF EXISTS territory_geom_sync ON "territories";
CREATE TRIGGER territory_geom_sync
  BEFORE INSERT OR UPDATE OF geometry ON "territories"
  FOR EACH ROW EXECUTE FUNCTION sync_country_geom();
