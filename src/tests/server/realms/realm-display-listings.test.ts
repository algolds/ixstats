/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

jest.mock("~/lib/auth", () => ({
  ...jest.requireActual("~/lib/auth"),
  isSystemOwner: () => false,
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-bonus", () => ({
  grantBonus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/country-mutation-helpers", () => ({
  syncNationalIdentity: jest.fn(),
  syncDemographics: jest.fn(),
  syncIncomeAndSpending: jest.fn(),
  syncTaxSystem: jest.fn(),
  syncGovernmentStructure: jest.fn(),
  syncGovernmentComponents: jest.fn(),
  syncEconomyBuilderState: jest.fn(),
}));

jest.mock("~/lib/flags/server", () => ({
  serverFlagResolver: { resolveBatch: jest.fn().mockResolvedValue(new Map()) },
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleIntro: jest.fn(),
  getArticleWikitext: jest.fn(),
  searchPages: jest.fn(),
}));

jest.mock("~/server/shared/geo-resource-sync", () => ({
  syncResourcePoolModifiers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/economy/transport-generator", () => ({
  estimateCoastalCities: jest.fn((cities: unknown) => cities),
  generateTransportNetwork: jest.fn(() => [
    {
      routeType: "rail",
      name: "A–B Rail",
      geometry: { type: "LineString", coordinates: [] },
      stops: [{ cityId: "city_a" }, { cityId: "city_b" }],
      properties: {},
      isInternational: false,
      terrainDifficulty: 0.2,
      lengthKm: 10,
    },
  ]),
}));

jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: {
    ...jest.requireActual("~/lib/activity/hooks").ActivityHooks,
    Diplomatic: { onAllianceFormed: jest.fn(), onAllianceJoined: jest.fn() },
  },
}));

jest.mock("~/lib/economy/atomic-integration.server", () => ({
  calculateCountryDataWithAtomicEnhancement: jest.fn().mockResolvedValue({}),
}));
jest.mock("~/lib/admin/roster-parser", () => ({ parseRosterFile: jest.fn() }));

import { db as mockedDb } from "~/server/db";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { listProcedures } from "~/server/api/routers/countries/list";
import { economyProcedures } from "~/server/api/routers/countries/economy";
import { achievementsCountryRouter } from "~/server/api/routers/achievements/country";
import { overlayProcedures } from "~/server/api/routers/geo/core/overlays";
import { generateRankings } from "~/server/shared/mycountry-helpers";
import { resolveWikiPlaceholderValues } from "~/server/shared/wiki-placeholders";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { grantBonus } from "~/lib/vault/vault-bonus";
import { flagsProcedures } from "~/server/api/routers/countries/flags";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import * as bridge from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { transportRouteMutationsRouter } from "~/server/api/routers/transport/routeMutations";
import { CALLER_COUNTRY, createIdorContext } from "~/tests/helpers/country-idor-context";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { parseRosterFile } from "~/lib/admin/roster-parser";
import { realmScopeInput } from "~/server/api/trpc/realm-scope";
import { identityProcedures } from "~/server/api/routers/countries/identity";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { adminCountriesImportRouter } from "~/server/api/routers/admin/countries/import";
const directory = createTRPCRouter({ ...listProcedures });

function eurthViewer() {
  return {
    id: "u1",
    clerkUserId: "clerk_u1",
    countryId: "c_eu",
    country: { id: "c_eu", realmId: "r_eurth" },
  };
}

function makeDb() {
  return {
    country: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    realm: { findUnique: jest.fn().mockResolvedValue({ id: DEFAULT_REALM_ID }) },
  };
}

function ctxFor(db: object, user: ReturnType<typeof eurthViewer> | null) {
  return { db, user, auth: null, rateLimitIdentifier: "test", headers: new Headers() } as never;
}

type ModelMock = Record<"findMany" | "count" | "groupBy" | "findUnique", jest.Mock>;

/** Every model answers empty, so each procedure runs its listing queries and nothing else matters. */
function emptyDb(): Record<string, ModelMock> {
  const models = new Map<string, ModelMock>();
  return new Proxy({} as Record<string, ModelMock>, {
    get: (_target, name) => {
      const key = String(name);
      if (!models.has(key)) {
        models.set(key, {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
        });
      }
      return models.get(key);
    },
  });
}

function countryWheres(db: Record<string, ModelMock>) {
  return [...db.country!.findMany.mock.calls, ...db.country!.count.mock.calls].map(
    (c) => c[0]?.where
  );
}

const countries = createTRPCRouter({ ...listProcedures, ...economyProcedures });
const geo = createTRPCRouter({ ...overlayProcedures });

describe("every cross-country display listing is scoped to the viewer's realm", () => {
  beforeEach(() => clearTrpcMemoryCache());

  const cases: Array<[string, (db: Record<string, ModelMock>) => Promise<unknown>]> = [
    [
      "countries.getSelectList",
      (db) =>
        createCallerFactory(countries)(ctxFor(db, eurthViewer())).getSelectList({ search: "a" }),
    ],
    [
      "countries.getTopCountriesByImportance",
      (db) =>
        createCallerFactory(countries)(ctxFor(db, eurthViewer())).getTopCountriesByImportance({
          limit: 5,
        }),
    ],
    [
      "countries.getGlobalStats",
      (db) => createCallerFactory(countries)(ctxFor(db, eurthViewer())).getGlobalStats(),
    ],
    [
      "achievements.getLeaderboard",
      (db) =>
        createCallerFactory(achievementsCountryRouter)(ctxFor(db, eurthViewer())).getLeaderboard({
          limit: 5,
        }),
    ],
    [
      "achievements.getCountryLeaderboard",
      (db) =>
        createCallerFactory(achievementsCountryRouter)(
          ctxFor(db, eurthViewer())
        ).getCountryLeaderboard({ metric: "totalGdp" }),
    ],
    [
      "geoCore.getRegionalChoropleth",
      (db) =>
        createCallerFactory(geo)(ctxFor(db, eurthViewer())).getRegionalChoropleth({
          metric: "gdpPerCapita",
        }),
    ],
    [
      "geoCore.getGeopoliticalOverlay",
      (db) => createCallerFactory(geo)(ctxFor(db, eurthViewer())).getGeopoliticalOverlay(),
    ],
  ];

  it.each(cases)("%s filters its country query by the viewer's realm", async (_name, call) => {
    const db = emptyDb();
    await call(db);

    const wheres = countryWheres(db);
    expect(wheres.length).toBeGreaterThan(0);
    for (const where of wheres) expect(where).toMatchObject({ realmId: "r_eurth" });
  });
});

describe("countries.getAll and getSelectList scope through realmWhere (ruling E-o)", () => {
  beforeEach(() => clearTrpcMemoryCache());

  const admin = { ...eurthViewer(), role: { name: "admin", level: 10 } };
  const member = { ...eurthViewer(), role: { name: "member", level: 100 } };
  type Caller = ReturnType<typeof directory.createCaller>;
  const listings: Array<[string, (caller: Caller) => Promise<object>]> = [
    ["getAll", (caller) => caller.getAll({ realm: ALL_REALMS })],
    ["getSelectList", (caller) => caller.getSelectList({ realm: ALL_REALMS })],
  ];

  it.each(listings)('%s: a site admin\'s "*" reads every realm', async (_name, list) => {
    const db = makeDb();
    await list(createCallerFactory(directory)(ctxFor(db, admin)));

    expect(db.country.findMany.mock.calls[0][0].where).not.toHaveProperty("realmId");
  });

  it.each(listings)('%s: a member\'s "*" stays in their own realm', async (_name, list) => {
    const db = makeDb();
    await list(createCallerFactory(directory)(ctxFor(db, member)));

    expect(db.country.findMany.mock.calls[0][0].where).toMatchObject({ realmId: "r_eurth" });
  });
});

describe("a country's own rankings compare it within its own realm", () => {
  const dbModule = mockedDb as unknown as Record<string, unknown>;

  it("MyCountry rankings rank against the country's realm, not the whole platform", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    dbModule.country = {
      findUnique: jest.fn().mockResolvedValue({ id: "c_eu", realmId: "r_eurth", region: "North" }),
      findMany,
    };
    await generateRankings("c_eu_rankings_probe");

    expect(findMany.mock.calls[0][0].where).toMatchObject({ realmId: "r_eurth" });
  });
});

describe("CountryData:<name> placeholders name an Ixnay nation", () => {
  it("resolves Ixnay's nation even when the viewer's same-name Eurth nation is loaded first", async () => {
    const db = {
      country: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c_eu", name: "Gallambria", realmId: "r_eurth", currentPopulation: 5 },
          { id: "c_ix", name: "Gallambria", realmId: DEFAULT_REALM_ID, currentPopulation: 900 },
        ]),
      },
      pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const [result] = await resolveWikiPlaceholderValues(
      ["CountryData:Gallambria:population"],
      db,
      "c_eu"
    );

    expect(result?.rawVal).toBe(900);
  });
});

/**
 * countries.createCountry is realm-aware and capped: it founds the nation in the chosen realm (else the realm of
 * the nation the player acts as, else Ixnay), refuses a closed or unknown realm, and refuses a player at their
 * nation cap instead of silently returning the nation they already have.
 */
describe("founding a nation in a realm", () => {
  const router = createTRPCRouter(managementCreateProcedures);
  const CLERK_ID = "clerk_p1";
  interface Scenario {
    membershipTier?: string;
    /** Realm of the nation the player acts as (null: acts as none). */
    activeRealmId?: string | null;
    realms?: Record<string, { status: string; settings: object | null }>;
    /** Nations the player owns per realm. */
    held?: Record<string, number>;
    nameTaken?: boolean;
    /** The name is a nation page of the realm's lore index. */
    nationPage?: string;
  }
  function setup(s: Scenario = {}) {
    const realms = s.realms ?? { default: { status: "active", settings: null } };
    const held = s.held ?? {};
    const db: any = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(({ where }: { where: { clerkUserId?: string; id?: string } }) =>
          Promise.resolve(
            where.clerkUserId
              ? { id: "u1", clerkUserId: CLERK_ID, roleId: "r_user", role: { name: "user" } }
              : {
                  membershipTier: s.membershipTier ?? "basic",
                  country: s.activeRealmId ? { realmId: s.activeRealmId } : null,
                }
          )
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      realmPage: {
        findFirst: jest.fn().mockResolvedValue(s.nationPage ? { title: s.nationPage } : null),
      },
      realm: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          const realm = realms[where.id];
          return Promise.resolve(realm ? { id: where.id, ...realm } : null);
        }),
      },
      country: {
        findFirst: jest.fn().mockResolvedValue(s.nameTaken ? { id: "other" } : null),
        count: jest.fn(({ where }: { where: { realmId: string } }) =>
          Promise.resolve(held[where.realmId] ?? 0)
        ),
        findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) => {
          if (where.slug) return Promise.resolve(null); // slug free
          return Promise.resolve({
            id: "c_new",
            realmId: db.country.create.mock.calls[0]?.[0].data.realmId,
            ownerUserId: null,
            realm: {
              settings: realms[db.country.create.mock.calls[0]?.[0].data.realmId]?.settings ?? null,
            },
          });
        }),
        create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "c_new", ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db));
    const ctx = createMockRouterContext({
      db,
      auth: { userId: CLERK_ID },
      user: { id: "u1", clerkUserId: CLERK_ID, countryId: null, role: { name: "user" } },
    });
    return { db, caller: router.createCaller(ctx as never) };
  }
  const input = (extra: object = {}) => ({
    name: "New Aurelia",
    foundationCountry: null,
    economicInputs: {},
    ...extra,
  });
  describe("countries.createCountry — realm and cap", () => {
    beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
    afterEach(() => jest.restoreAllMocks());

    it("a free player who already holds an Ixnay nation is refused (CONFLICT), not handed the old nation", async () => {
      const { db, caller } = setup({ activeRealmId: "default", held: { default: 1 } });
      await expect(caller.createCountry(input() as never)).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringMatching(/already hold 1 nation in this realm/),
      });
      expect(db.country.create).not.toHaveBeenCalled();
    });
    it("founding a nation pays no bonus", async () => {
      const { caller } = setup();
      await caller.createCountry(input() as never);
      expect(grantBonus).not.toHaveBeenCalled();
    });
    it("a cap filled concurrently (inside the transaction) is CONFLICT, not a generic failure", async () => {
      const { db, caller } = setup();
      // The pre-check sees 0, the transaction's re-check sees 1.
      db.country.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      await expect(caller.createCountry(input() as never)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });
});

/** AT-18: country names are unique per realm only, so the flag lookup by name is realm-scoped. */
describe("flag lookups", () => {
  const createCaller = createCallerFactory(flagsProcedures);
  function countryWhere(db: ReturnType<typeof createMockPrisma>) {
    return db.country.findMany.mock.calls[0]![0].where;
  }
  describe("countries.flags.resolveBatch realm scope", () => {
    it("looks names up in the viewer's active realm", async () => {
      const db = createMockPrisma();
      db.country.findMany.mockResolvedValue([]);
      const ctx = createMockRouterContext({
        db,
        user: { clerkUserId: "u1", country: { id: "c1", name: "A", slug: "a", realmId: "eurth" } },
      });
      await createCaller(ctx as never).resolveBatch({ countryNames: ["Atlantis"] });

      expect(countryWhere(db)).toEqual({ name: { in: ["Atlantis"] }, realmId: "eurth" });
    });
  });
});

/** AT-12: map wiki lookups use the realm's wiki; Ixnay keeps ixwiki then iiwiki. */
describe("the realm's wiki", () => {
  const createCaller = createCallerFactory(geoWikiRouter);
  const getArticleIntro = bridge.getArticleIntro as jest.Mock;
  const searchPages = bridge.searchPages as jest.Mock;
  function caller(db: ReturnType<typeof createMockPrisma>) {
    return createCaller(createMockRouterContext({ db, auth: null, user: null }) as never);
  }
  const wikisTried = (mock: jest.Mock, wikiArg: number) => mock.mock.calls.map((c) => c[wikiArg]);
  beforeEach(() => {
    getArticleIntro.mockReset().mockResolvedValue(null);
    searchPages.mockReset().mockResolvedValue([]);
  });
  describe("geoWiki realm wiki source", () => {
    it("searches only the realm's wiki", async () => {
      const db = createMockPrisma();
      db.realm.findUnique.mockResolvedValue({ id: "realm_alt" });
      db.realmPage.findFirst.mockResolvedValue({ wikiSource: "althistory" });
      await caller(db).searchWikiPages({ query: "Ber", realm: "alt" });

      expect(wikisTried(searchPages, 2)).toEqual(["althistory"]);
    });
  });
});

describe("transport rows", () => {
  const EURTH = "realm_eurth";
  function realmDb() {
    return {
      transportRoute: {
        create: jest.fn(async ({ data }: { data: object }) => ({ id: "route_new", ...data })),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      transportHub: { create: jest.fn().mockResolvedValue({}) },
      pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
      countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
  }
  function eurthCaller(db: ReturnType<typeof realmDb>) {
    const ctx = createIdorContext(db);
    ctx.db.country.findUnique = jest.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: "Eurthland",
      realmId: EURTH,
      boundingBox: [0, 0, 1, 1],
      coastlineKm: 0,
      cities: [
        { id: "city_a", name: "A", coordinates: [0, 0], population: 1, isNationalCapital: true },
        { id: "city_b", name: "B", coordinates: [1, 1], population: 1, isNationalCapital: false },
      ],
    }));
    return transportRouteMutationsRouter.createCaller(ctx);
  }
  describe("AT-1: transport rows carry the owning country's realm", () => {
    it("generateRoutes saves routes and hubs in the country's realm", async () => {
      const db = realmDb();
      await eurthCaller(db).generateRoutes({ countryId: CALLER_COUNTRY });

      expect(db.transportRoute.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ realmId: EURTH }) })
      );
      expect(db.transportHub.create).toHaveBeenCalledTimes(2);
      for (const [arg] of db.transportHub.create.mock.calls) {
        expect(arg).toMatchObject({ data: { realmId: EURTH } });
      }
    });
  });
});

describe("alliances", () => {
  const createCaller = createCallerFactory(diplomaticPoliciesRouter);
  const callerFor = (db: any, userId = "uA", countryId = "A") =>
    createCaller(
      createMockRouterContext({
        db,
        auth: { userId: `clerk_${userId}` },
        user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
      }) as any
    ) as any;
  function seed() {
    const { db } = createDiplomacyFakeDb({
      countries: [
        {
          id: "A",
          name: "Alpha",
          realmId: "eurth-id",
          ownerUserId: "uA",
          owner: { clerkUserId: "clerk_uA" },
        },
        {
          id: "E",
          name: "Esonice",
          realmId: "eurth-id",
          ownerUserId: "uE",
          owner: { clerkUserId: "clerk_uE" },
        },
        {
          id: "I",
          name: "Ixia",
          realmId: "default",
          ownerUserId: "uI",
          owner: { clerkUserId: "clerk_uI" },
        },
      ],
      alliances: [{ id: "al1", name: "Aurelian League", realmId: "eurth-id", memberCount: 1 }],
      allianceMembers: [
        {
          id: "mA",
          allianceId: "al1",
          countryId: "A",
          role: "founder",
          isActive: true,
          status: "active",
        },
      ],
      relations: [],
      actingUsers: [],
    });
    return db;
  }
  describe("alliances are realm-scoped", () => {
    it("refuses to invite a nation of another realm", async () => {
      const db = seed();
      await expect(
        callerFor(db).inviteMember({ allianceId: "al1", targetCountryId: "I" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("realm-scoped"),
      });
      expect(db.allianceMember.create).not.toHaveBeenCalled();
    });
    it("refuses to accept a (legacy) invite across realms", async () => {
      const { db } = createDiplomacyFakeDb({
        countries: [
          {
            id: "A",
            name: "Alpha",
            realmId: "eurth-id",
            ownerUserId: "uA",
            owner: { clerkUserId: "clerk_uA" },
          },
          {
            id: "I",
            name: "Ixia",
            realmId: "default",
            ownerUserId: "uI",
            owner: { clerkUserId: "clerk_uI" },
          },
        ],
        alliances: [{ id: "al1", name: "Aurelian League", realmId: "eurth-id", memberCount: 1 }],
        allianceMembers: [
          {
            id: "mA",
            allianceId: "al1",
            countryId: "A",
            role: "founder",
            isActive: true,
            status: "active",
          },
          {
            id: "mI",
            allianceId: "al1",
            countryId: "I",
            role: "member",
            isActive: false,
            status: "invited",
            invitedByCountryId: "A",
            invitedAt: new Date(),
          },
        ],
        relations: [],
        actingUsers: [],
      });
      await expect(
        callerFor(db, "uI", "I").respondToAllianceInvite({
          allianceId: "al1",
          countryId: "I",
          choice: "accept",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });
});

// Fix round 1 (rulings E-o, E-p, E-q): admin "*" reads, realm-correct name lookups, Ixnay-less cache keys.
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
describe("names resolve inside one realm", () => {
  type Row = {
    id: string;
    name: string;
    slug: string | null;
    realmId: string;
    [key: string]: unknown;
  };
  type Where = Record<string, any> | undefined;
  /** Just enough of Prisma's `where` for these lookups: equality, in, not, equals(+insensitive), OR. */
  function matches(row: Record<string, unknown>, where: Where): boolean {
    return Object.entries(where ?? {}).every(([key, cond]) => {
      if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
      if (cond === undefined) return true;
      const value = row[key];
      if (cond === null || typeof cond !== "object") return value === cond;
      if ("in" in cond) return cond.in.includes(value);
      if ("not" in cond) return value !== cond.not;
      if ("equals" in cond) {
        return cond.mode === "insensitive"
          ? String(value).toLowerCase() === String(cond.equals).toLowerCase()
          : value === cond.equals;
      }
      return true;
    });
  }
  function countryTable(rows: Row[]) {
    const find = (args?: { where?: Where; take?: number }) =>
      rows.filter((r) => matches(r, args?.where)).slice(0, args?.take ?? rows.length);
    return {
      findMany: jest.fn(async (args?: { where?: Where; take?: number }) => find(args)),
      findFirst: jest.fn(async (args?: { where?: Where }) => find(args)[0] ?? null),
      findUnique: jest.fn(async (args?: { where?: Where }) => find(args)[0] ?? null),
      create: jest.fn(async (args: { data: object }) => args.data),
      update: jest.fn(async (args: { data: object }) => args.data),
    };
  }
  // The other realm's same-name nation comes FIRST, so an unscoped lookup would return it.
  const EURTH_GALLAMBRIA: Row = {
    id: "c_eu",
    name: "Gallambria",
    slug: "gallambria-eurth",
    realmId: "r_eurth",
    leader: "Eurth leader",
  };
  const IX_GALLAMBRIA: Row = {
    id: "c_ix",
    name: "Gallambria",
    slug: "gallambria-ix",
    realmId: DEFAULT_REALM_ID,
    leader: "Ixnay leader",
  };
  function publicCtx(country: ReturnType<typeof countryTable>, realmId?: string) {
    return {
      db: { country, realm: { findUnique: jest.fn().mockResolvedValue(null) } },
      user: realmId ? { id: "u1", clerkUserId: "clerk_u1", country: { realmId } } : null,
      auth: null,
      rateLimitIdentifier: "test",
      headers: new Headers(),
    } as never;
  }
  describe("E-p: a name resolves inside one realm; ids and slugs win first", () => {
    const byId = createCallerFactory(createTRPCRouter({ ...identityProcedures }));

    it("getByIdBasic resolves a bare name within the viewer's realm", async () => {
      const table = countryTable([EURTH_GALLAMBRIA, IX_GALLAMBRIA]);
      await expect(
        byId(publicCtx(table)).getByIdBasic({ id: "Gallambria" })
      ).resolves.toMatchObject({
        id: "c_ix",
      });
      await expect(
        byId(publicCtx(table, "r_eurth")).getByIdBasic({ id: "Gallambria" })
      ).resolves.toMatchObject({
        id: "c_eu",
      });
    });
    it("the roster import (Ixnay-only) never updates another realm's same-name nation", async () => {
      const table = countryTable([EURTH_GALLAMBRIA]);
      (parseRosterFile as jest.Mock).mockResolvedValue([
        { country: "Gallambria", population: 1_000_000, gdpPerCapita: 10_000 },
      ]);
      const ctx = createMockRouterContext({
        db: createMockPrisma({ country: table }),
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      });
      const caller = createCallerFactory(adminCountriesImportRouter)(ctx as never);

      await caller.importRosterData({
        analysisId: "a",
        replaceExisting: true,
        fileData: [1],
        fileName: "r.csv",
      });

      expect(table.update).not.toHaveBeenCalled();
      expect(table.create).toHaveBeenCalledTimes(1);
    });
  });
  describe("E-s: a typed nation name resolves in the viewer's realm before any slug", () => {
    // Ixnay holds the plain slug; Eurth's same-name nation was suffixed on claim.
    const IX_PLAIN = { ...IX_GALLAMBRIA, slug: "gallambria" };
    const users = [
      { id: "u_ix", clerkUserId: "clerk_ix", countryId: "c_ix" },
      { id: "u_eu", clerkUserId: "clerk_eu", countryId: "c_eu" },
    ];

    function viewer(realmId = "r_eurth") {
      const db = createMockPrisma({ country: countryTable([IX_PLAIN, EURTH_GALLAMBRIA]) });
      db.user.findFirst.mockImplementation(
        async (args: { where?: Where }) => users.find((u) => matches(u, args.where)) ?? null
      );
      db.userConnection.create.mockImplementation(async (args: { data: object }) => args.data);
      const ctx = createMockRouterContext({
        db,
        user: {
          id: "u1",
          clerkUserId: "test_user_clerk_id",
          country: { id: "c_me", name: "Me", slug: "me", realmId },
        },
      });
      return { db, caller: createCallerFactory(usersPreferencesRouter)(ctx as never) };
    }

    it("blockAccount blocks the Eurth nation and its owner, not Ixnay's plain-slug holder", async () => {
      const { db, caller } = viewer();
      await caller.blockAccount({ identifier: "Gallambria" });
      expect(db.userConnection.create.mock.calls[0][0].data).toMatchObject({
        targetCountryId: "c_eu",
        targetUserId: "u_eu",
      });
    });
  });
  describe("E-q: the cache key names a realm only when it isn't Ixnay", () => {
    beforeEach(() => clearTrpcMemoryCache());

    const probe = jest.fn(async () => "rows");
    const router = createTRPCRouter({
      probe: cachedPublicProcedure.input(realmScopeInput.optional()).query(() => probe()),
    });
    const as = (realmId?: string) =>
      createCallerFactory(router)(publicCtx(countryTable([]), realmId));

    it("anonymous and Ixnay-nation viewers share an entry; an Eurth viewer gets its own", async () => {
      probe.mockClear();
      await as().probe();
      await as(DEFAULT_REALM_ID).probe();
      expect(probe).toHaveBeenCalledTimes(1);

      await as("r_eurth").probe();
      expect(probe).toHaveBeenCalledTimes(2);
    });
  });
});
