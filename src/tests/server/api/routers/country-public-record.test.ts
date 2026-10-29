/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// The reads behind a country's public profile. The header names the owner by their passport handle, then their forum
// name, and never selects or sends an old wiki name (identity, plan A). The small profile ten screens ask for never
// selects the geometry blob (plan 404). The intro reads the country's own wiki page and never looks its name up on other wikis when that
// page is missing, with the name and country caches apart. Crisis statistics count only the crises that list the
// country, in either stored form. The vitality scores and the World Census never fabricate a missing figure and rank
// within the country's realm, lower-is-better where it should be. (Who sees the statecraft record is in
// country-private-record.test.ts.)
//
// Folds country-owner-wiki-attribution, countries-get-by-id-basic, countries-wiki-rich-intro,
// crisis-events-statistics and mycountry-vitality-rankings.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/server/shared/clerk-public-profile", () => ({
  clerkPublicProfile: jest.fn(async () => ({ imageUrl: null, role: null })),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleIntro: jest.fn(),
  getPageSections: jest.fn(),
  getPageImages: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { db as mockedDb } from "~/server/db";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import {
  getArticleIntro,
  getPageImages,
  getPageSections,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { economyProcedures } from "~/server/api/routers/countries/economy";
import { identityProcedures } from "~/server/api/routers/countries/identity";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { crisisEventsRouter } from "~/server/api/routers/crisis-events";
import {
  calculateVitalityScores,
  emptyDiplomaticStandingInputs,
  generateRankings,
  rankCensus,
  scoreDiplomaticStanding,
} from "~/server/shared/mycountry-helpers";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const visitorOn = (db: object) => createMockRouterContext({ auth: null, user: null, db }) as never;

describe("countries.getByIdWithEconomicData: the owner is named by their handle, never a wiki name", () => {
  /** The owner as the procedure selects them (SOVEREIGN_OWNER_SELECT in countries/economy.ts). */
  type OwnerRow = Prisma.UserGetPayload<{
    select: {
      id: true;
      clerkUserId: true;
      handle: true;
      forumUsername: true;
      membershipTier: true;
      role: { select: { displayName: true; name: true } };
    };
  }>;
  const OWNER: OwnerRow = {
    id: "owner_db",
    clerkUserId: "owner_clerk",
    handle: null,
    forumUsername: null,
    membershipTier: "citizen",
    role: null,
  };
  function makeDb(owner: Partial<OwnerRow> = {}) {
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([{ id: "c1", slug: "eldoria" }]);
    db.country.findFirst.mockResolvedValue({
      id: "c1",
      slug: "eldoria",
      name: "Eldoria",
      baselineDate: new Date(0),
      lastCalculated: new Date(0),
      storytellerEffects: [],
      owner: { ...OWNER, ...owner },
    });
    return db;
  }
  type Db = ReturnType<typeof makeDb>;
  type Read = {
    owner: { handle: string | null; forumUsername: string | null } | null;
    sovereignUser: { username: string | null } | null;
  };
  const theOwner = (db: Db) =>
    createMockRouterContext({
      db,
      auth: { userId: "owner_clerk" },
      user: {
        id: "owner_db",
        clerkUserId: "owner_clerk",
        countryId: "c1",
        role: { name: "member" },
      },
    }) as never;
  const read = async (ctx: never) =>
    (await createCallerFactory(createTRPCRouter({ ...economyProcedures }))(
      ctx
    ).getByIdWithEconomicData({ id: "eldoria" })) as Read;

  beforeEach(() => clearTrpcMemoryCache());

  it("selects the owner's handle and forum name and reads no privacy setting", async () => {
    const db = makeDb({ handle: "ruler" });
    await read(visitorOn(db));
    const [args] = db.country.findFirst.mock.calls[0] as [
      { include: { owner: { select: Record<string, boolean> } } },
    ];
    expect(args.include.owner.select).toMatchObject({ handle: true, forumUsername: true });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["a visitor", (db: Db) => visitorOn(db)],
    ["the owner", theOwner],
  ])("names the owner to %s by handle first", async (_who, ctxFor) => {
    const record = await read(ctxFor(makeDb({ handle: "ruler", forumUsername: "ForumRuler" })));
    expect(record.owner).toMatchObject({ handle: "ruler", forumUsername: "ForumRuler" });
    expect(record.sovereignUser?.username).toBe("ruler");
  });

  it("falls through to the forum name, then the Clerk id", async () => {
    const forum = await read(visitorOn(makeDb({ forumUsername: "ForumRuler" })));
    expect(forum.sovereignUser?.username).toBe("ForumRuler");
    clearTrpcMemoryCache();
    expect((await read(visitorOn(makeDb()))).sovereignUser?.username).toBe("owner_clerk");
  });
});

describe("countries.getByIdBasic (plan 404)", () => {
  it("does not select the geometry blob", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "c_1",
        name: "Aurelia",
        slug: "aurelia",
        flag: null,
        continent: "Eurth",
        currentPopulation: 1_000,
        currentGdpPerCapita: 2_000,
        currentTotalGdp: 3_000,
        landArea: 4_000,
        populationDensity: 5,
        centroid: [1, 2],
      },
    ]);
    const db = { country: { findMany }, realm: { findUnique: jest.fn().mockResolvedValue(null) } };
    await createCallerFactory(createTRPCRouter({ ...identityProcedures }))(
      visitorOn(db)
    ).getByIdBasic({ id: "c_1" });

    const { select } = findMany.mock.calls[0]![0] as { select: Record<string, boolean> };
    expect(select).not.toHaveProperty("geometry");
    expect(select).toMatchObject({ id: true, name: true, centroid: true });
  });
});

describe("countries.getWikiRichIntro", () => {
  const findMany = jest.fn<
    Promise<Array<{ id: string; wikiSource: string | null; wikiPageTitle: string | null }>>,
    [{ where: { id: { in: string[] } } }]
  >();
  const intro = (input: { countryName: string; countryId?: string }) =>
    createCallerFactory(createTRPCRouter(wikiProcedures))(
      visitorOn({ country: { findMany } })
    ).getWikiRichIntro(input);
  /** The (title, wiki) pairs the wikitext store was asked for, in order. */
  const reads = () => jest.mocked(getArticleWikitextShadow).mock.calls.map(([t, w]) => [t, w]);
  const LEAD =
    "'''Tagmatium''' is a nation on the continent of [[Alharu]], long the seat of an old and storied empire.";

  beforeEach(() => {
    jest.mocked(getArticleWikitextShadow).mockReset();
    findMany.mockReset().mockResolvedValue([]);
  });

  it("does not look the name up on other wikis when the referenced page is missing", async () => {
    findMany.mockResolvedValue([
      { id: "c-gone", wikiSource: "iiwiki", wikiPageTitle: "Gone Land" },
    ]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(null);
    await expect(intro({ countryName: "Gone Land", countryId: "c-gone" })).resolves.toBeNull();
    expect(reads()).toEqual([["Gone Land", "iiwiki"]]);
  });

  it("caches a lookup by name apart from a lookup by country", async () => {
    findMany.mockResolvedValue([{ id: "c-urc", wikiSource: "iiwiki", wikiPageTitle: "Urcea" }]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue({
      wikitext: LEAD,
      revid: null,
      timestamp: "",
      fromShadow: true,
      stale: false,
    });
    await intro({ countryName: "Urcea" });
    await intro({ countryName: "Urcea", countryId: "c-urc" });
    expect(reads()).toEqual([
      ["Urcea", "ixwiki"],
      ["Urcea", "iiwiki"],
    ]);
  });
});

describe("countries' wiki readers of a nation with its own wiki (an Eurth nation on IIWiki)", () => {
  type CountryRow = {
    id: string;
    name: string;
    wikiSource: string | null;
    wikiPageTitle: string | null;
  };
  const findMany = jest.fn<Promise<CountryRow[]>, [{ where: { id: { in: string[] } } }]>();
  const readers = () =>
    createCallerFactory(createTRPCRouter(wikiProcedures))(visitorOn({ country: { findMany } }));
  /** The wikis each bridge reader was asked, in order. */
  const introWikis = () => jest.mocked(getArticleIntro).mock.calls.map(([t, w]) => [t, w]);
  const sectionWikis = () => jest.mocked(getPageSections).mock.calls.map(([t, w]) => [t, w]);
  const imageWikis = () => jest.mocked(getPageImages).mock.calls.map(([t, o]) => [t, o?.wiki]);
  const SECTIONS = [{ level: 2, title: "History", index: 0 }];

  beforeEach(() => {
    clearTrpcMemoryCache();
    jest
      .mocked(getArticleIntro)
      .mockReset()
      .mockResolvedValue({ title: "Afropa", text: "A lead." });
    jest.mocked(getPageSections).mockReset().mockResolvedValue(SECTIONS);
    jest.mocked(getPageImages).mockReset().mockResolvedValue(null);
    jest.mocked(getArticleWikitextShadow).mockReset().mockResolvedValue({
      wikitext: "== History ==\nAfropa was founded long ago, by people of the southern coast.",
      revid: null,
      timestamp: "",
      fromShadow: false,
      stale: false,
    });
    findMany
      .mockReset()
      .mockResolvedValue([
        { id: "c-afr", name: "Afropa", wikiSource: "iiwiki", wikiPageTitle: "Afropa" },
      ]);
  });

  it("reads the intro, sections, images and section previews on its own wiki, never IxWiki", async () => {
    const byCountry = { countryName: "Afropa", countryId: "c-afr" };

    await expect(readers().getWikiIntro(byCountry)).resolves.toMatchObject({
      wikiSource: "iiwiki",
      wikiUrl: "/wiki/Afropa?source=iiwiki",
    });
    await readers().getWikiSections(byCountry);
    await readers().getWikiPageImages(byCountry);
    await expect(readers().getWikiSectionPreviews(byCountry)).resolves.toEqual([
      expect.objectContaining({ line: "History", preview: expect.stringContaining("founded") }),
    ]);

    expect(introWikis()).toEqual([["Afropa", "iiwiki"]]);
    expect(imageWikis()).toEqual([["Afropa", "iiwiki"]]);
    expect(sectionWikis().every(([, wiki]) => wiki === "iiwiki")).toBe(true);
    expect(jest.mocked(getArticleWikitextShadow).mock.calls.map(([t, w]) => [t, w])).toEqual([
      ["Afropa", "iiwiki"],
    ]);
  });

  it("reads its name on its own wiki when it names no page, even when IxWiki has an article of that name", async () => {
    findMany.mockResolvedValue([
      { id: "c-urc", name: "Urcea", wikiSource: "iiwiki", wikiPageTitle: null },
    ]);

    await readers().getWikiIntro({ countryName: "Urcea", countryId: "c-urc" });

    expect(introWikis()).toEqual([["Urcea", "iiwiki"]]);
  });

  it("still looks a bare name up on IxWiki first", async () => {
    await readers().getWikiIntro({ countryName: "Afropa" });

    expect(introWikis()).toEqual([["Afropa", "ixwiki"]]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("crisisEvents.getStatistics country scope", () => {
  it("counts only crises that list the country, in JSON or legacy comma form", async () => {
    const event = (overrides: Record<string, unknown>) => ({
      id: "e",
      type: "natural",
      category: "governance",
      severity: "low",
      responseStatus: "pending",
      casualties: 0,
      economicImpact: 0,
      affectedCountries: null,
      ...overrides,
    });
    const db = createMockPrisma();
    db.crisisEvent.findMany.mockResolvedValue([
      event({ id: "json", affectedCountries: '["c1","c9"]', severity: "critical" }),
      event({ id: "legacy", affectedCountries: "c9, c1" }),
      event({ id: "other", affectedCountries: '["c2"]' }),
      // a substring match must not count: "c1" is not "c10"
      event({ id: "prefix", affectedCountries: '["c10"]' }),
      event({ id: "none", affectedCountries: null }),
    ]);
    const stats = await createCallerFactory(crisisEventsRouter)(visitorOn(db)).getStatistics({
      timeframe: "month",
      countryId: "c1",
    });
    expect(stats).toMatchObject({ activeEvents: 2, criticalEvents: 1, totalEvents: 2 });
    // Critical among the active ones only: a resolved critical crisis is not "at least one active".
    expect(stats.activeCriticalEvents).toBe(1);
  });

  it("counts a resolved critical crisis as critical but not as active critical", async () => {
    const db = createMockPrisma();
    db.crisisEvent.findMany.mockResolvedValue([
      {
        id: "r",
        type: "natural",
        category: "governance",
        severity: "critical",
        responseStatus: "resolved",
        casualties: 0,
        economicImpact: 0,
        affectedCountries: '["c1"]',
      },
      {
        id: "a",
        type: "natural",
        category: "governance",
        severity: "low",
        responseStatus: "pending",
        casualties: 0,
        economicImpact: 0,
        affectedCountries: '["c1"]',
      },
    ]);
    const stats = await createCallerFactory(crisisEventsRouter)(visitorOn(db)).getStatistics({
      timeframe: "all",
      countryId: "c1",
    });
    expect(stats).toMatchObject({ activeEvents: 1, criticalEvents: 1, activeCriticalEvents: 0 });
    expect(db.crisisEvent.findMany.mock.calls[0][0].where.timestamp).toBeUndefined();
    // The database narrows first with a contains prefilter on the stored string.
    expect(db.crisisEvent.findMany.mock.calls[0][0].where).toMatchObject({
      affectedCountries: { contains: "c1" },
    });
  });
});

describe("vitality scores and the World Census", () => {
  it("shows a missing diplomatic record and efficiency as null (—) and averages only the known scores", () => {
    expect(scoreDiplomaticStanding(emptyDiplomaticStandingInputs())).toBeNull();
    const scores = calculateVitalityScores({
      currentGdpPerCapita: 25000,
      adjustedGdpGrowth: 0.02,
      populationGrowthRate: 0.01,
      populationDensity: 100,
      economicTier: "Developed",
    } as never);
    expect(scores.diplomaticStanding).toBeNull();
    expect(scores.governmentalEfficiency).toBeNull();
    expect(scores.overallScore).toBe(
      Math.round((scores.economicVitality + scores.populationWellbeing) / 2)
    );
  });

  it("ranks every category that has a value, with debt and inequality lower-is-better", () => {
    const row = (id: string, values: Record<string, number | null>, region = "North") => ({
      id,
      region,
      economicTier: "Developed",
      populationTier: "3",
      values,
    });
    const byCategory = Object.fromEntries(
      rankCensus("me", [
        row("me", {
          "Public Approval": 70,
          "Debt to GDP": 40,
          "Income Equality": 0.3,
          "Diplomatic Standing": 55,
        }),
        row("x", {
          "Public Approval": 80,
          "Debt to GDP": 90,
          "Income Equality": 0.25,
          "Diplomatic Standing": null,
        }),
        row(
          "y",
          {
            "Public Approval": 60,
            "Debt to GDP": 20,
            "Income Equality": 0.5,
            "Diplomatic Standing": 70,
          },
          "South"
        ),
      ]).map((r) => [r.category, r])
    );
    expect(byCategory["Public Approval"]).toMatchObject({
      global: { position: 2, total: 3 },
      regional: { position: 2, total: 2, region: "North" },
      value: 70,
    });
    expect(byCategory["Debt to GDP"]).toMatchObject({
      global: { position: 2, total: 3 },
      lowerIsBetter: true,
    });
    expect(byCategory["Income Equality"]!.global).toEqual({ position: 2, total: 3 });
    // A country with no diplomatic record is left out of that ranking, not ranked as 0.
    expect(byCategory["Diplomatic Standing"]!.global).toEqual({ position: 2, total: 2 });
  });

  it("builds the World Census from stored stats within the country's realm", async () => {
    const realmCountries = [
      {
        id: "c_census",
        region: "North",
        currentGdpPerCapita: 30000,
        currentPopulation: 5e6,
        currentTotalGdp: 1.5e11,
        adjustedGdpGrowth: 0.04,
        populationGrowthRate: 0.01,
        publicApproval: 62,
        totalDebtGDPRatio: 55,
        incomeInequalityGini: 0.32,
        infrastructureRating: 70,
        economicTier: "Developed",
        populationTier: "3",
        stabilityMetrics: { stabilityScore: 58 },
      },
      {
        id: "c_other",
        region: "North",
        currentGdpPerCapita: 50000,
        currentPopulation: 2e6,
        currentTotalGdp: 1e11,
        adjustedGdpGrowth: 0.01,
        populationGrowthRate: 0,
        publicApproval: 40,
        totalDebtGDPRatio: null,
        incomeInequalityGini: 0.4,
        infrastructureRating: 50,
        economicTier: "Developed",
        populationTier: "2",
        stabilityMetrics: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(realmCountries);
    Object.assign(mockedDb as unknown as Record<string, unknown>, {
      country: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c_census",
          realmId: "r_eurth",
          adjustedGdpGrowth: 0.04,
          populationGrowthRate: 0.01,
        }),
        findMany,
      },
      diplomaticRelation: {
        findMany: jest.fn(async () => [
          { country1: "c_census", country2: "c_other", strength: 75 },
        ]),
      },
      embassy: { findMany: jest.fn(async () => []) },
      allianceMember: { findMany: jest.fn(async () => []) },
      treaty: { findMany: jest.fn(async () => []) },
      foreignPolicyAction: { findMany: jest.fn(async () => []) },
      // Infrastructure ranks by the effective rating (soft-score loader, realm clock)
      governmentComponent: { findMany: jest.fn(async () => []) },
      budgetAllocation: { findMany: jest.fn(async () => []) },
      realm: { findUnique: jest.fn(async () => null) },
      systemConfig: { findUnique: jest.fn(async () => null) },
    });

    const rankings = await generateRankings("c_census");
    const get = (c: string) => rankings.find((r) => r.category === c)!;

    expect(findMany.mock.calls[0][0].where).toMatchObject({ realmId: "r_eurth" });
    expect(rankings.map((r) => r.category)).toEqual([
      "GDP per Capita",
      "Total GDP",
      "GDP Growth",
      "Population",
      "Public Approval",
      "Stability",
      "Diplomatic Standing",
      "Infrastructure",
      "Debt to GDP",
      "Income Equality",
    ]);
    expect(get("GDP per Capita").global.position).toBe(2);
    expect(get("Total GDP").global.position).toBe(1);
    expect(get("Stability").global).toEqual({ position: 1, total: 1 });
    expect(get("Debt to GDP").global).toEqual({ position: 1, total: 1 });
    expect(get("Diplomatic Standing").value).toBe(75);
    expect(get("GDP per Capita").trend).toBe("improving");
    expect(get("Public Approval").trend).toBeUndefined();
  });
});
