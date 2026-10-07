import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  bootstrapRefusal,
  MAP_GEOMETRY_TRIGGERS_SQL,
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
