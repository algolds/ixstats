/** @jest-environment node */
// Atlas R0 task 2: getCountryGeoProfile reads the indexed geom_postgis columns, filters by the country's realm,
// runs its queries in parallel and is cached for an hour. `jest` is the injected global on purpose:
// @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";

type Row = Record<string, string | number | null>;
type Rows = (sql: string, ...params: string[]) => Row[];

const COUNTRY = {
  id: "c1",
  name: "Caphiria",
  realmId: "default",
  geometry: { type: "Point", coordinates: [0, 0] },
  centroid: [0, 50],
  boundingBox: [0, 49, 1, 51],
  coastlineKm: null,
  landArea: 400,
  areaSqMi: null,
};

/** Rows for each query the profile makes, keyed by what its SQL reads. */
const answer: Rows = (sql, ...params) => {
  if (sql.includes("ST_Perimeter")) return [{ perimeter_km: 1000 }];
  if (sql.includes("'political'")) {
    return [
      { id: "n1", name: "North", slug: "north", shared_border_km: 80.4 },
      { id: "n2", name: "Touching", slug: null, shared_border_km: 0 },
    ];
  }
  if (sql.includes("'rivers'")) return [{ count: 3, total: 120.5 }];
  if (sql.includes("'lakes'")) return [{ count: 2, total: 40 }];
  return params[1] === "climate"
    ? [{ fill: "#00fd97", climateId: null, zoneId: null, area: 300 }]
    : [{ fill: "#a8c995", climateId: null, zoneId: null, area: 400 }];
};

function fakeDb(rows: Rows = answer) {
  return {
    realm: { findUnique: jest.fn(async () => ({ id: "default", settings: {} })) },
    country: { findUnique: jest.fn(async () => COUNTRY) },
    mapLayer: { findMany: jest.fn(async () => []) },
    peak: { findFirst: jest.fn(async () => null) },
    namedRiver: { findFirst: jest.fn(async () => null) },
    namedLake: { findFirst: jest.fn(async () => null) },
    city: { findFirst: jest.fn(async () => null) },
    $queryRawUnsafe: jest.fn(async (sql: string, ...params: string[]) => rows(sql, ...params)),
  };
}

const caller = createCallerFactory(createTRPCRouter(geoProfileProcedures));
const call = (db: ReturnType<typeof fakeDb>) =>
  caller({
    db,
    user: null,
    auth: null,
    rateLimitIdentifier: "test",
    headers: new Headers(),
  } as never).getCountryGeoProfile({ countryId: "c1" });

const sqlOf = (db: ReturnType<typeof fakeDb>) => db.$queryRawUnsafe.mock.calls.map(([sql]) => sql);

beforeEach(() => clearTrpcMemoryCache());
afterEach(() => jest.restoreAllMocks());

describe("getCountryGeoProfile queries", () => {
  it("reads geom_postgis with a bounding-box filter and never parses GeoJSON in SQL", async () => {
    const db = fakeDb();
    await call(db);
    const queries = sqlOf(db);

    // zones (climate, altitudes), rivers, lakes, neighbours, perimeter
    expect(queries).toHaveLength(6);
    for (const sql of queries) {
      expect(sql).toContain("geom_postgis");
      expect(sql).not.toContain("ST_GeomFromGeoJSON(");
    }
    for (const sql of queries.filter((q) => !q.includes("ST_Perimeter"))) {
      expect(sql).toContain("&&");
    }
  });

  it("filters the rivers, lakes, zones and neighbours by the country's realm", async () => {
    const db = fakeDb();
    await call(db);
    const layerQueries = sqlOf(db).filter((sql) => sql.includes("map_layers"));

    expect(layerQueries).toHaveLength(5);
    for (const sql of layerQueries) expect(sql).toContain(`ml."worldId" = c."realmId"`);
    expect(sqlOf(db).find((sql) => sql.includes("'political'"))).toContain(
      `c2."realmId" = c."realmId"`
    );
  });

  it("clips rivers, lakes and zones through subdivided pieces, whole when they lie inside", async () => {
    const db = fakeDb();
    await call(db);
    const clipped = sqlOf(db).filter((sql) => /'(rivers|lakes)'/.test(sql) || sql.includes("$2"));

    expect(clipped).toHaveLength(4);
    for (const sql of clipped) {
      expect(sql).toContain("ST_Subdivide(c.geom_postgis, 256)");
      expect(sql).toMatch(
        /CASE WHEN ST_CoveredBy\(\w+\.g, \w+\.g\) THEN \w+\.g\s+ELSE ST_Intersection/
      );
    }
  });

  it("assembles the profile from the answers of every query", async () => {
    const profile = await call(fakeDb());

    expect(profile.hydro).toMatchObject({
      riverCount: 3,
      totalRiverLengthKm: 121,
      lakeCount: 2,
      totalLakeAreaSqKm: 40,
    });
    expect(profile.neighbors).toEqual([
      { id: "n1", name: "North", slug: "north", sharedBorderKm: 80 },
    ]);
    expect(profile.area.perimeterKm).toBe(1000);
    expect(profile.derived.coastlineKm).toBe(920);
    expect(profile.climate.zones).toHaveLength(1);
    expect(profile.elevation.zones).toHaveLength(1);
  });

  it("starts every query before any answers and assembles whatever order they resolve in", async () => {
    const pending: Array<() => void> = [];
    const db = fakeDb();
    db.$queryRawUnsafe.mockImplementation(
      (sql: string, ...params: string[]) =>
        new Promise<Row[]>((resolve) => pending.push(() => resolve(answer(sql, ...params))))
    );

    const result = call(db);
    for (let tick = 0; tick < 200 && pending.length < 6; tick++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(pending).toHaveLength(6);
    // the last query asked answers first
    for (const resolve of pending.reverse()) resolve();

    const profile = await result;
    expect(profile.hydro.riverCount).toBe(3);
    expect(profile.neighbors.map((n) => n.id)).toEqual(["n1"]);
    expect(profile.area.perimeterKm).toBe(1000);
  });

  it("estimates rivers and lakes from bounding boxes when PostGIS fails, keeping the rest", async () => {
    const db = fakeDb((sql, ...params) => {
      if (sql.includes("'rivers'") || sql.includes("'lakes'")) throw new Error("postgis down");
      return answer(sql, ...params);
    });
    db.mapLayer.findMany.mockResolvedValue([]);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const profile = await call(db);

    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(2);
    expect(profile.hydro.riverCount).toBe(0);
    expect(profile.neighbors).toHaveLength(1);
  });

  it("falls back to the bounding box for the perimeter when the neighbour query fails", async () => {
    const db = fakeDb((sql, ...params) => {
      if (sql.includes("'political'")) throw new Error("postgis down");
      return answer(sql, ...params);
    });
    const profile = await call(db);
    expect(profile.neighbors).toEqual([]);
    expect(profile.area.perimeterKm).toBeGreaterThan(0);
    expect(profile.area.perimeterKm).not.toBe(1000);
  });
});

describe("getCountryGeoProfile cache", () => {
  it("serves the profile for an hour without querying again, then rebuilds it", async () => {
    const start = 1_800_000_000_000;
    const now = jest.spyOn(Date, "now").mockReturnValue(start);
    const db = fakeDb();

    await call(db);
    const queries = db.$queryRawUnsafe.mock.calls.length;
    expect(queries).toBe(6);

    now.mockReturnValue(start + 59 * 60_000);
    await call(db);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(queries);
    expect(db.country.findUnique).toHaveBeenCalledTimes(1);

    now.mockReturnValue(start + 61 * 60_000);
    await call(db);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(queries * 2);
  });
});
