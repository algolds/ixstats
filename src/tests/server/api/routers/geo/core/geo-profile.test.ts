/** @jest-environment node */
/**
 * A country's geo profile and the geo overlays (src/server/api/routers/geo/core): the profile reads only the
 * country's realm, names zones through the realm's own climate key (Köppen codes to Trewartha types), estimates the
 * zones of a country crossing the antimeridian from bounding boxes and never turns a failed clip into a guess or a
 * cached answer; the recalculation job never loses a profile and its admin mutation is admin only; overlay figures
 * come from stored rows (bilateral trade, crises whose affected countries are JSON or legacy comma lists); border
 * history reads stay in the viewer's realm.
 *
 * `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
 *
 * Folds: src/tests/server/api/routers/geo/core/geo-profile-queries.test.ts,
 * src/tests/server/api/routers/geo/core/overlays.test.ts, src/tests/server/api/routers/geo/core/profile-job.test.ts,
 * src/tests/server/api/routers/geo/core/profile-zones.test.ts, src/tests/server/api/routers/geo/core/zone-readout.test.ts,
 * src/tests/lib/maps/crisis-affected-countries.test.ts,
 * src/tests/server/api/routers/geo/core/admin-ops-resources.test.ts,
 * src/tests/server/api/routers/geo/core/border-history.test.ts
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/country-geo", () => ({ syncCountryGeometryFromMapLayer: jest.fn() }));
jest.mock("~/lib/maps/geographic-resources", () => ({
  __esModule: true,
  refreshGeographicResources: jest.fn(),
}));
jest.mock("~/server/modules/maps/layer-loader", () => ({ loadLayerWithFallback: jest.fn() }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";
import { overlayProcedures } from "~/server/api/routers/geo/core/overlays";
import { adminOpsProcedures } from "~/server/api/routers/geo/core/admin-ops";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
import { runGeoProfileRecalculation } from "~/server/api/routers/geo/core/profile-job";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import { loadLayerWithFallback } from "~/server/modules/maps/layer-loader";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const refresh = jest.mocked(refreshGeographicResources);

const anonymous = (db: object) =>
  ({ db, user: null, auth: null, rateLimitIdentifier: "test", headers: new Headers() }) as never;

beforeEach(() => {
  clearTrpcMemoryCache();
  refresh.mockReset();
  refresh.mockResolvedValue(1);
});
afterEach(() => jest.restoreAllMocks());

describe("getCountryGeoProfile", () => {
  const KOPPEN: ClimateKey = {
    system: "Köppen",
    zones: [
      { code: "Af", name: "Tropical Rainforest", color: "#0037ff" },
      { code: "Cfb", name: "Oceanic", color: "#21c200" },
      { code: "EF", name: "Ice Cap", color: "#686868" },
    ],
  };
  const country = (realmId: string, boundingBox: number[]) => ({
    id: "c1",
    name: "Gallambria",
    realmId,
    geometry: { type: "Point", coordinates: [0, 0] },
    centroid: [0, 50],
    boundingBox,
    coastlineKm: null,
    landArea: 400,
    areaSqMi: null,
  });

  /** Rows for each query the profile makes, keyed by what its SQL reads; the zone clips take the layer as $2. */
  function answer(sql: string, ...params: string[]): object[] {
    if (sql.includes("ST_Perimeter")) return [{ perimeter_km: 1000 }];
    if (sql.includes("'political'")) {
      return [{ id: "n1", name: "North", slug: "north", shared_border_km: 80.4 }];
    }
    if (sql.includes("'rivers'")) return [{ count: 3, total: 120.5 }];
    if (sql.includes("'lakes'")) return [{ count: 2, total: 40 }];
    return params[1] === "climate"
      ? [
          { fill: "#21c200", climateId: "Cfb", zoneId: null, area: 300 },
          { fill: "#686868", climateId: "EF", zoneId: null, area: 100 },
        ]
      : [];
  }

  function fakeDb(row: object, rows: (sql: string, ...params: string[]) => object[] = answer) {
    return {
      realm: {
        findUnique: jest.fn(async ({ where }: { where: { id?: string } }) =>
          where.id === EURTH
            ? { id: EURTH, settings: { map: { climateKey: KOPPEN } } }
            : { id: DEFAULT_REALM_ID, settings: {} }
        ),
      },
      country: { findUnique: jest.fn(async () => row) },
      mapLayer: {
        findMany: jest.fn(async (_args: { where: { layerType: string; realmId: string } }) => [
          {
            featureId: "f1",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 8],
                  [10, 8],
                  [10, 10],
                  [0, 8],
                ],
              ],
            },
            properties: { fill: "#00fd97" },
            areaSqKm: 100,
            displayName: null,
          },
        ]),
      },
      peak: { findFirst: jest.fn(async () => null) },
      namedRiver: { findFirst: jest.fn(async () => null) },
      namedLake: { findFirst: jest.fn(async () => null) },
      city: { findFirst: jest.fn(async () => null) },
      $queryRawUnsafe: jest.fn(async (sql: string, ...params: string[]) => rows(sql, ...params)),
    };
  }

  const caller = createCallerFactory(createTRPCRouter(geoProfileProcedures));
  const profileOf = (db: ReturnType<typeof fakeDb>) =>
    caller(anonymous(db)).getCountryGeoProfile({ countryId: "c1" });
  const sqlOf = (db: ReturnType<typeof fakeDb>) =>
    db.$queryRawUnsafe.mock.calls.map(([sql]) => sql);

  it("reads only the realm's own layers and neighbours, and names its zones through the realm's Köppen key", async () => {
    const db = fakeDb(country(EURTH, [0, 49, 1, 51]));
    const profile = await profileOf(db);

    expect(
      profile.climate.zones.map((z) => ({
        code: z.code,
        name: z.name,
        type: z.type,
        pct: z.percentArea,
      }))
    ).toEqual([
      { code: "Cfb", name: "Oceanic", type: "Temperate Oceanic (Do)", pct: 75 },
      { code: "EF", name: "Ice Cap", type: "Ice Cap (Fi)", pct: 25 },
    ]);
    const layerQueries = sqlOf(db).filter((sql) => sql.includes("map_layers"));
    expect(layerQueries).toHaveLength(5);
    expect(layerQueries.filter((sql) => !sql.includes(`ml."worldId" = c."realmId"`))).toEqual([]);
    expect(sqlOf(db).find((sql) => sql.includes("'political'"))).toContain(
      `c2."realmId" = c."realmId"`
    );
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });

  it("estimates the zones of a country crossing the antimeridian from its realm's layer boxes, clipping the rest in PostGIS", async () => {
    // geom_postgis of a country crossing +-180 is a planar sliver, so a zone clip would be wrong
    const db = fakeDb(country(DEFAULT_REALM_ID, [-179.9, 7, 179.9, 20]));
    const profile = await profileOf(db);

    expect(sqlOf(db)).toHaveLength(4);
    expect(db.mapLayer.findMany.mock.calls.map(([args]) => args.where)).toEqual([
      { layerType: "climate", isActive: true, realmId: DEFAULT_REALM_ID },
      { layerType: "altitudes", isActive: true, realmId: DEFAULT_REALM_ID },
    ]);
    expect(profile.climate.zones.map((z) => z.areaSqKm)).toEqual([100]);
    expect(profile.hydro.riverCount).toBe(3);
  });

  it("a failed zone clip rejects: never estimated, never cached", async () => {
    let failing = true;
    const db = fakeDb(country(DEFAULT_REALM_ID, [7, -33, 45, -1]), (sql, ...params) => {
      if (failing && params[1] === "climate") throw new Error("postgis down");
      return answer(sql, ...params);
    });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(profileOf(db)).rejects.toThrow("postgis down");
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();

    failing = false;
    expect((await profileOf(db)).hydro.riverCount).toBe(3);
    expect(db.country.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("runGeoProfileRecalculation (the geo-profiles cron job)", () => {
  const COUNTRIES = [
    { id: "c1", name: "Aurelia" },
    { id: "c2", name: "Borealis" },
    { id: "c3", name: "Cartadania" },
  ];

  function jobDb() {
    return {
      country: {
        findMany: jest.fn(async () => COUNTRIES),
        count: jest.fn(async () => COUNTRIES.length),
        findUnique: jest.fn(async () => ({
          coastlineKm: 100,
          landArea: 50_000,
          areaSqMi: null,
          geometry: { type: "Polygon", coordinates: [] },
          boundingBox: [0, 0, 1, 1],
          realmId: "default",
          realm: { settings: {} },
        })),
      },
      cronRun: { findFirst: jest.fn(async () => null) },
      mapLayer: { findMany: jest.fn(async () => []) },
      $queryRawUnsafe: jest.fn(async () => []),
      countryGeoProfile: {
        updateMany: jest.fn(async () => ({ count: 2 })),
        upsert: jest.fn(async () => ({})),
      },
    };
  }

  it("leaves a country that fails stale for the next run, reports it and carries on", async () => {
    const db = jobDb();
    db.country.findUnique.mockResolvedValueOnce(null as never);

    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toMatchObject({ total: 3, processed: 2, failed: 1, remaining: 1 });
    expect(result.errors).toEqual(["Aurelia: no geometry"]);
    expect(refresh.mock.calls.map((call) => call[1])).toEqual(["c2", "c3"]);
  });

  it("a resource failure is reported without losing the country's profile", async () => {
    refresh.mockRejectedValueOnce(new Error("postgis down")).mockResolvedValue(2);
    const db = jobDb();

    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toMatchObject({ processed: 3, failed: 1, remaining: 0, resourcesWritten: 4 });
    expect(result.errors).toEqual(["Aurelia (resources): postgis down"]);
    expect(db.countryGeoProfile.upsert).toHaveBeenCalledTimes(3);
  });
});

it("recalculateGeoProfiles is admin only", async () => {
  const db = {
    user: {
      findUnique: jest.fn(async () => ({ id: "db_user", role: { name: "user", level: 100 } })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    country: { count: jest.fn(async () => 2) },
    cronRun: { findFirst: jest.fn(async () => null) },
    countryGeoProfile: { updateMany: jest.fn(async () => ({ count: 2 })) },
  };
  const ctx = createMockRouterContext({
    db,
    auth: { userId: "user_1" },
    user: { id: "db_user", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    rateLimitIdentifier: `user_${Math.random()}`,
  });
  const api = createCallerFactory(createTRPCRouter(adminOpsProcedures))(ctx as never);

  await expect(api.recalculateGeoProfiles()).rejects.toThrow(/Admin/);
  expect(db.countryGeoProfile.updateMany).not.toHaveBeenCalled();
});

describe("overlays from stored data", () => {
  const overlayDb = () => ({
    country: { findMany: jest.fn() },
    bilateralTrade: { findMany: jest.fn().mockResolvedValue([]) },
    storytellerEffect: { groupBy: jest.fn().mockResolvedValue([]) },
    diplomaticEvent: { groupBy: jest.fn().mockResolvedValue([]) },
    nationalIssue: { groupBy: jest.fn().mockResolvedValue([]) },
    militaryConflict: { groupBy: jest.fn().mockResolvedValue([]) },
    storyPin: { groupBy: jest.fn().mockResolvedValue([]) },
    countryGeoProfile: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    crisisEvent: { findMany: jest.fn().mockResolvedValue([]) },
  });
  const overlays = (db: ReturnType<typeof overlayDb>) =>
    createCallerFactory(createTRPCRouter(overlayProcedures))(anonymous(db));

  it("the trade-balance choropleth nets each country's bilateral trade rows, surplus ranked first", async () => {
    const db = overlayDb();
    db.country.findMany.mockResolvedValue(
      ["A", "B", "C"].map((id) => ({
        id,
        name: `Country ${id}`,
        slug: id,
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
        centroid: { coordinates: [0, 0] },
        continent: "Continent",
        region: "Region",
        currentPopulation: 10_000_000,
        currentGdpPerCapita: 20_000,
        currentTotalGdp: 200_000_000_000,
        tradeBalance: 0,
        landArea: 100_000,
      }))
    );
    db.bilateralTrade.findMany.mockResolvedValue([
      {
        country1Id: "A",
        country2Id: "B",
        exportsFrom1: 200,
        exportsFrom2: 100,
        tradeBalance1: 100,
      },
      {
        country1Id: "C",
        country2Id: "A",
        exportsFrom1: 50,
        exportsFrom2: 150,
        tradeBalance1: -100,
      },
    ]);

    const result = await overlays(db).getRegionalChoropleth({
      metric: "tradeBalance",
      groupBy: "country",
    });

    const byId = new Map(result.rows.map((row) => [row.countryId, row]));
    expect([byId.get("A")?.rawValue, byId.get("B")?.rawValue, byId.get("C")?.rawValue]).toEqual([
      200, -100, -100,
    ]);
    expect(byId.get("A")?.value).toBeLessThan(byId.get("B")?.value ?? 1);
  });

  it("places each crisis at its first affected country with a centroid, read from JSON or legacy comma lists in one query", async () => {
    const db = overlayDb();
    const crisis = (id: string, affectedCountries: string | null) => ({
      id,
      title: `Crisis ${id}`,
      type: "natural_disaster",
      severity: "high",
      location: null,
      affectedCountries,
    });
    db.crisisEvent.findMany.mockResolvedValue([
      crisis("json", '["A","B"]'),
      crisis("legacy", "C, D"),
      crisis("nowhere", null),
      crisis("no-centroid", '["A"]'),
    ]);
    db.country.findMany.mockResolvedValue([
      { id: "A", name: "Alpha", centroid: null },
      { id: "B", name: "Beta", centroid: { coordinates: [5, 6] } },
      { id: "C", name: "Gamma", centroid: { coordinates: [3, 4] } },
    ]);

    const result = (await overlays(db).getCrisisRiskMap()) as {
      crisisEvents: {
        features: Array<{
          geometry: { coordinates: [number, number] };
          properties: { id: string; countryName: string };
        }>;
      };
    };

    expect(db.country.findMany).toHaveBeenCalledTimes(1);
    expect(
      result.crisisEvents.features.map((f) => [
        f.properties.id,
        f.properties.countryName,
        f.geometry.coordinates,
      ])
    ).toEqual([
      ["json", "Beta", [5, 6]],
      ["legacy", "Gamma", [3, 4]],
    ]);
  });
});

describe("border history reads stay in the viewer's realm", () => {
  const IX_DAY_MS = 86_400_000;
  const caller = createCallerFactory(createTRPCRouter(borderHistoryProcedures));

  function historyDb() {
    return {
      borderHistory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      realm: { findUnique: jest.fn().mockResolvedValue({ id: EURTH }) },
    };
  }
  const viewerOfEurth = (db: ReturnType<typeof historyDb>) =>
    caller({
      db,
      user: { id: "u1", clerkUserId: "clerk_u1", country: { id: "c1", realmId: EURTH } },
      auth: null,
      rateLimitIdentifier: "test",
      headers: new Headers(),
    } as never);

  beforeEach(() => {
    jest.mocked(loadLayerWithFallback).mockResolvedValue({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { countryId: "c1" },
        },
      ],
    } as never);
  });

  it("the world map as of a date reads one latest snapshot per country of the viewer's realm, bounded", async () => {
    const db = historyDb();
    await viewerOfEurth(db).getWorldMapAsOf({ ixTime: 20_000 * IX_DAY_MS + 5_000 });

    const args = db.borderHistory.findMany.mock.calls[0]![0];
    expect(args.where.country).toEqual({ realmId: EURTH });
    expect(args.distinct).toEqual(["countryId"]);
    expect(args.take).toBeGreaterThan(0);
    expect(args.take).toBeLessThanOrEqual(5_000);
  });

  it("the history range starts at the earliest edit of the viewer's realm, not of every realm", async () => {
    const db = historyDb();
    await viewerOfEurth(db).getHistoryRange();
    expect(db.borderHistory.findFirst.mock.calls[0]![0].where).toEqual({
      country: { realmId: EURTH },
    });
  });

  it("the history range runs on real time (edits are stamped in real time) and names the realm", async () => {
    const db = historyDb();
    const before = Date.now();
    const range = await viewerOfEurth(db).getHistoryRange();
    expect(range.realmId).toBe(EURTH);
    expect(range.maxTime).toBeGreaterThanOrEqual(before);
    expect(range.maxTime).toBeLessThanOrEqual(Date.now());
  });
});
