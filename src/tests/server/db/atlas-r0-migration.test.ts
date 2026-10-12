/** @jest-environment node */
/**
 * Atlas Release 0 migration: hand-written and idempotent, so the controller can apply it (and re-apply it) to the
 * clone and dev databases and the owner to production.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261021120000_atlas_r0";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const mapsSchema = readFileSync("prisma/schema/maps.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

describe("atlas r0 migration", () => {
  it("sorts after the realm content terms migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const earlier = "20261020120000_realm_content_terms";
    expect(dirs.indexOf(earlier)).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(earlier));
  });

  it("adds the map version column only when it is missing", () => {
    expect(statements).toContain(
      'ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "mapVersion" INTEGER NOT NULL DEFAULT 0'
    );
    expect(mapsSchema.match(/model Realm \{([\s\S]*?)\n\}/)?.[1] ?? "").toMatch(
      /mapVersion\s+Int\s+@default\(0\)/
    );
  });

  it("replaces the sync function and re-creates the trigger on Country", () => {
    expect(statements).toContain("CREATE OR REPLACE FUNCTION sync_country_geom()");
    expect(statements).toContain('DROP TRIGGER IF EXISTS country_geom_sync ON "Country";');
    expect(statements).toMatch(
      /CREATE TRIGGER country_geom_sync BEFORE INSERT OR UPDATE OF geometry ON "Country" FOR EACH ROW EXECUTE FUNCTION sync_country_geom\(\)/
    );
  });

  it("keeps geom_postgis in step with geometry the way sync_map_layer_geom does", () => {
    expect(statements).toContain(
      "NEW.geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(NEW.geometry::text), 4326))"
    );
    expect(statements).toContain("EXCEPTION WHEN OTHERS THEN NEW.geom_postgis = NULL;");
  });

  it("backfills only the rows still missing geom_postgis", () => {
    const backfill = statements.match(/UPDATE "Country" SET [^;]*;/g) ?? [];
    expect(backfill).toHaveLength(1);
    expect(backfill[0]).toContain("geometry IS NOT NULL");
    expect(backfill[0]).toContain("geom_postgis IS NULL");
  });

  it("uses only idempotent statement forms", () => {
    expect(statements.match(/CREATE TRIGGER/g)).toHaveLength(1);
    expect(statements.match(/DROP TRIGGER IF EXISTS/g)).toHaveLength(1);
    expect(statements.match(/CREATE (?!OR REPLACE FUNCTION|TRIGGER)/g) ?? []).toEqual([]);
    expect(
      statements.match(/ALTER TABLE "[A-Za-z_]+" (?!ADD COLUMN IF NOT EXISTS)/g) ?? []
    ).toEqual([]);
    expect(statements).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|INSERT INTO|DELETE FROM/);
  });
});
