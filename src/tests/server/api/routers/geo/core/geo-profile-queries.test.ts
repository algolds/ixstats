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
  it.each([
    ["rivers", (sql: string) => sql.includes("'rivers'")],
    ["lakes", (sql: string) => sql.includes("'lakes'")],
    ["neighbours", (sql: string) => sql.includes("'political'")],
    ["perimeter", (sql: string) => sql.includes("ST_Perimeter")],
    ["zones", (sql: string) => sql.includes("$2")],
  ])("rejects when the %s query fails, and the failure is not cached", async (_name, fails) => {
    let failing = true;
    const db = fakeDb((sql, ...params) => {
      if (failing && fails(sql)) throw new Error("postgis down");
      return answer(sql, ...params);
    });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(call(db)).rejects.toThrow("postgis down");

    failing = false;
    const profile = await call(db);
    expect(profile.hydro.riverCount).toBe(3);
    expect(db.country.findUnique).toHaveBeenCalledTimes(2);
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });

  it("rejects, caching nothing, when the country has no PostGIS shape", async () => {
    const db = fakeDb((sql, ...params) =>
      sql.includes("ST_Perimeter") ? [] : answer(sql, ...params)
    );

    await expect(call(db)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(call(db)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.country.findUnique).toHaveBeenCalledTimes(2);
  });

  it("estimates the zones of a country crossing the antimeridian, clipping everything else in PostGIS", async () => {
    const db = fakeDb();
    db.country.findUnique.mockResolvedValue({ ...COUNTRY, boundingBox: [-179.9, 7, 179.9, 20] });

    const profile = await call(db);

    // rivers, lakes, neighbours and perimeter; the two zone layers come from bounding boxes
    expect(sqlOf(db)).toHaveLength(4);
    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(2);
    expect(profile.hydro.riverCount).toBe(3);
  });
});
