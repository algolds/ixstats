/** @jest-environment node */
/**
 * One helper says "this realm's map changed": invalidateRealmMap (invalidateAllRealmMaps when a write cannot name its
 * realm). It clears that realm's server layer caches and the cached map reads, moves Realm.mapVersion and drops the
 * memoised version, so the next client fetch uses new versioned URLs. Every path that writes a realm's map calls it
 * with that realm's id (Atlas Release 0, Review Focus 2), also when the work after the stored write fails, and a
 * country save or a roster import moves the version only when the political layer reads what changed. One row per
 * writer family, run through its router or module with the database mocked and the helper replaced; the helper's
 * own tests use the real one.
 *
 * Folds: src/tests/server/shared/map-invalidation.test.ts,
 * src/tests/server/api/routers/admin-roster-import-map-version.test.ts
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
  invalidateAllRealmMaps: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  syncCountryGeometryFromMapLayer: jest.fn().mockResolvedValue(undefined),
  upsertCity: jest.fn().mockResolvedValue({}),
  lookupCityPoints: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual("~/lib/maps/geo-validation"),
  validateGeometryValid: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/adjacency", () => ({
  rebuildAdjacency: jest.fn().mockResolvedValue({ skipped: false, pairs: 2 }),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/server/shared/intelligence-alert-thresholds", () => ({
  evaluateThresholds: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/modules/realms/realms.map", () => ({
  ...jest.requireActual("~/server/modules/realms/realms.map"),
  recomputeRealmMapAreas: jest.fn().mockResolvedValue({ updated: 1 }),
}));
jest.mock("~/lib/admin/roster-parser", () => ({ parseRosterFile: jest.fn() }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { geoEditorQueueRouter } from "~/server/api/routers/geo/editor/queue";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { geoAdminCitiesRouter } from "~/server/api/routers/geo/admin/cities";
import { geoAdminProvincesRouter } from "~/server/api/routers/geo/admin/provinces";
import { geoSovereigntyRouter } from "~/server/api/routers/geo/sovereignty";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { adminOpsProcedures } from "~/server/api/routers/geo/core/admin-ops";
import { managementLifecycleProcedures } from "~/server/api/routers/countries/management/lifecycle";
import { adminCountriesImportRouter } from "~/server/api/routers/admin/countries/import";
import { parseRosterFile } from "~/lib/admin/roster-parser";
import { invalidateCache } from "~/lib/cache";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { refreshRealmMap } from "~/server/modules/maps/map-import.apply";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { layerCache, layerInflight, clearLayerCache } from "~/server/shared/layer-cache";
import {
  MAP_TRPC_KEYS,
  invalidateAllRealmMaps,
  invalidateRealmMap,
} from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const EURTH = "r_eurth";
const ADMIN = "clerk_admin";

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock>;

const REALMS: Record<string, { id: string; slug: string; ownerId: string; status: string }> = {
  eurth: { id: EURTH, slug: "eurth", ownerId: "clerk_founder", status: "active" },
  ixnay: { id: DEFAULT_REALM_ID, slug: "ixnay", ownerId: "system", status: "active" },
};

function modelMock(): ModelMock {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "created" }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({ id: "session", sessionData: {} }),
  };
}

/** Every model answers empty; `$transaction(fn)` runs fn against the same db; raw SQL returns no rows. */
function realmDb(): Db {
  const models = new Map<string, ModelMock>();
  const raw = {
    $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
  const db: Db = new Proxy({} as Db, {
    get: (_target, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
      if (key in raw) return raw[key as keyof typeof raw];
      if (!models.has(key)) models.set(key, modelMock());
      return models.get(key);
    },
  });
  db.realm!.findUnique!.mockImplementation(
    async ({ where }: { where: { slug?: string; id?: string } }) => {
      const realm = where.slug
        ? REALMS[where.slug]
        : Object.values(REALMS).find((r) => r.id === where.id);
      return realm ? { ...realm, officers: [] } : null;
    }
  );
  return db;
}

function ctxAs(db: Db) {
  return createMockRouterContext({
    db,
    auth: { userId: ADMIN },
    user: {
      id: `db_${ADMIN}`,
      clerkUserId: ADMIN,
      role: { name: "admin", level: 10 },
      country: null,
    },
    rateLimitIdentifier: `${ADMIN}_${Math.random()}`,
  }) as never;
}

const rect = (x0: number, x1: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x0, 0],
      [x1, 0],
      [x1, 1],
      [x0, 1],
      [x0, 0],
    ],
  ],
});

/** A political feature of Eurth's, linked to c1, as the editor routers read it. */
function withFeature(db: Db) {
  db.mapLayer!.findFirst!.mockResolvedValue({
    id: "ml1",
    featureId: "F",
    displayName: "Old name",
    countryId: "c1",
    areaSqKm: 10,
    geometry: rect(0, 3),
    realmId: EURTH,
  });
  db.country!.findUnique!.mockResolvedValue({ name: "Nation", realmId: EURTH });
}

/** A pending border edit of feature ml1, filed on `realmId` (null: a legacy layer, Ixnay's). */
function withBorderEdit(db: Db, realmId: string | null) {
  db.mapEditRequest!.findUnique!.mockResolvedValue({
    id: "req1",
    status: "pending",
    editType: "border_adjust",
    operation: "update",
    countryId: "c1",
    realmId,
    targetId: "ml1",
    proposedData: { geometry: rect(0, 2) },
  });
  db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", areaSqKm: null, realmId });
}

interface WritePath {
  name: string;
  /** The realm the version moves for. */
  realm: string;
  /** The path also announces its change on the live-sync stream, naming the realm. */
  announces?: boolean;
  /** The row is its router family's check that the version moves when the Country sync after the write throws. */
  syncFails?: boolean;
  run: (db: Db) => Promise<unknown>;
}

/** One row per writer family (sibling procedures of a family make the same helper call after their write). */
const WRITE_PATHS: WritePath[] = [
  {
    name: "border save (direct apply)",
    announces: true,
    realm: EURTH,
    syncFails: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorBordersRouter)(ctxAs(db)).submitBorderEdit({
        featureId: "F",
        editSubtype: "vertex_edit",
        proposedGeometry: rect(0, 2),
        applyDirectly: true,
        realm: "eurth",
      });
    },
  },
  {
    name: "approved border edit (queue)",
    realm: EURTH,
    syncFails: true,
    run: (db) => {
      withBorderEdit(db, EURTH);
      return createCallerFactory(geoEditorQueueRouter)(ctxAs(db)).approveEdit({ editId: "req1" });
    },
  },
  {
    name: "approved border edit on a legacy NULL-realm layer (Ixnay)",
    realm: DEFAULT_REALM_ID,
    run: (db) => {
      withBorderEdit(db, null);
      return createCallerFactory(geoEditorQueueRouter)(ctxAs(db)).approveEdit({ editId: "req1" });
    },
  },
  {
    name: "link a region to a nation",
    announces: true,
    realm: EURTH,
    syncFails: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorLinkageAssignmentRouter)(ctxAs(db)).assignCountryGeometry(
        {
          featureId: "F",
          countryId: "c1",
          realm: "eurth",
        }
      );
    },
  },
  {
    name: "linkage repair (link by name)",
    realm: EURTH,
    syncFails: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorLinkageValidationRouter)(ctxAs(db)).repairLinkage({
        action: "link_by_name",
        featureId: "F",
        countryId: "c1",
        realm: "eurth",
      });
    },
  },
  {
    name: "city import commit",
    announces: true,
    realm: EURTH,
    run: (db) => {
      db.country!.findUnique!.mockResolvedValue({ id: "c1", realmId: EURTH });
      return createCallerFactory(geoAdminCitiesRouter)(ctxAs(db)).commitCityImport({
        countryId: "c1",
        cities: [],
      });
    },
  },
  {
    name: "province commit",
    announces: true,
    realm: EURTH,
    run: (db) => {
      db.country!.findUnique!.mockResolvedValue({ realmId: EURTH });
      return createCallerFactory(geoAdminProvincesRouter)(ctxAs(db)).commitProvinceImport({
        countryId: "c1",
        provinces: [],
      });
    },
  },
  {
    name: "sovereignty update",
    realm: EURTH,
    run: (db) => {
      db.countrySovereignty!.update!.mockResolvedValue({
        id: "s1",
        sovereignId: "c1",
        subjectId: "c2",
      });
      db.country!.findMany!.mockResolvedValue([{ realmId: EURTH }, { realmId: EURTH }]);
      return createCallerFactory(geoSovereigntyRouter)(ctxAs(db)).updateSovereignty({
        id: "s1",
        autonomyLevel: 0.3,
      });
    },
  },
  {
    name: "recompute areas",
    announces: true,
    realm: EURTH,
    run: (db) => createCallerFactory(realmMapRouter)(ctxAs(db)).recomputeAreas({ realm: "eurth" }),
  },
  {
    name: "recalculate one region's area",
    realm: EURTH,
    run: (db) => {
      withFeature(db);
      db.$queryRawUnsafe!.mockResolvedValue([{ area_sqkm: 12 }]);
      return createCallerFactory(
        createTRPCRouter({ recalculateArea: adminOpsProcedures.recalculateArea })
      )(ctxAs(db)).recalculateArea({ featureId: "F", realm: "eurth" });
    },
  },
  {
    name: "import apply, rollback, pipeline import and repair (refreshRealmMap)",
    announces: true,
    realm: EURTH,
    run: (db) => refreshRealmMap(db as never, EURTH),
  },
];

/** The realm each invalidateRealmMap call named, and whether it was handed the write's own db. */
const bumps = (db: Db) =>
  jest
    .mocked(invalidateRealmMap)
    .mock.calls.map(([passed, realmId]) => [passed === (db as never), realmId]);

beforeEach(() => jest.clearAllMocks());

describe("every map write path bumps its realm's map version", () => {
  it.each(WRITE_PATHS)("$name", async ({ run, realm, announces }) => {
    const db = realmDb();
    await run(db);

    expect(bumps(db)).toEqual([[true, realm]]);
    expect(invalidateAllRealmMaps).not.toHaveBeenCalled();
    // A path that announces its change on the live-sync stream names the realm it happened in
    if (announces) {
      const announced = jest.mocked(broadcastMapUpdate).mock.calls.map(([, , named]) => named);
      expect(announced.length).toBeGreaterThan(0);
      expect(announced.filter((named) => named !== realm)).toStrictEqual([]);
    }
  });
});

describe("the map version moves even when the work after the stored write fails", () => {
  // The failures are the point; the audit middleware logs each one
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(WRITE_PATHS.filter((path) => path.syncFails))(
    "$name, when the Country sync throws",
    async ({ run, realm }) => {
      const db = realmDb();
      jest.mocked(syncCountryGeometryFromMapLayer).mockRejectedValueOnce(new Error("union failed"));
      await expect(run(db)).rejects.toThrow("union failed");

      expect(syncCountryGeometryFromMapLayer).toHaveBeenCalled();
      expect(bumps(db)).toEqual([[true, realm]]);
    }
  );

  it("a rejected request that wrote nothing does not bump", async () => {
    const db = realmDb();
    await expect(
      createCallerFactory(geoEditorLinkageAssignmentRouter)(ctxAs(db)).assignCountryGeometry({
        featureId: "missing",
        countryId: "c1",
        realm: "eurth",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });
});

describe("a write that cannot name its realm bumps them all", () => {
  it("sovereignty change whose countries are gone", async () => {
    const db = realmDb();
    db.countrySovereignty!.delete!.mockResolvedValue(null);
    await createCallerFactory(geoSovereigntyRouter)(ctxAs(db)).deleteSovereignty({ id: "s1" });
    expect(invalidateRealmMap).not.toHaveBeenCalled();
    expect(invalidateAllRealmMaps).toHaveBeenCalledTimes(1);
  });
});

describe("a country save moves the map only when the political layer reads what changed", () => {
  function save(db: Db, updates: Record<string, string>) {
    db.country!.findUnique!.mockResolvedValue({
      realmId: EURTH,
      name: "Old",
      continent: "Aurelia",
      region: "North",
    });
    db.country!.update!.mockImplementation(async ({ data }: { data: object }) => ({
      id: "c1",
      realmId: EURTH,
      name: "Old",
      continent: "Aurelia",
      region: "North",
      ...data,
    }));
    return createCallerFactory(createTRPCRouter(managementLifecycleProcedures))(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_owner" },
        user: { id: "u1", clerkUserId: "clerk_owner", countryId: "c1", role: { name: "user" } },
        rateLimitIdentifier: `owner_${Math.random()}`,
      }) as never
    ).update({ id: "c1", ...updates });
  }

  it.each([
    ["a column the political layer does not read (a flag)", { flag: "f.svg" }, false],
    ["a column it reads set to the same value (the name)", { name: "Old" }, false],
    ["a new name", { name: "New" }, true],
  ])("%s: moves it %s", async (_what, updates, moves) => {
    const db = realmDb();
    await save(db, updates);
    expect(bumps(db)).toEqual(moves ? [[true, EURTH]] : []);
  });
});

describe("a roster import moves Ixnay's map only when a replaced nation's continent or region changed", () => {
  const EXISTING = {
    id: "c_gal",
    name: "Gallambria",
    continent: "Aurelia",
    region: "North",
    realmId: DEFAULT_REALM_ID,
    baselinePopulation: 1_000_000,
    baselineGdpPerCapita: 10_000,
    currentPopulation: 1_000_000,
    currentGdpPerCapita: 10_000,
  };

  it.each([
    ["a replaced nation with a new continent", { continent: "Boreas" }, true, true],
    [
      "a replaced nation with the same name, continent and region",
      { population: 2_000_000 },
      true,
      false,
    ],
    [
      "an update that only changes figures",
      { continent: "Boreas", population: 2_000_000 },
      false,
      false,
    ],
  ])("%s", async (_name, change, replaceExisting, moves) => {
    jest.mocked(parseRosterFile).mockResolvedValue([
      {
        country: "Gallambria",
        continent: "Aurelia",
        region: "North",
        population: 1_000_000,
        gdpPerCapita: 10_000,
        ...change,
      },
    ] as never);
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([EXISTING]);
    db.country.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...EXISTING,
      ...data,
    }));
    const caller = createCallerFactory(adminCountriesImportRouter)(
      createMockRouterContext({
        db,
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      }) as never
    );
    await expect(
      caller.importRosterData({
        analysisId: "a",
        replaceExisting,
        fileData: [1],
        fileName: "r.csv",
      })
    ).resolves.toMatchObject({ success: true, updated: 1, errors: [] });
    expect(
      jest
        .mocked(invalidateRealmMap)
        .mock.calls.map(([passed, realmId]) => [passed === (db as never), realmId])
    ).toEqual(moves ? [[true, DEFAULT_REALM_ID]] : []);
  });
});

describe("invalidateRealmMap and getRealmMapVersion themselves", () => {
  const real = jest.requireActual<typeof import("~/server/shared/map-invalidation")>(
    "~/server/shared/map-invalidation"
  );
  const fc = { type: "FeatureCollection" as const, features: [] };
  const entry = () => ({ data: fc, timestamp: Date.now() });

  function versionDb(version = 4) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: version }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      realm: { findUnique: jest.fn().mockResolvedValue({ mapVersion: version }) },
    };
  }

  beforeEach(() => {
    clearLayerCache();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("clears only that realm's layer caches, in-flight builds included, and never a realm whose id merely ends the same way", async () => {
    for (const key of [
      "political:z0:r1",
      "country_labels:z1:r1",
      "rivers:z2:r1",
      "political:z0:r2",
      "political:z0:default",
      "political:z0:xr1",
    ])
      layerCache.set(key, entry());
    layerInflight.set("political:z1:r1", Promise.resolve(null));
    layerInflight.set("political:z1:r2", Promise.resolve(null));

    await real.invalidateRealmMap(versionDb(), "r1");

    expect([...layerCache.keys()].sort()).toEqual([
      "political:z0:default",
      "political:z0:r2",
      "political:z0:xr1",
    ]);
    expect([...layerInflight.keys()]).toEqual(["political:z1:r2"]);
  });

  it("for every realm: clears every realm's caches, cached map reads and memoised versions, and moves every version", async () => {
    layerCache.set("political:z0:r1", entry());
    layerCache.set("political:z0:r2", entry());
    const db = versionDb(1);
    await real.getRealmMapVersion(db, "memo-d");
    const hook = jest.fn();
    const off = real.onMapInvalidated(hook);

    await real.invalidateAllRealmMaps(db);
    off();

    expect(layerCache.size).toBe(0);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(invalidateCache).toHaveBeenCalledWith(MAP_TRPC_KEYS);
    expect(hook).toHaveBeenCalledWith(null);
    await real.getRealmMapVersion(db, "memo-d");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("still clears the caches when the version write fails, reports the failure, and announces nothing", async () => {
    const db = versionDb();
    db.$queryRaw.mockRejectedValue(new Error("db down"));
    layerCache.set("political:z0:r1", entry());

    await expect(real.invalidateRealmMap(db, "r1")).rejects.toThrow("db down");

    expect(layerCache.has("political:z0:r1")).toBe(false);
    expect(broadcastMapUpdate).not.toHaveBeenCalled();
  });

  it("drops the memoised version on a bump, so the next read sees the new version", async () => {
    const db = versionDb(5);
    expect(await real.getRealmMapVersion(db, "memo-c")).toBe(5);
    db.$queryRaw.mockResolvedValue([{ mapVersion: 6 }]);
    db.realm.findUnique.mockResolvedValue({ mapVersion: 6 });

    await real.invalidateRealmMap(db, "memo-c");

    expect(await real.getRealmMapVersion(db, "memo-c")).toBe(6);
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("does not memoise a read that a bump overtook", async () => {
    const db = versionDb(1);
    let release: (row: { mapVersion: number }) => void = () => undefined;
    db.realm.findUnique.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const stale = real.getRealmMapVersion(db, "memo-e");
    await real.invalidateRealmMap(db, "memo-e");
    release({ mapVersion: 1 });
    expect(await stale).toBe(1);

    db.realm.findUnique.mockResolvedValue({ mapVersion: 2 });
    expect(await real.getRealmMapVersion(db, "memo-e")).toBe(2);
  });
});
