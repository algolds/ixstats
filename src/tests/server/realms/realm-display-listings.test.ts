/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { db as mockedDb } from "~/server/db";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { listProcedures } from "~/server/api/routers/countries/list";
import { economyProcedures } from "~/server/api/routers/countries/economy";
import { achievementsCountryRouter } from "~/server/api/routers/achievements/country";
import { statsProcedures } from "~/server/api/routers/geo/core/stats";
import { overlayProcedures } from "~/server/api/routers/geo/core/overlays";
import { generateRankings } from "~/server/shared/mycountry-helpers";
import { resolveWikiPlaceholderValues } from "~/server/shared/wiki-placeholders";
import { runPoliticsDrift } from "~/lib/government/politics-drift-cron";
import { generateNationalIssues } from "~/lib/national-issues/generation-cron";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { ALL_REALMS } from "~/lib/realms/realm-ids";

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

describe("countries.getAll (the /countries directory) is realm-scoped", () => {
  beforeEach(() => clearTrpcMemoryCache());

  it("lists the active nation's realm when no ?realm= is given", async () => {
    const db = makeDb();
    await createCallerFactory(directory)(ctxFor(db, eurthViewer())).getAll({ limit: 10 });

    expect(db.country.findMany.mock.calls[0][0].where).toMatchObject({
      realmId: "r_eurth",
      isDemo: false,
    });
    expect(db.country.count.mock.calls[0][0].where).toMatchObject({ realmId: "r_eurth" });
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("resolves an explicit ?realm= slug over the active nation", async () => {
    const db = makeDb();
    await createCallerFactory(directory)(ctxFor(db, eurthViewer())).getAll({
      limit: 10,
      realm: "ixworld",
    });

    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "ixworld" } })
    );
    expect(db.country.findMany.mock.calls[0][0].where).toMatchObject({ realmId: DEFAULT_REALM_ID });
  });

  it("falls back to IxWorld for a signed-out viewer", async () => {
    const db = makeDb();
    await createCallerFactory(directory)(ctxFor(db, null)).getAll();

    expect(db.country.findMany.mock.calls[0][0].where).toMatchObject({ realmId: DEFAULT_REALM_ID });
  });
});

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
const geo = createTRPCRouter({ ...statsProcedures, ...overlayProcedures });

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
      "countries.getTopCountriesByPopulation",
      (db) =>
        createCallerFactory(countries)(ctxFor(db, eurthViewer())).getTopCountriesByPopulation({
          limit: 5,
        }),
    ],
    [
      "countries.getRandomCountries",
      (db) =>
        createCallerFactory(countries)(ctxFor(db, eurthViewer())).getRandomCountries({ limit: 3 }),
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
      "geoCore.getMapStats",
      (db) => createCallerFactory(geo)(ctxFor(db, eurthViewer())).getMapStats(),
    ],
    [
      "geoCore.getRegionalChoropleth",
      (db) =>
        createCallerFactory(geo)(ctxFor(db, eurthViewer())).getRegionalChoropleth({
          metric: "gdpPerCapita",
        }),
    ],
    [
      "geoCore.getCanonDensity",
      (db) => createCallerFactory(geo)(ctxFor(db, eurthViewer())).getCanonDensity(),
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

  it("geoCore.getCrisisRiskMap lists only the realm's geo profiles", async () => {
    const db = emptyDb();
    await createCallerFactory(geo)(ctxFor(db, eurthViewer())).getCrisisRiskMap({});

    expect(db.countryGeoProfile!.findMany.mock.calls[0][0].where).toEqual({
      country: { realmId: "r_eurth" },
    });
  });

  it("geoCore.getGeopoliticalOverlay marks only the realm's conflicts", async () => {
    const db = emptyDb();
    await createCallerFactory(geo)(ctxFor(db, eurthViewer())).getGeopoliticalOverlay();

    expect(db.militaryConflict!.findMany.mock.calls[0][0].where).toMatchObject({
      initiator: { realmId: "r_eurth" },
    });
  });
});

describe("countries.getAll and getSelectList scope through realmWhere (ruling E-o)", () => {
  beforeEach(() => clearTrpcMemoryCache());

  const admin = { ...eurthViewer(), role: { name: "admin", level: 10 } };
  const member = { ...eurthViewer(), role: { name: "member", level: 100 } };
  type Caller = ReturnType<ReturnType<typeof createCallerFactory<typeof directory>>>;
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

  it("wiki placeholders rank the viewer's nation among its own realm", async () => {
    const eurthNation = {
      id: "c_eu",
      name: "Gallambria",
      realmId: "r_eurth",
      currentPopulation: 5,
    };
    const db = {
      country: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([eurthNation])
          .mockResolvedValue([
            { id: "c_ix", realmId: DEFAULT_REALM_ID, currentPopulation: 900, currentTotalGdp: 900 },
            { id: "c_eu", realmId: "r_eurth", currentPopulation: 5, currentTotalGdp: 5 },
          ]),
      },
      pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const [result] = await resolveWikiPlaceholderValues(["MyCountry:population"], db, "c_eu");

    expect(result?.metadata?.comparisonRank).toBe("Ranked #1 globally");
  });
});

describe("CountryData:<name> placeholders name an IxWorld nation", () => {
  it("resolves IxWorld's nation even when the viewer's same-name Eurth nation is loaded first", async () => {
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

describe("crons stay global (decision 17: the simulation is identical in every realm)", () => {
  const dbModule = mockedDb as unknown as Record<string, unknown>;

  it.each([
    ["politics drift", runPoliticsDrift],
    ["national issues generation", generateNationalIssues],
  ] as const)("%s walks every realm's owned countries", async (_name, run) => {
    const findMany = jest.fn().mockResolvedValue([]);
    dbModule.country = { findMany };
    await run();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("realmId");
  });
});
