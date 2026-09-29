/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("fs/promises", () => ({ readFile: jest.fn() }));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual("~/lib/maps/geo-validation"),
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));

import { readFile } from "fs/promises";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { clearLayerCache, layerCache } from "~/server/shared/layer-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
import { discoveryProcedures } from "~/server/api/routers/geo/core/discovery";
import { statsProcedures } from "~/server/api/routers/geo/core/stats";
import { countryProcedures } from "~/server/api/routers/geo/core/country";
import { pointQueryProcedures } from "~/server/api/routers/geo/core/point-queries";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";
import { geoFeaturesLabelsRouter } from "~/server/api/routers/geo/features/labels";
import { geoFeaturesStoryPinsRouter } from "~/server/api/routers/geo/features/storyPins";
import { transportRouteQueriesRouter } from "~/server/api/routers/transport/routeQueries";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { geoEditorProceduralRouter } from "~/server/api/routers/geo/editor/procedural";
import { geoAdminCommitsRouter } from "~/server/api/routers/geo/admin/commits";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

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
  // ?realm=eurth resolves to the Eurth realm id
  db.realm!.findUnique!.mockImplementation(
    async (args: { where: { slug?: string } }) =>
      ({ eurth: { id: EURTH }, ixworld: { id: DEFAULT_REALM_ID } })[args.where.slug ?? ""] ?? null
  );
  return db;
}

function eurthViewer() {
  return { id: "u1", clerkUserId: "clerk_u1", countryId: "c_eu", country: { id: "c_eu", realmId: EURTH } };
}

function ctxFor(db: Db, user: ReturnType<typeof eurthViewer> | null) {
  return { db, user, auth: null, rateLimitIdentifier: "test", headers: new Headers() } as never;
}

function adminCtx(db: Db) {
  return createMockRouterContext({
    db,
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 }, country: null },
  }) as never;
}

function wheres(db: Db, model: string, method = "findMany") {
  return db[model]![method]!.mock.calls.map((c: [{ where?: Record<string, unknown> }]) => c[0]?.where);
}

/** A where names the realm directly (map layers, routes) or through its country (cities, labels…). */
function realmOf(where: Record<string, unknown> | undefined): unknown {
  return where?.realmId ?? (where?.country as { realmId?: unknown } | undefined)?.realmId;
}

const geo = createTRPCRouter({
  ...worldMapProcedures,
  ...borderHistoryProcedures,
  ...discoveryProcedures,
  ...statsProcedures,
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
  it("an Eurth viewer's world map reads Eurth layers and never IxWorld's static files", async () => {
    const db = emptyDb();
    const map = await geoCaller(ctxFor(db, eurthViewer())).getWorldMap({
      layers: ["background", "political"],
    });

    expect(wheres(db, "mapLayer").map(realmOf)).toEqual([EURTH, EURTH]);
    expect(map).toEqual({
      background: { type: "FeatureCollection", features: [] },
      political: { type: "FeatureCollection", features: [] },
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("?realm= picks the realm over the viewer's active nation", async () => {
    const db = emptyDb();
    (readFile as unknown as jest.Mock).mockRejectedValue(new Error("ENOENT"));
    await geoCaller(ctxFor(db, eurthViewer())).getWorldMap({ layers: ["lakes"], realm: "ixworld" });

    expect(wheres(db, "mapLayer").map(realmOf)).toEqual([DEFAULT_REALM_ID]);
  });

  it("the map bundle's cities, POIs, subdivisions and capitals belong to the realm's countries", async () => {
    const db = emptyDb();
    await geoCaller(ctxFor(db, eurthViewer())).getMapBundle({ layers: ["political"] });

    expect([...wheres(db, "city"), ...wheres(db, "pointOfInterest"), ...wheres(db, "subdivision")].map(realmOf)).toEqual([
      EURTH,
      EURTH,
      EURTH,
      EURTH,
    ]);
  });

  const listings: Array<[string, string[], (db: Db) => Promise<unknown>]> = [
    ["geoCore.getWorldMapAsOf", ["mapLayer"], (db) => geoCaller(ctxFor(db, eurthViewer())).getWorldMapAsOf({ ixTime: 0 })],
    ["geoCore.listCountries", ["mapLayer"], (db) => geoCaller(ctxFor(db, eurthViewer())).listCountries()],
    [
      "geoCore.searchFeatures",
      ["mapLayer", "city", "subdivision"],
      (db) => geoCaller(ctxFor(db, eurthViewer())).searchFeatures({ query: "ga" }),
    ],
    ["geoCore.getAllMapFeatures", ["city", "pointOfInterest", "subdivision"], (db) => geoCaller(ctxFor(db, eurthViewer())).getAllMapFeatures()],
    ["geoCore.getCapitalCities", ["city"], (db) => geoCaller(ctxFor(db, eurthViewer())).getCapitalCities()],
    [
      "geoFeatures.getAllMapLabels",
      ["mapLabel"],
      (db) => createCallerFactory(geoFeaturesLabelsRouter)(ctxFor(db, eurthViewer())).getAllMapLabels(),
    ],
    [
      "geoFeatures.getAllStoryPins",
      ["storyPin"],
      (db) => createCallerFactory(geoFeaturesStoryPinsRouter)(ctxFor(db, eurthViewer())).getAllStoryPins(),
    ],
    [
      "transport.getAllRoutesGeoJSON",
      ["transportRoute"],
      (db) => createCallerFactory(transportRouteQueriesRouter)(ctxFor(db, eurthViewer())).getAllRoutesGeoJSON(),
    ],
  ];

  it.each(listings)("%s lists the viewer's realm only", async (_name, models, call) => {
    const db = emptyDb();
    await call(db);

    const seen = models.flatMap((m) => wheres(db, m));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.map(realmOf)).toEqual(seen.map(() => EURTH));
  });

  it("layer counts (getLayerInfo, getMapStats) count the realm's features, like its country counts", async () => {
    const db = emptyDb();
    const caller = geoCaller(ctxFor(db, eurthViewer()));
    await caller.getLayerInfo();
    await caller.getMapStats();

    const layerWheres = [...wheres(db, "mapLayer", "groupBy"), ...wheres(db, "mapLayer", "count")];
    expect(layerWheres).toHaveLength(5);
    expect(layerWheres.map(realmOf)).toEqual(layerWheres.map(() => EURTH));
    expect(wheres(db, "country", "count").map(realmOf)).toEqual([EURTH, EURTH]);
  });

  it("a feature-id or name lookup is scoped to the realm; a country-id lookup is not", async () => {
    const db = emptyDb();
    const caller = geoCaller(ctxFor(db, eurthViewer()));
    for (const input of [{ featureId: "Gallambria" }, { countryName: "Gallambria" }, { countryId: "c_eu" }]) {
      await caller.getCountryGeometry(input).catch(() => undefined);
    }

    expect(wheres(db, "mapLayer", "findFirst").map(realmOf)).toEqual([EURTH, EURTH, undefined]);
  });

  it("the pin tool asks PostGIS for the realm's layers at the point", async () => {
    const db = emptyDb();
    await geoCaller(ctxFor(db, eurthViewer())).getPointInfo({ lng: 1, lat: 2 });

    const [sql, ...params] = db.$queryRawUnsafe!.mock.calls[0];
    expect(sql).toContain(`"worldId" = $3`);
    expect(params).toEqual([1, 2, EURTH]);
  });
});

describe("a country's geo profile uses its own realm's base layers", () => {
  it("an Eurth country is profiled against Eurth's climate, altitude, river and lake layers", async () => {
    const db = emptyDb();
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

    expect(wheres(db, "mapLayer").slice(0, 2).map(realmOf)).toEqual([EURTH, EURTH]);
    const hydroSql = db.$queryRawUnsafe!.mock.calls.slice(0, 2).map((c: [string]) => c[0]);
    for (const sql of hydroSql) expect(sql).toContain(`ml."worldId" = c."realmId"`);
  });
});

describe("the world editor works inside the realm it edits (ruling E-o)", () => {
  it("linkage validation compares the edited realm's features with the edited realm's nations", async () => {
    const db = emptyDb();
    await createCallerFactory(geoEditorLinkageValidationRouter)(adminCtx(db)).validateLinkage({ realm: "eurth" });

    expect(wheres(db, "mapLayer").map(realmOf)).toEqual([EURTH]);
    expect(wheres(db, "country").map(realmOf)).toEqual([EURTH]);
  });

  it("auto-match links only the edited realm's unlinked features to its own nations", async () => {
    const db = emptyDb();
    await createCallerFactory(geoEditorLinkageValidationRouter)(adminCtx(db)).repairLinkage({
      action: "auto_match",
      realm: "eurth",
    });

    expect(realmOf(wheres(db, "mapLayer")[0])).toBe(EURTH);
    expect(realmOf(wheres(db, "country")[0])).toBe(EURTH);
  });

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

  it("the border editor loads the feature and its neighbours from the edited realm", async () => {
    const db = emptyDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", featureId: "F", boundingBox: [0, 0, 1, 1] });
    await createCallerFactory(geoEditorBordersRouter)(adminCtx(db)).startBorderEditSession({
      featureId: "F",
      realm: "eurth",
    });

    expect(realmOf(wheres(db, "mapLayer", "findFirst")[0])).toBe(EURTH);
    expect(realmOf(wheres(db, "mapLayer")[0])).toBe(EURTH);
  });

  it("rebuilding adjacency pairs and updates the given realm's features only", async () => {
    const db = emptyDb();
    db.$queryRawUnsafe!.mockResolvedValue([{ a: "A", b: "B" }]);
    await createCallerFactory(geoEditorBordersRouter)(adminCtx(db)).rebuildAdjacency({ realmId: EURTH });

    const [sql, realmParam] = db.$queryRawUnsafe!.mock.calls[0];
    expect(sql).toContain(`a."worldId" = $1 AND b."worldId" = $1`);
    expect(realmParam).toBe(EURTH);
    expect(wheres(db, "mapLayer", "updateMany").map(realmOf)).toEqual([EURTH, EURTH]);
  });
});

describe("imports and SVG commits never touch another realm's layers", () => {
  it("an SVG commit (IxWorld's Quick Update) replaces IxWorld's layer, matching IxWorld nations only", async () => {
    const db = emptyDb();
    db.svgUpload!.findUnique!.mockResolvedValue({
      id: "up1",
      status: "processed",
      layerType: "political",
      svgMetadata: {},
      geojsonData: {
        type: "FeatureCollection",
        features: [{ type: "Feature", id: "X", properties: { name: "X" }, geometry: { type: "Point", coordinates: [0, 0] } }],
      },
    });
    await createCallerFactory(geoAdminCommitsRouter)(adminCtx(db)).commitSvgUpload({ uploadId: "up1" });

    expect(wheres(db, "mapLayer", "deleteMany").map(realmOf)).toEqual([DEFAULT_REALM_ID]);
    expect(wheres(db, "mapLayer").map(realmOf)).toEqual([DEFAULT_REALM_ID, DEFAULT_REALM_ID]);
    expect(wheres(db, "country").map(realmOf)).toEqual([DEFAULT_REALM_ID]);
    const created = db.mapLayer!.createMany!.mock.calls[0][0].data as Array<{ realmId: string }>;
    expect(created.map((r) => r.realmId)).toEqual([DEFAULT_REALM_ID]);
  });

  it("a pipeline import drops the assembled-layer cache so the target realm's map rebuilds", async () => {
    const db = emptyDb();
    layerCache.set(`political:z1:${EURTH}`, {
      data: { type: "FeatureCollection", features: [] },
      timestamp: Date.now(),
    });
    await createCallerFactory(geoEditorProceduralRouter)(adminCtx(db)).importPipelineResult({
      layers: { lakes: { type: "FeatureCollection", features: [] } },
      realmId: EURTH,
    });

    expect(layerCache.size).toBe(0);
  });
});
