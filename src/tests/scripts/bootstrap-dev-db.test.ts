import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  ATLAS_R0_SQL,
  ATLAS_RA_SQL,
  ATLAS_STUDIO_SQL,
  bootstrapRefusal,
  DB_SETUP_SQL_FILES,
  MAP_GEOMETRY_TRIGGERS_SQL,
  VAULT_HUB_SQL,
} from "../../../scripts/setup/bootstrap-dev-db";

const local = "postgresql://postgres:postgres@localhost:5433/ixstats";

describe("db:bootstrap guards", () => {
  it("allows a local development database", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: local, allowRemote: false })
    ).toBeNull();
  });

  it("refuses production", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "production", databaseUrl: local, allowRemote: true })
    ).toMatch(/production/);
  });

  it("refuses a remote host unless explicitly allowed", () => {
    const remote = "postgresql://u:p@db.example.com:5432/ixstats";
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: false })
    ).toMatch(/not a local database/);
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: true })
    ).toBeNull();
  });

  it("refuses when DATABASE_URL is missing", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: undefined, allowRemote: false })
    ).toMatch(/DATABASE_URL/);
  });
});

describe("the SQL a fresh database needs besides db push", () => {
  it("runs the geometry triggers, then the Atlas R0 SQL (it backfills through them), then Atlas RA", () => {
    expect(DB_SETUP_SQL_FILES).toEqual([MAP_GEOMETRY_TRIGGERS_SQL, ATLAS_R0_SQL, ATLAS_RA_SQL]);
  });

  it("keeps the Atlas Studio SQL out of the after-push list: it runs before db push, which cannot drop a table", () => {
    expect(DB_SETUP_SQL_FILES).not.toContain(ATLAS_STUDIO_SQL);
    expect(ATLAS_STUDIO_SQL).toContain("20261023120000_atlas_studio");
  });

  it("runs the Atlas Studio SQL before the schema push", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    const studio = source.lastIndexOf('--file", ATLAS_STUDIO_SQL');
    const push = source.indexOf('"db", "push"');
    expect(studio).toBeGreaterThan(0);
    expect(push).toBeGreaterThan(studio);
  });

  it("runs the Vault hub SQL right after the Atlas Studio SQL, before the schema push", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    const studio = source.indexOf('--file", ATLAS_STUDIO_SQL');
    const vault = source.indexOf('--file", VAULT_HUB_SQL');
    const push = source.indexOf('"db", "push"');
    expect(VAULT_HUB_SQL).toContain("20261024120000_vault_hub");
    expect(studio).toBeGreaterThan(0);
    expect(vault).toBeGreaterThan(studio);
    expect(push).toBeGreaterThan(vault);
  });

  it("the Atlas Studio SQL is the idempotent one that creates the preset tables and drops the dead models", () => {
    const sql = readFileSync(ATLAS_STUDIO_SQL, "utf8");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "world_presets"');
    expect(sql).toContain('DROP TABLE IF EXISTS "procedural_worlds"');
  });

  it("the Atlas RA SQL is the idempotent one that adds the Country slot flags", () => {
    const sql = readFileSync(ATLAS_RA_SQL, "utf8");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "worldgen"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "claimable"');
  });

  it("the Atlas R0 SQL is the idempotent one that creates what the code calls", () => {
    const sql = readFileSync(ATLAS_R0_SQL, "utf8");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "mapVersion"');
    expect(sql).toContain("CREATE OR REPLACE FUNCTION atlas_country_union(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION sync_country_geom()");
  });
});

describe("map geometry sync triggers", () => {
  const sql = readFileSync(MAP_GEOMETRY_TRIGGERS_SQL, "utf8");

  it.each([
    ["map_layers", "map_layer_geom_sync", "sync_map_layer_geom", "geometry"],
    ["subdivisions", "subdivision_geom_sync", "sync_map_layer_geom", "geometry"],
    ["cities", "city_geom_sync", "sync_coordinate_geom", "coordinates"],
    ["points_of_interest", "poi_geom_sync", "sync_coordinate_geom", "coordinates"],
  ])(
    "%s: the trigger is re-creatable and old rows are backfilled",
    (table, trigger, fn, column) => {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${fn}()`);
      const drop = sql.indexOf(`DROP TRIGGER IF EXISTS ${trigger} ON ${table};`);
      const create = sql.indexOf(`CREATE TRIGGER ${trigger}`);
      expect(drop).toBeGreaterThanOrEqual(0);
      expect(create).toBeGreaterThan(drop);
      expect(sql).toContain(
        `BEFORE INSERT OR UPDATE OF ${column} ON ${table}\n  FOR EACH ROW EXECUTE FUNCTION ${fn}();`
      );
      expect(sql).toMatch(
        new RegExp(
          `UPDATE ${table} SET ${column} = ${column}\\s+WHERE ${column} IS NOT NULL AND geom_postgis IS NULL;`
        )
      );
    }
  );

  it("never creates a function or trigger that a re-run would trip over", () => {
    expect(sql).not.toMatch(/CREATE FUNCTION/);
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(sql.match(/DROP TRIGGER IF EXISTS/g)!.length);
  });
});
