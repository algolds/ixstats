/** @jest-environment node */
/**
 * Geo router gates: each refusal below is one row (IDOR, permission gates, input bounds), and a refused call writes
 * nothing. A player imports cities only into their own country, with valid coordinates and only inside its border;
 * sovereignty writes are admin only, with no self-sovereignty, no loops and a bounded autonomy, and a reader of one
 * realm never sees another realm's sovereignty rows; storylines and their pins stay in their country, and deleting a
 * storyline keeps its pins; a feature locked with `editableByOwner: false` is refused to its country's owner on
 * every router, topology cascades included; the Atlas studio's realm measures are admin only.
 *
 * `jest` and `expect` are the ambient globals: @swc/jest only hoists jest.mock() on the global, and the imported
 * expect would type toHaveBeenCalledWith by the real functions' parameters.
 *
 * Folds: src/tests/server/api/routers/geo-admin-cities.test.ts, src/tests/server/api/routers/geo-sovereignty.test.ts,
 * src/tests/server/api/routers/geo/storylines.test.ts, src/tests/server/api/routers/geo/map-feature-lock.test.ts,
 * src/tests/server/api/routers/atlas/studio-router.test.ts
 */
jest.mock("~/env", () => ({
  env: { ...jest.requireActual<typeof import("~/env")>("~/env").env, CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual<typeof import("~/lib/cache")>("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ __esModule: true, broadcastMapUpdate: jest.fn() }));
jest.mock("~/server/shared/map-invalidation", () => ({
  __esModule: true,
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
  invalidateAllRealmMaps: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual<typeof import("~/lib/maps/geo-validation")>("~/lib/maps/geo-validation"),
  validatePointContainment: jest.fn().mockResolvedValue(undefined),
  checkNameUniqueness: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  // the city import's batch border lookup is the real one, answered by the mock db's raw SQL
  ...jest.requireActual<typeof import("~/lib/country-geo/spatial")>("~/lib/country-geo/spatial"),
  upsertCity: jest.fn().mockResolvedValue({ id: "new-city", isNationalCapital: false }),
  upsertSubdivision: jest.fn().mockResolvedValue({ id: "new-sub" }),
  upsertPoi: jest.fn(),
}));
jest.mock("~/lib/country-geo/sync", () => ({
  syncGeographicDemographics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/city-importer/svg-points", () => ({
  __esModule: true,
  parseCitySvg: jest.fn().mockReturnValue({ layers: [], points: [] }),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { geoAdminCitiesRouter } from "~/server/api/routers/geo/admin/cities";
import { geoSovereigntyRouter } from "~/server/api/routers/geo/sovereignty";
import { geoFeaturesStorylinesRouter } from "~/server/api/routers/geo/features/storylines";
import { geoFeaturesStoryPinsRouter } from "~/server/api/routers/geo/features/storyPins";
import { geoFeaturesCitiesRouter } from "~/server/api/routers/geo/features/cities";
import { geoFeaturesNamedFeaturesRouter } from "~/server/api/routers/geo/features/namedFeatures";
import { geoFeaturesSubdivisionsCrudRouter } from "~/server/api/routers/geo/features/subdivisions/crud";
import { countryGeoRouter } from "~/server/api/routers/countryGeo";
import { atlasStudioRouter } from "~/server/api/routers/atlas/studio";
import { upsertCity } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext, type MockUser } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { fakeDb as atlasFakeDb, founder } from "~/tests/server/maps/map-import-fakes";

const COUNTRY = { id: "c1", name: "Aurelia", slug: "aurelia", flag: null };
const owner: MockUser = {
  id: "u_owner",
  clerkUserId: "owner_1",
  countryId: "c1",
  role: { name: "user", level: 100 },
  country: COUNTRY,
};
const adminUser: MockUser = {
  id: "u_admin",
  clerkUserId: "admin_1",
  countryId: null,
  role: { name: "admin", level: 10 },
  country: null,
};

function ctx(db: object, user: MockUser) {
  return createMockRouterContext({
    db,
    auth: { userId: user.clerkUserId },
    user,
    rateLimitIdentifier: `${user.clerkUserId}_${Math.random()}`,
  }) as never;
}

beforeEach(() => jest.clearAllMocks());

/** Answers the city import's batch containment query (it reads subdivisions) and its water query, per point. */
function answerBatch(inside: (i: number) => boolean | null = () => true) {
  return jest.fn(async (sql: string, _countryId: string, indexes: number[]) => {
    if (sql.includes("subdivisions")) {
      return indexes.map((i) => ({ i, is_inside: inside(i), subdivisionId: null }));
    }
    return indexes.flatMap((i) => [
      { i, type: "rivers", distance: 1 + i },
      { i, type: "lakes", distance: 50 },
    ]);
  });
}

function importDb() {
  const db = createMockPrisma();
  db.country.findUnique.mockResolvedValue({ id: "c1", realmId: "r_eurth" });
  db.$queryRawUnsafe = answerBatch();
  return db;
}
const importer = (db: MockPrismaProxy) => createCallerFactory(geoAdminCitiesRouter)(ctx(db, owner));

function sovereigntyDb() {
  const db = createMockPrisma();
  db.countrySovereignty.findMany.mockResolvedValue([]);
  db.countrySovereignty.create.mockResolvedValue({ id: "s1", sovereignId: "a", subjectId: "b" });
  db.country.findMany.mockResolvedValue([{ realmId: "r_eurth" }, { realmId: "r_eurth" }]);
  return db;
}
const sovereignty = (db: MockPrismaProxy, user: MockUser = adminUser) =>
  createCallerFactory(geoSovereigntyRouter)(ctx(db, user));

/** Storyline "s1" and pin "p1" belong to c1; any other id is not found for c1. */
function storyDb() {
  const inC1 = (mine: string) => (where: { id: string; countryId?: string }) =>
    where.id === mine && (where.countryId === undefined || where.countryId === "c1")
      ? { id: mine, countryId: "c1" }
      : null;
  return {
    user: {
      findUnique: jest.fn(async () => ({ id: "u_owner", countryId: "c1", role: { name: "user" } })),
    },
    country: { findUnique: jest.fn(async () => ({ id: "c1" })) },
    storyline: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; countryId?: string } }) =>
        inC1("s1")(where)
      ),
      create: jest.fn(async () => ({ id: "s_new", title: "New" })),
      delete: jest.fn(async (_args: object) => ({})),
    },
    storyPin: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; countryId?: string } }) =>
        inC1("p1")(where)
      ),
      aggregate: jest.fn(async () => ({ _max: { storylineOrder: 2 } })),
      update: jest.fn(async () => ({})),
      create: jest.fn(async () => ({ id: "p_new", title: "New" })),
      updateMany: jest.fn(async (_args: object) => ({ count: 1 })),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
}

/** Every feature lookup answers `found`: a feature of c1, locked or not. */
function lockDb(found: object | null) {
  const model = () => ({
    findFirst: jest.fn().mockResolvedValue(found),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockResolvedValue({ id: "f1", name: "Feature", subdivisionId: null }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
  });
  return {
    city: model(),
    subdivision: model(),
    peak: model(),
    namedRiver: model(),
    namedLake: model(),
    $transaction: jest.fn().mockResolvedValue([]),
  };
}
const feature = (editableByOwner: boolean) => ({
  id: "f1",
  countryId: "c1",
  name: "Feature",
  subdivisionId: null,
  isNationalCapital: false,
  coordinates: [0, 0],
  elevation: 100,
  prominence: null,
  wikiPageTitle: null,
  editableByOwner,
});
const locked = { code: "FORBIDDEN", message: expect.stringMatching(/locked/) };
const subdivisions = (db: ReturnType<typeof lockDb>) =>
  createCallerFactory(geoFeaturesSubdivisionsCrudRouter)(ctx(db, owner));

/** A write a refused call must not have made. */
type Write = { mock: { calls: unknown[] } };
type Refusal = { call: Promise<unknown>; writes: Write[] };

describe("refused, and nothing written", () => {
  it.each<{ name: string; refusal: () => Refusal; error: object }>([
    {
      name: "a player imports cities into another country",
      refusal: () => {
        const db = importDb();
        return {
          call: importer(db).commitCityImport({
            countryId: "c_other",
            cities: [{ name: "A", lat: 45, lng: 10 }],
          }),
          writes: [jest.mocked(upsertCity)],
        };
      },
      error: { code: "FORBIDDEN" },
    },
    {
      name: "a city import row at latitude 91",
      refusal: () => {
        const db = importDb();
        return {
          call: importer(db).commitCityImport({
            countryId: "c1",
            cities: [{ name: "Nowhere", lat: 91, lng: 0 }],
          }),
          writes: [jest.mocked(upsertCity)],
        };
      },
      error: { code: "BAD_REQUEST" },
    },
    {
      name: "a player creates a sovereignty relation",
      refusal: () => {
        const db = sovereigntyDb();
        return {
          call: sovereignty(db, owner).createSovereignty({
            sovereignId: "a",
            subjectId: "b",
            relationshipType: "vassal",
          }),
          writes: [db.countrySovereignty.create],
        };
      },
      error: { message: expect.stringMatching(/Admin privileges required/) },
    },
    {
      name: "a country as its own sovereign",
      refusal: () => {
        const db = sovereigntyDb();
        return {
          call: sovereignty(db).createSovereignty({
            sovereignId: "a",
            subjectId: "a",
            relationshipType: "vassal",
          }),
          writes: [db.countrySovereignty.create],
        };
      },
      error: { code: "BAD_REQUEST" },
    },
    {
      name: "a sovereignty that would close a loop (b is already a's subject)",
      refusal: () => {
        const db = sovereigntyDb();
        db.countrySovereignty.findMany.mockResolvedValue([{ sovereignId: "a", subjectId: "b" }]);
        return {
          call: sovereignty(db).createSovereignty({
            sovereignId: "b",
            subjectId: "a",
            relationshipType: "vassal",
          }),
          writes: [db.countrySovereignty.create],
        };
      },
      error: { code: "BAD_REQUEST", message: expect.stringMatching(/circular/) },
    },
    {
      name: "an autonomy level outside 0 to 1",
      refusal: () => {
        const db = sovereigntyDb();
        return {
          call: sovereignty(db).createSovereignty({
            sovereignId: "a",
            subjectId: "b",
            relationshipType: "vassal",
            autonomyLevel: 2,
          }),
          writes: [db.countrySovereignty.create],
        };
      },
      error: { code: "BAD_REQUEST" },
    },
    {
      name: "a storyline in another country",
      refusal: () => {
        const db = storyDb();
        return {
          call: createCallerFactory(geoFeaturesStorylinesRouter)(ctx(db, owner)).createStoryline({
            countryId: "c2",
            title: "Theirs",
          }),
          writes: [db.storyline.create],
        };
      },
      error: { code: "FORBIDDEN" },
    },
    {
      name: "another country's pin added to the owner's storyline",
      refusal: () => {
        const db = storyDb();
        return {
          call: createCallerFactory(geoFeaturesStorylinesRouter)(ctx(db, owner)).addPinToStoryline({
            countryId: "c1",
            storylineId: "s1",
            pinId: "p_other",
          }),
          writes: [db.storyPin.update],
        };
      },
      error: { code: "NOT_FOUND" },
    },
    {
      name: "a story pin put into another country's storyline",
      refusal: () => {
        const db = storyDb();
        return {
          call: createCallerFactory(geoFeaturesStoryPinsRouter)(ctx(db, owner)).createStoryPin({
            countryId: "c1",
            title: "Battle",
            content: "It happened",
            category: "battle",
            coordinates: [1, 2],
            storylineId: "s_other",
          }),
          writes: [db.storyPin.create],
        };
      },
      error: { code: "NOT_FOUND" },
    },
    {
      name: "the owner updates a locked city",
      refusal: () => {
        const db = lockDb(feature(false));
        return {
          call: createCallerFactory(geoFeaturesCitiesRouter)(ctx(db, owner)).updateCity({
            countryId: "c1",
            cityId: "f1",
            population: 5,
          }),
          writes: [db.city.update],
        };
      },
      error: locked,
    },
    {
      name: "the owner deletes a locked peak",
      refusal: () => {
        const db = lockDb(feature(false));
        return {
          call: createCallerFactory(geoFeaturesNamedFeaturesRouter)(ctx(db, owner)).deletePeak({
            countryId: "c1",
            peakId: "f1",
          }),
          writes: [db.peak.delete],
        };
      },
      error: locked,
    },
    {
      name: "a topology cascade reshapes a locked neighbouring subdivision",
      refusal: () => {
        const db = lockDb(feature(true));
        db.subdivision.findFirst
          .mockResolvedValueOnce(feature(true))
          .mockResolvedValueOnce({ editableByOwner: false });
        return {
          call: subdivisions(db).updateSubdivision({
            countryId: "c1",
            subdivisionId: "f1",
            population: 1,
            cascadedNeighbors: [{ subdivisionId: "f2", geometry: { type: "Polygon" } }],
          }),
          writes: [db.subdivision.update],
        };
      },
      error: locked,
    },
    {
      name: "a topology cascade reshapes another country's subdivision",
      refusal: () => {
        const db = lockDb(feature(true));
        db.subdivision.count.mockResolvedValue(0); // "foreign" is not a subdivision of c1
        return {
          call: subdivisions(db).updateSubdivision({
            countryId: "c1",
            subdivisionId: "f1",
            population: 1,
            cascadedNeighbors: [{ subdivisionId: "foreign", geometry: { type: "Polygon" } }],
          }),
          writes: [db.subdivision.update, db.$transaction],
        };
      },
      error: { code: "FORBIDDEN", message: expect.stringMatching(/this country/) },
    },
    {
      name: "the owner upserts an existing locked city through countryGeo",
      refusal: () => {
        const db = lockDb({ editableByOwner: false });
        return {
          call: createCallerFactory(countryGeoRouter)(ctx(db, owner)).upsertCity({
            countryId: "c1",
            id: "f1",
            name: "Feature",
          }),
          writes: [jest.mocked(upsertCity)],
        };
      },
      error: locked,
    },
    {
      name: "a non-admin reads a realm's Atlas measures",
      refusal: () => {
        const db = atlasFakeDb();
        db.realm.rows.push({
          id: "empty",
          slug: "empty",
          name: "Empty",
          mapVersion: 1,
          settings: null,
        });
        return {
          call: createCallerFactory(atlasStudioRouter)(
            ctx(db, { ...founder, country: null })
          ).realmMeasures({ realm: "empty" }),
          writes: [],
        };
      },
      // the middleware throws an AppError, which the caller wraps
      error: { cause: { code: "FORBIDDEN" } },
    },
  ])("$name", async ({ refusal, error }) => {
    const { call, writes } = refusal();
    await expect(call).rejects.toMatchObject(error);
    expect(writes.filter((write) => write.mock.calls.length > 0)).toEqual([]);
  });
});

it("a city import skips the rows outside the country's border, keeps going after a failed row, and refreshes its realm's map", async () => {
  const db = importDb();
  db.$queryRawUnsafe = answerBatch((i) => [true, false, null][i] ?? true);
  jest.mocked(upsertCity).mockRejectedValueOnce(new Error("duplicate")).mockResolvedValueOnce({});
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  const result = await importer(db).commitCityImport({
    countryId: "c1",
    cities: [
      { name: "Inside", lat: 45, lng: 10 },
      { name: "Outside", lat: 45, lng: 10 },
      { name: "Unknown border", lat: 45, lng: 10 },
    ],
  });

  expect(result).toEqual({ created: 1 });
  expect(jest.mocked(upsertCity).mock.calls.map((call) => call[2].name)).toEqual([
    "Inside",
    "Unknown border",
  ]);
  // the change names its realm, so a viewer of another realm's map ignores it
  expect(broadcastMapUpdate).toHaveBeenCalledWith("bulk", "c1", "r_eurth");
  expect(invalidateRealmMap).toHaveBeenCalledWith(db, "r_eurth");
  errorSpy.mockRestore();
});

it("lists sovereignty relations of the reader's realm only: another realm's rows never show (rule E-h)", async () => {
  const db = sovereigntyDb();
  db.realm.findUnique.mockResolvedValue({ id: "r_eurth", status: "active", ownerId: "system" });
  const anonymous = createMockRouterContext({
    db,
    auth: null,
    user: null,
    rateLimitIdentifier: `anon_${Math.random()}`,
  }) as never;

  await createCallerFactory(geoSovereigntyRouter)(anonymous).getSovereigntyRelations({
    realm: "eurth",
  });

  expect(db.countrySovereignty.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { isActive: true, sovereign: { realmId: "r_eurth" } } })
  );
});

it("deleting a storyline keeps its pins, taken out of any storyline, in one transaction", async () => {
  const db = storyDb();
  await createCallerFactory(geoFeaturesStorylinesRouter)(ctx(db, owner)).deleteStoryline({
    countryId: "c1",
    storylineId: "s1",
  });

  expect(db.storyPin.updateMany).toHaveBeenCalledWith({
    where: { storylineId: "s1" },
    data: { storylineId: null, storylineOrder: null },
  });
  expect(db.storyline.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});
