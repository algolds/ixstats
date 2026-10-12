/** @jest-environment node */
/**
 * Every path that writes a realm's map calls invalidateRealmMap with that realm's id, so the next client fetch
 * uses new versioned URLs (Atlas Release 0, Review Focus 2). One row per write path, run through its router or
 * module with the database mocked; the helper itself is covered by map-invalidation.test.ts.
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
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { refreshRealmMap } from "~/server/modules/maps/map-import.apply";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { invalidateAllRealmMaps, invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";

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

interface WritePath {
  name: string;
  /** The realm the version moves for. */
  realm: string;
  /** The path syncs a Country's cached outline after storing the layer (so that sync can fail after the write). */
  syncs?: boolean;
  /** The path also announces its change on the live-sync stream, naming the realm. */
  announces?: boolean;
  run: (db: Db) => Promise<unknown>;
}

const WRITE_PATHS: WritePath[] = [
  {
    name: "border save (direct apply)",
    announces: true,
    realm: EURTH,
    syncs: true,
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
    name: "split",
    announces: true,
    realm: EURTH,
    syncs: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorBordersRouter)(ctxAs(db)).splitCountry({
        featureId: "F",
        splitLine: [
          [1, -1],
          [1, 2],
        ],
        nameA: "West",
        nameB: "East",
        realm: "eurth",
      });
    },
  },
  {
    name: "merge",
    announces: true,
    realm: EURTH,
    syncs: true,
    run: (db) => {
      db.mapLayer!.findMany!.mockResolvedValue([
        { id: "m1", featureId: "A", countryId: "c1", areaSqKm: 10, geometry: rect(0, 1) },
        { id: "m2", featureId: "B", countryId: "c2", areaSqKm: 30, geometry: rect(1, 2) },
      ]);
      return createCallerFactory(geoEditorBordersRouter)(ctxAs(db)).mergeCountries({
        featureIds: ["A", "B"],
        newName: "Union",
        realm: "eurth",
      });
    },
  },
  {
    name: "approved border edit (queue)",
    realm: EURTH,
    syncs: true,
    run: (db) => {
      db.mapEditRequest!.findUnique!.mockResolvedValue({
        id: "req1",
        status: "pending",
        editType: "border_adjust",
        operation: "update",
        countryId: "c1",
        realmId: EURTH,
        targetId: "ml1",
        proposedData: { geometry: rect(0, 2) },
      });
      db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", areaSqKm: null, realmId: EURTH });
      return createCallerFactory(geoEditorQueueRouter)(ctxAs(db)).approveEdit({ editId: "req1" });
    },
  },
  {
    name: "approved border edit on a legacy NULL-realm layer (Ixnay)",
    realm: DEFAULT_REALM_ID,
    syncs: true,
    run: (db) => {
      db.mapEditRequest!.findUnique!.mockResolvedValue({
        id: "req1",
        status: "pending",
        editType: "border_adjust",
        operation: "update",
        countryId: "c1",
        realmId: null,
        targetId: "ml1",
        proposedData: { geometry: rect(0, 2) },
      });
      db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", areaSqKm: null, realmId: null });
      return createCallerFactory(geoEditorQueueRouter)(ctxAs(db)).approveEdit({ editId: "req1" });
    },
  },
  {
    name: "region rename (feature properties)",
    realm: EURTH,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorLinkageAssignmentRouter)(
        ctxAs(db)
      ).updateFeatureProperties({
        featureId: "F",
        displayName: "New name",
        realm: "eurth",
      });
    },
  },
  {
    name: "region relinked (feature properties)",
    announces: true,
    realm: EURTH,
    syncs: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorLinkageAssignmentRouter)(
        ctxAs(db)
      ).updateFeatureProperties({
        featureId: "F",
        countryId: "c1",
        realm: "eurth",
      });
    },
  },
  {
    name: "nation created from a region",
    announces: true,
    realm: EURTH,
    syncs: true,
    run: (db) => {
      withFeature(db);
      db.mapLayer!.findFirst!.mockResolvedValue({
        id: "ml1",
        featureId: "F",
        countryId: null,
        areaSqKm: 10,
        geometry: rect(0, 3),
        realmId: EURTH,
      });
      db.country!.create!.mockResolvedValue({ id: "c_new", name: "Newland" });
      return createCallerFactory(geoEditorLinkageAssignmentRouter)(
        ctxAs(db)
      ).createCountryFromShape({
        featureId: "F",
        name: "Newland",
        realm: "eurth",
      });
    },
  },
  {
    name: "link a region to a nation",
    announces: true,
    realm: EURTH,
    syncs: true,
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
    name: "unlink a region from its nation",
    announces: true,
    realm: EURTH,
    syncs: true,
    run: (db) => {
      withFeature(db);
      return createCallerFactory(geoEditorLinkageAssignmentRouter)(ctxAs(db)).unlinkCountryGeometry(
        {
          featureId: "F",
          realm: "eurth",
        }
      );
    },
  },
  {
    name: "linkage repair (link by name)",
    realm: EURTH,
    syncs: true,
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
    name: "linkage repair (sync all)",
    realm: EURTH,
    run: (db) =>
      createCallerFactory(geoEditorLinkageValidationRouter)(ctxAs(db)).repairLinkage({
        action: "sync_all",
        realm: "eurth",
      }),
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
    name: "country rename",
    realm: EURTH,
    run: (db) => {
      db.country!.findUnique!.mockResolvedValue({
        realmId: EURTH,
        name: "Old",
        continent: null,
        region: null,
      });
      db.country!.update!.mockResolvedValue({
        id: "c1",
        realmId: EURTH,
        name: "New",
        continent: null,
        region: null,
      });
      return createCallerFactory(createTRPCRouter(managementLifecycleProcedures))(
        createMockRouterContext({
          db,
          auth: { userId: "clerk_owner" },
          user: { id: "u1", clerkUserId: "clerk_owner", countryId: "c1", role: { name: "user" } },
          rateLimitIdentifier: `owner_${Math.random()}`,
        }) as never
      ).update({ id: "c1", name: "New" });
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

beforeEach(() => jest.clearAllMocks());

describe("every map write path bumps its realm's map version", () => {
  it.each(WRITE_PATHS)("$name", async ({ run, realm }) => {
    const db = realmDb();
    await run(db);

    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    const [passedDb, realmId] = jest.mocked(invalidateRealmMap).mock.calls[0]!;
    expect(realmId).toBe(realm);
    expect(passedDb === (db as never)).toBe(true);
    expect(invalidateAllRealmMaps).not.toHaveBeenCalled();
  });
});

describe("the live-sync event names the realm the change happened in", () => {
  it.each(WRITE_PATHS.filter((path) => path.announces))("$name", async ({ run, realm }) => {
    await run(realmDb());

    const announced = jest.mocked(broadcastMapUpdate).mock.calls;
    expect(announced.length).toBeGreaterThan(0);
    for (const [, , announcedRealm] of announced) expect(announcedRealm).toBe(realm);
  });
});

describe("the map version moves even when the work after the stored write fails", () => {
  const SYNCING = WRITE_PATHS.filter((path) => path.syncs);

  // The failures are the point; the audit middleware logs each one
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(SYNCING)("$name, when the Country sync throws", async ({ run, realm }) => {
    const db = realmDb();
    jest.mocked(syncCountryGeometryFromMapLayer).mockRejectedValueOnce(new Error("union failed"));
    await expect(run(db)).rejects.toThrow("union failed");

    expect(syncCountryGeometryFromMapLayer).toHaveBeenCalled();
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(jest.mocked(invalidateRealmMap).mock.calls[0]![1]).toBe(realm);
  });

  it("an approved border edit whose history write fails still bumps", async () => {
    const db = realmDb();
    db.mapEditRequest!.findUnique!.mockResolvedValue({
      id: "req1",
      status: "pending",
      editType: "border_adjust",
      operation: "update",
      countryId: "c1",
      realmId: EURTH,
      targetId: "ml1",
      proposedData: { geometry: rect(0, 2) },
    });
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", areaSqKm: 5, realmId: EURTH });
    db.$queryRawUnsafe!.mockResolvedValue([{ area_sq_km: 7 }]);
    db.borderHistory!.create!.mockRejectedValue(new Error("history down"));
    await expect(
      createCallerFactory(geoEditorQueueRouter)(ctxAs(db)).approveEdit({ editId: "req1" })
    ).rejects.toThrow("history down");
    expect(jest.mocked(invalidateRealmMap).mock.calls.map((call) => call[1])).toEqual([EURTH]);
  });

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
    ["a flag", { flag: "f.svg" }],
    ["a leader", { leader: "Queen" }],
    ["the name set to the same value", { name: "Old" }],
    ["the continent set to the same value", { continent: "Aurelia" }],
  ])("%s does not", async (_what, updates) => {
    await save(realmDb(), updates);
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });

  it.each([
    ["continent", { continent: "Boreas" }],
    ["region", { region: "South" }],
    ["name", { name: "New" }],
  ])("a new %s does", async (_what, updates) => {
    await save(realmDb(), updates);
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(jest.mocked(invalidateRealmMap).mock.calls[0]![1]).toBe(EURTH);
  });
});
