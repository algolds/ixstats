/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("fs/promises", () => ({ readFile: jest.fn() }));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual("~/lib/maps/geo-validation"),
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));

jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/lib/country-geo/sync", () => ({
  syncGeographicDemographics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo", () => ({
  ...jest.requireActual("~/lib/country-geo"),
  upsertCity: jest.fn().mockResolvedValue({ id: "city", isNationalCapital: false }),
  syncCountryGeometryFromMapLayer: jest.fn(),
}));

import { readFile } from "fs/promises";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { loadLayerWithFallback } from "~/server/modules/maps/layer-loader";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
import { discoveryProcedures } from "~/server/api/routers/geo/core/discovery";
import { countryProcedures } from "~/server/api/routers/geo/core/country";
import { pointQueryProcedures } from "~/server/api/routers/geo/core/point-queries";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";
import { geoFeaturesLabelsRouter } from "~/server/api/routers/geo/features/labels";
import { geoFeaturesStoryPinsRouter } from "~/server/api/routers/geo/features/storyPins";
import { transportRouteQueriesRouter } from "~/server/api/routers/transport/routeQueries";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import type { PrismaClient } from "@prisma/client";
import { updateSubdivisionSpatialProfile } from "~/lib/country-geo/spatial";
import {
  clipAndValidatePolygon,
  COUNTRY_BORDER_SQL,
  resetPostGISCache,
  snapPointToCountryBorder,
  validatePointContainment,
  validatePolygonContainment,
} from "~/lib/maps/geo-validation";
import { countryGeoRouter } from "~/server/api/routers/countryGeo";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";

const EURTH = "r_eurth";

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock> & Record<`$${string}`, jest.Mock>;

function modelMock(): ModelMock {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: "created" }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({ id: "session" }),
  };
}

/** Every model answers empty; `$transaction(fn)` runs fn against the same db; raw SQL returns no rows. */
function emptyDb(): Db {
  const models = new Map<string, ModelMock>();
  const raw: Record<string, jest.Mock> = {
    $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  const db: Db = new Proxy({} as Db, {
    get: (_target, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
      if (key.startsWith("$")) return raw[key];
      if (!models.has(key)) models.set(key, modelMock());
      return models.get(key);
    },
  });
  // ?realm=eurth resolves to the Eurth realm id; the two known realm ids resolve to themselves
  db.realm!.findUnique!.mockImplementation(
    async (args: { where: { slug?: string; id?: string } }) =>
      ({ eurth: { id: EURTH }, ixnay: { id: DEFAULT_REALM_ID } })[args.where.slug ?? ""] ??
      ([EURTH, DEFAULT_REALM_ID].includes(args.where.id ?? "") ? { id: args.where.id } : null)
  );
  return db;
}

function eurthViewer() {
  return {
    id: "u1",
    clerkUserId: "clerk_u1",
    countryId: "c_eu",
    country: { id: "c_eu", realmId: EURTH },
  };
}

function ctxFor(db: Db, user: ReturnType<typeof eurthViewer> | null) {
  return { db, user, auth: null, rateLimitIdentifier: "test", headers: new Headers() } as never;
}

function adminCtx(db: Db) {
  return createMockRouterContext({
    db,
    auth: { userId: "admin_1" },
    user: {
      id: "db_admin",
      clerkUserId: "admin_1",
      role: { name: "admin", level: 10 },
      country: null,
    },
  }) as never;
}

function wheres(db: Db, model: string, method = "findMany") {
  return db[model]![method]!.mock.calls.map(
    (c: [{ where?: Record<string, unknown> }]) => c[0]?.where
  );
}

/** A where names the realm directly (map layers, routes) or through its country (cities, labels…). */
function realmOf(where: Record<string, unknown> | undefined): unknown {
  return where?.realmId ?? (where?.country as { realmId?: unknown } | undefined)?.realmId;
}

const geo = createTRPCRouter({
  ...worldMapProcedures,
  ...borderHistoryProcedures,
  ...discoveryProcedures,
  ...countryProcedures,
  ...pointQueryProcedures,
  ...geoProfileProcedures,
});
const geoCaller = createCallerFactory(geo);

beforeEach(() => {
  clearTrpcMemoryCache();
  clearLayerCache();
  (readFile as unknown as jest.Mock).mockReset();
});

describe("/maps shows only the viewed realm's map", () => {
  it("an Eurth map's layers read Eurth rows and never Ixnay's static files", async () => {
    const db = emptyDb();
    const layers = await Promise.all(
      ["background", "political"].map((layer) => loadLayerWithFallback(db, layer, 1, EURTH))
    );

    expect(wheres(db, "mapLayer").map(realmOf)).toEqual([EURTH, EURTH]);
    expect(layers).toEqual([
      { type: "FeatureCollection", features: [] },
      { type: "FeatureCollection", features: [] },
    ]);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("the map's POIs, capitals, cities and subdivisions belong to the realm's countries", async () => {
    const db = emptyDb();
    const caller = geoCaller(ctxFor(db, eurthViewer()));
    const markers = await caller.getMapBundleMarkers();
    await caller.getMapBundleDetail({});

    // the resolved realm travels with the markers so the client can name it
    expect(markers.realmId).toBe(EURTH);

    expect(
      [...wheres(db, "city"), ...wheres(db, "pointOfInterest"), ...wheres(db, "subdivision")].map(
        realmOf
      )
    ).toEqual([EURTH, EURTH, EURTH, EURTH]);
  });

  const listings: Array<[string, string[], (db: Db) => Promise<unknown>]> = [
    [
      "geoCore.getWorldMapAsOf",
      ["mapLayer"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).getWorldMapAsOf({ ixTime: 0 }),
    ],
    [
      "geoCore.listCountries",
      ["mapLayer"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).listCountries(),
    ],
    [
      "geoCore.searchFeatures",
      ["mapLayer", "city", "subdivision"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).searchFeatures({ query: "ga" }),
    ],
    [
      "geoCore.getAllMapFeatures",
      ["city", "pointOfInterest", "subdivision"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).getAllMapFeatures(),
    ],
    [
      "geoCore.getCapitalCities",
      ["city"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).getCapitalCities(),
    ],
    [
      "geoFeatures.getAllMapLabels",
      ["mapLabel"],
      (db) =>
        createCallerFactory(geoFeaturesLabelsRouter)(ctxFor(db, eurthViewer())).getAllMapLabels(),
    ],
    [
      "geoFeatures.getAllStoryPins",
      ["storyPin"],
      (db) =>
        createCallerFactory(geoFeaturesStoryPinsRouter)(
          ctxFor(db, eurthViewer())
        ).getAllStoryPins(),
    ],
    [
      "transport.getAllRoutesGeoJSON",
      ["transportRoute"],
      (db) =>
        createCallerFactory(transportRouteQueriesRouter)(
          ctxFor(db, eurthViewer())
        ).getAllRoutesGeoJSON(),
    ],
  ];

  it.each(listings)("%s lists the viewer's realm only", async (_name, models, call) => {
    const db = emptyDb();
    await call(db);

    const seen = models.flatMap((m) => wheres(db, m));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.map(realmOf)).toEqual(seen.map(() => EURTH));
  });

  it("a feature-id or name lookup is scoped to the realm; a country-id lookup is not", async () => {
    const db = emptyDb();
    const caller = geoCaller(ctxFor(db, eurthViewer()));
    for (const input of [
      { featureId: "Gallambria" },
      { countryName: "Gallambria" },
      { countryId: "c_eu" },
    ]) {
      await caller.getCountryGeometry(input).catch(() => undefined);
    }

    expect(wheres(db, "mapLayer", "findFirst").map(realmOf)).toEqual([EURTH, EURTH, undefined]);
  });
});

describe("a country's geo profile uses its own realm's base layers", () => {
  it("an Eurth country is profiled against Eurth's climate, altitude, river and lake layers", async () => {
    const db = emptyDb();
    // the profile reads the country's perimeter from PostGIS too; a country without one cannot be profiled
    db.$queryRawUnsafe!.mockImplementation(async (sql: string) =>
      sql.includes("ST_Perimeter") ? [{ perimeter_km: 100 }] : []
    );
    db.country!.findUnique!.mockResolvedValue({
      id: "c_eu",
      name: "Gallambria",
      realmId: EURTH,
      geometry: { type: "Point", coordinates: [0, 0] },
      centroid: [0, 0],
      boundingBox: [0, 0, 1, 1],
      coastlineKm: null,
      landArea: 1,
      areaSqMi: null,
    });
    await geoCaller(ctxFor(db, null)).getCountryGeoProfile({ countryId: "c_eu" });

    // Climate and altitude zones are clipped to the nation in PostGIS, like rivers and lakes
    const sqls = db.$queryRawUnsafe!.mock.calls.map((c: [string]) => c[0]);
    const zoneAndHydroSql = sqls.filter((sql: string) =>
      /ST_Subdivide\(ml\.geom_postgis|"layerType" = '(rivers|lakes)'/.test(sql)
    );
    expect(zoneAndHydroSql).toHaveLength(4);
    for (const sql of zoneAndHydroSql) expect(sql).toContain(`ml."worldId" = c."realmId"`);
  });
});

describe("the world editor works inside the realm it edits (ruling E-o)", () => {
  it("refuses to link a feature to a country of another realm", async () => {
    const db = emptyDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", featureId: "Gallambria" });
    db.country!.findUnique!.mockResolvedValue({ id: "c_ix", realmId: DEFAULT_REALM_ID });

    await expect(
      createCallerFactory(geoEditorLinkageAssignmentRouter)(adminCtx(db)).assignCountryGeometry({
        featureId: "Gallambria",
        countryId: "c_ix",
        realm: "eurth",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(realmOf(wheres(db, "mapLayer", "findFirst")[0])).toBe(EURTH);
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });

  it("refuses to re-link a feature to another realm's country through its properties", async () => {
    const db = emptyDb();
    db.mapLayer!.findFirst!.mockResolvedValue({
      id: "ml1",
      featureId: "Gallambria",
      countryId: null,
    });
    db.country!.findUnique!.mockResolvedValue({ name: "Caphiria", realmId: DEFAULT_REALM_ID });

    await expect(
      createCallerFactory(geoEditorLinkageAssignmentRouter)(adminCtx(db)).updateFeatureProperties({
        featureId: "Gallambria",
        countryId: "c_ix",
        displayName: "Gallambria",
        realm: "eurth",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
    expect(db.country!.update).not.toHaveBeenCalled();
  });

  it("refuses link_by_name to another realm's country", async () => {
    const db = emptyDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", featureId: "Gallambria" });
    db.country!.findUnique!.mockResolvedValue({ name: "Caphiria", realmId: DEFAULT_REALM_ID });

    await expect(
      createCallerFactory(geoEditorLinkageValidationRouter)(adminCtx(db)).repairLinkage({
        action: "link_by_name",
        featureId: "Gallambria",
        countryId: "c_ix",
        realm: "eurth",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
    expect(db.country!.update).not.toHaveBeenCalled();
  });
  it("rebuilding adjacency pairs and updates the given realm's features only", async () => {
    const db = emptyDb();
    db.$queryRawUnsafe!.mockResolvedValue([{ a: "A", b: "B" }]);
    await createCallerFactory(geoEditorBordersRouter)(adminCtx(db)).rebuildAdjacency({
      realmId: EURTH,
    });

    const [sql, realmParam] = db.$queryRawUnsafe!.mock.calls[0];
    expect(sql).toContain(`a."worldId" = $1 AND b."worldId" = $1`);
    expect(realmParam).toBe(EURTH);
    expect(wheres(db, "mapLayer", "updateMany").map(realmOf)).toEqual([EURTH, EURTH, EURTH]);
  });
});

/**
 * A realm's planet radius (`Realm.settings.map.radiusKm`) scales the areas its map editors store and the
 * "Recompute areas" action, which never touches nations' stated land area unless the founder asks.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
describe("a realm's map areas and settings", () => {
  const EURTH = "r_eurth";
  const FOUNDER = "clerk_founder";
  const MAP_OFFICER = "clerk_mapper";
  const HALF_EARTH = EARTH_RADIUS_KM / 2;
  type ModelMock = Record<string, jest.Mock>;
  type Db = Record<string, ModelMock> & Record<`$${string}`, jest.Mock>;
  function realmDb(radiusKm?: number): Db {
    const models = new Map<string, ModelMock>();
    const raw: Record<string, jest.Mock> = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      // invalidateRealmMap's version bump
      $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]),
    };
    const db = new Proxy({} as Db, {
      get: (_t, name) => {
        const key = String(name);
        if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
        if (key.startsWith("$")) return raw[key];
        if (!models.has(key)) {
          models.set(key, {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            groupBy: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({ id: "created" }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          });
        }
        return models.get(key);
      },
    });
    const realm = {
      id: EURTH,
      slug: "eurth",
      name: "Eurth",
      ownerId: FOUNDER,
      status: "active",
      settings: radiusKm ? { map: { radiusKm } } : {},
      officers: [{ userId: MAP_OFFICER, powers: ["map"] }],
    };
    db.realm!.findUnique!.mockImplementation(
      async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === "eurth" || where.id === EURTH ? realm : null
    );
    return db;
  }
  function ctxAs(db: Db, clerkUserId: string) {
    return createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, role: null, country: null },
      rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
    }) as never;
  }
  const SQUARE = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
    ],
  };
  async function splitAreas(radiusKm?: number) {
    const db = realmDb(radiusKm);
    db.mapLayer!.findFirst!.mockResolvedValue({
      id: "ml1",
      featureId: "Big",
      countryId: null,
      geometry: SQUARE,
    });
    await createCallerFactory(geoEditorBordersRouter)(ctxAs(db, MAP_OFFICER)).splitCountry({
      featureId: "Big",
      splitLine: [
        [2, -1],
        [2, 5],
      ],
      nameA: "West",
      nameB: "East",
      realm: "eurth",
    });
    const rows = db.mapLayer!.createMany!.mock.calls[0][0].data as Array<{ areaSqKm: number }>;
    return rows.map((r) => r.areaSqKm);
  }
  describe("the border editor stores areas on the realm's planet", () => {
    it("a planet of half Earth's radius stores a quarter of the area", async () => {
      const earth = await splitAreas();
      const small = await splitAreas(HALF_EARTH);
      expect(earth).toHaveLength(2);
      small.forEach((area, i) => expect(area).toBeCloseTo(earth[i]! / 4, 6));
    });
  });
  describe("Recompute areas", () => {
    const recompute = (db: Db, who: string, alsoSetLandArea = false) =>
      createCallerFactory(realmMapRouter)(ctxAs(db, who)).recomputeAreas({
        realm: "eurth",
        alsoSetLandArea,
      });
    it("leaves nations' stated land area alone unless the founder ticks the box", async () => {
      const db = realmDb();
      await recompute(db, MAP_OFFICER);
      expect(db.country!.updateMany).not.toHaveBeenCalled();
      expect(db.country!.update).not.toHaveBeenCalled();
    });
    it("refuses an unknown realm slug, even for a site admin, instead of falling back to Ixnay", async () => {
      const db = realmDb();
      const ctx = createMockRouterContext({
        db,
        auth: { userId: "clerk_admin" },
        user: {
          id: "db_admin",
          clerkUserId: "clerk_admin",
          role: { name: "admin", level: 10 },
          country: null,
        },
        rateLimitIdentifier: `admin_${Math.random()}`,
      }) as never;
      const map = createCallerFactory(realmMapRouter)(ctx);
      await expect(
        map.recomputeAreas({ realm: "eruth", alsoSetLandArea: true })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(map.updateSettings({ realm: "eruth", radiusKm: 1000 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(db.country!.updateMany).not.toHaveBeenCalled();
      expect(db.realm!.update).not.toHaveBeenCalled();
    });

    it("a player who is neither founder nor map officer cannot recompute", async () => {
      const db = realmDb();
      await expect(recompute(db, "clerk_player")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
  describe("map settings", () => {
    it("refuses a base image that is neither https nor an upload", async () => {
      const db = realmDb();
      await expect(
        createCallerFactory(realmMapRouter)(ctxAs(db, FOUNDER)).updateSettings({
          realm: "eurth",
          baseImage: "http://example.org/map.png",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.realm!.update).not.toHaveBeenCalled();
    });
  });
});

/**
 * Realms share one coordinate space, so every raw spatial join on map_layers must match the realm of the
 * country, subdivision or city it measures; otherwise Ixnay's climate, altitudes, rivers and lakes answer for
 * another realm's land.
 */
describe("spatial profiles and borders read only the country's realm", () => {
  const EURTH = "r_eurth";
  const SQUARE = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  };
  /** A db whose raw SQL answers `rows` (by default none) and records every statement. */
  function sqlDb(rows: (sql: string) => unknown[] = () => []) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const $queryRawUnsafe = jest.fn(async (sql: string, ...params: unknown[]) => {
      statements.push({ sql, params });
      return rows(sql);
    });
    const model = () => ({
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    });
    const db: Record<string, any> = {
      $queryRawUnsafe,
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      // invalidateRealmMap's version bump, after an import
      $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]),
      subdivision: model(),
      city: model(),
      country: model(),
      user: model(),
      realm: {
        findUnique: jest.fn(async (args: { where: { slug?: string; id?: string } }) =>
          args.where.slug === "eurth" || args.where.id === EURTH ? { id: EURTH } : null
        ),
      },
    };
    db.$transaction = (fn: (tx: unknown) => unknown) => fn(db);
    /** The statements that read map_layers. */
    const mapLayerSql = () => statements.filter((s) => /map_layers/.test(s.sql));
    return { db, statements, mapLayerSql };
  }
  /** The realm predicate of a statement that joins map_layers to the country being measured. */
  const REALM_JOIN = /ml\."worldId" = co\."realmId"/;
  beforeEach(() => {
    clearTrpcMemoryCache();
    resetPostGISCache();
  });
  describe("spatial profiles read only the country's realm", () => {
    it("a subdivision's climate, altitudes, rivers and lakes", async () => {
      const { db, mapLayerSql } = sqlDb();
      db.subdivision.findUnique.mockResolvedValue({ id: "s1", geometry: SQUARE, areaSqKm: 1 });
      await updateSubdivisionSpatialProfile(db, "s1");

      const sql = mapLayerSql();
      expect(sql.map((s) => s.sql.match(/"layerType" = '(\w+)'/)?.[1])).toEqual([
        "climate",
        "altitudes",
        "rivers",
        "lakes",
      ]);
      for (const { sql: text } of sql) {
        expect(text).toContain(`JOIN "Country" co ON co.id = s."countryId"`);
        expect(text).toMatch(REALM_JOIN);
      }
    });
  });
  describe("terrain lookups take a realm", () => {
    it("countryGeo.sampleTerrainAt samples the viewed realm, or the viewer's own", async () => {
      const viewer = {
        id: "u1",
        clerkUserId: "clerk_u1",
        countryId: "c_eu",
        country: { id: "c_eu", name: "Eu", slug: "eu", realmId: EURTH },
      };
      const sample = async (realm?: string) => {
        const { db, mapLayerSql } = sqlDb();
        const caller = createCallerFactory(countryGeoRouter)(
          createMockRouterContext({ db, auth: { userId: "clerk_u1" }, user: viewer }) as never
        );
        await caller.sampleTerrainAt({ lng: 1, lat: 2, realm });
        return mapLayerSql()[0]!.params[2];
      };
      expect(await sample()).toBe(EURTH);
      expect(await sample("ixnay")).toBe(DEFAULT_REALM_ID);
      expect(await sample("ixworld")).toBe(DEFAULT_REALM_ID);
    });
  });
  describe("a country's border is read from its own realm", () => {
    it("the shared border subquery matches the country's realm", () => {
      expect(COUNTRY_BORDER_SQL).toContain(`JOIN "Country" co ON co.id = ml."countryId"`);
      expect(COUNTRY_BORDER_SQL).toMatch(REALM_JOIN);
    });

    it.each([
      ["validatePointContainment", (db: PrismaClient) => validatePointContainment(db, "c1", 1, 1)],
      [
        "validatePolygonContainment",
        (db: PrismaClient) => validatePolygonContainment(db, "c1", SQUARE),
      ],
      ["clipAndValidatePolygon", (db: PrismaClient) => clipAndValidatePolygon(db, "c1", SQUARE)],
      ["snapPointToCountryBorder", (db: PrismaClient) => snapPointToCountryBorder(db, "c1", 1, 1)],
    ])("%s", async (_name, run) => {
      const { db, mapLayerSql } = sqlDb((sql) =>
        /PostGIS_Version/.test(sql)
          ? [{}]
          : [{ is_inside: true, clipped: JSON.stringify(SQUARE), distance_meters: 0 }]
      );
      await run(db as unknown as PrismaClient);
      expect(mapLayerSql().length).toBeGreaterThan(0);
      for (const { sql } of mapLayerSql()) expect(sql).toContain(COUNTRY_BORDER_SQL);
    });
  });
});

/**
 * Auto-Match in the world editor: realm-scoped, read in pages past the 1,000-row guard, fuzzy (with the roster's
 * nation page titles and the nations' source keys as aliases), reviewed before anything uncertain is linked, and
 * able to give one nation several regions.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
describe("auto-match stays in the edited realm", () => {
  const EURTH = "r_eurth";
  const MAP_OFFICER = "clerk_mapper";
  type Row = { id: string; [key: string]: unknown };
  /** findMany over `rows` honouring `take`, `cursor` and `skip` like Prisma's id-ordered paging. */
  function pagedFindMany(rows: Row[]) {
    return jest.fn(
      async (args: {
        where?: Record<string, unknown>;
        take?: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
        const start = args.cursor
          ? sorted.findIndex((r) => r.id === args.cursor!.id) + (args.skip ?? 0)
          : 0;
        return sorted.slice(start, start + (args.take ?? sorted.length));
      }
    );
  }
  function setup({
    regions,
    countries,
    pages = [],
  }: {
    regions: Row[];
    countries: Row[];
    pages?: Row[];
  }) {
    const db = {
      realm: {
        findUnique: jest.fn(async ({ where }: { where: { slug?: string; id?: string } }) =>
          where.slug === "eurth" || where.id === EURTH
            ? {
                id: EURTH,
                ownerId: "clerk_founder",
                status: "active",
                officers: [{ userId: MAP_OFFICER, powers: ["map"] }],
              }
            : null
        ),
      },
      mapLayer: {
        findMany: pagedFindMany(regions),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      country: {
        findMany: jest.fn(async (args: { where: { id?: { in: string[] } }; take?: number }) =>
          args.where.id?.in
            ? countries.filter((c) => args.where.id!.in.includes(c.id))
            : pagedFindMany(countries)(args)
        ),
      },
      realmPage: { findMany: pagedFindMany(pages) },
      // invalidateRealmMap's version bump after the links are written
      $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]),
    };
    const caller = createCallerFactory(geoEditorLinkageValidationRouter)(
      createMockRouterContext({
        db,
        auth: { userId: MAP_OFFICER },
        user: { id: "db_mapper", clerkUserId: MAP_OFFICER, role: null, country: null },
        rateLimitIdentifier: `${MAP_OFFICER}_${Math.random()}`,
      }) as never
    );
    return { db, caller };
  }
  const region = (id: string, featureId: string, displayName: string | null = null) => ({
    id,
    featureId,
    displayName,
  });
  beforeEach(() => {
    clearTrpcMemoryCache();
    (syncCountryGeometryFromMapLayer as jest.Mock).mockClear();
  });
  describe("Auto-Match", () => {
    it("reads every region and nation in pages, past the 1,000-row guard", async () => {
      const regions = Array.from({ length: 1203 }, (_, i) =>
        region(`m${String(i).padStart(5, "0")}`, `Region ${i}`)
      );
      const { caller, db } = setup({
        regions,
        countries: [
          { id: "c_last", name: "Region 1202", wikiPageTitle: null, externalSourceKey: null },
        ],
      });
      const result = await caller.suggestLinkageMatches({ realm: "eurth" });
      expect(result.unlinkedRegions).toBe(1203);
      expect(result.suggestions.map((s) => s.featureId)).toContain("Region 1202");
      expect(db.mapLayer.findMany.mock.calls.length).toBeGreaterThan(2);
      for (const [args] of db.mapLayer.findMany.mock.calls) expect(args.take).toBeDefined();
    });
    it("links reviewed matches, refusing nations of another realm", async () => {
      const { caller, db } = setup({
        regions: [],
        countries: [{ id: "c_ost", name: "Ostia", wikiPageTitle: null, externalSourceKey: null }],
      });
      await expect(
        caller.repairLinkage({
          action: "apply_matches",
          realm: "eurth",
          matches: [
            { featureId: "Ostai", countryId: "c_ost" },
            { featureId: "Elsewhere", countryId: "c_ixnay" },
          ],
        })
      ).resolves.toEqual({ repaired: 1 });
      expect(db.country.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ["c_ost", "c_ixnay"] },
        realmId: EURTH,
      });
      expect(db.mapLayer.updateMany).toHaveBeenCalledTimes(1);
      expect(db.mapLayer.updateMany.mock.calls[0][0].where.featureId).toBe("Ostai");
    });
  });
});
