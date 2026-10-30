/** @jest-environment node */
/**
 * The league creator's wiki step: `createLeague` takes the league's wiki article and the clubs imported from it (their
 * count must match `teamCount`), and `previewWikiTeams` reads the article's IxWiki wikitext and returns its teams.
 * `updateLeague` stores a changed wiki article in the same slug form `createLeague` does.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
const mockWikitext = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: (...args: unknown[]) => mockWikitext(...args),
}));
const mockAssertVisible = jest.fn();
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  assertTitleVisible: (...args: unknown[]) => mockAssertVisible(...args),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { leaguesCrudRouter } from "~/server/api/routers/sports/leagues/crud";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { addPerson, asPerson, sovereignsOf, type Person } from "~/tests/helpers/sports-world";

const leagues = createCallerFactory(leaguesCrudRouter);

let db: MemoryPrisma;
let dev: Person;
const as = () => asPerson(db as never, dev);

beforeEach(async () => {
  db = createMemoryPrisma();
  db.store.onRaw(/FROM "exchange_wallets" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  mockDb = db;
  dev = await addPerson(db as never, "dev", 5000);
  mockWikitext.mockReset();
  mockAssertVisible.mockReset();
});

const base = { name: "Varro League", sportPreset: "hockey", settings: {} };

describe("createLeague with imported teams", () => {
  it("names the clubs after the imported teams and saves the league's wiki article", async () => {
    const result = await leagues(as()).createLeague({
      ...base,
      teamCount: 2,
      wikiSlug: "Varro_League",
      teams: [
        { name: "Varro", wikiSlug: "FC_Varro" },
        { name: "Lest", wikiSlug: null },
      ],
    });

    expect(result.wikiSlug).toBe("Varro_League");
    expect(result.teams.map((t) => [t.name, t.wikiSlug])).toEqual([
      ["Varro", "FC_Varro"],
      ["Lest", null],
    ]);
    expect(result.teams.map((t) => t.shortName)).toEqual(["VAR1", "LES2"]);
    expect(await db.sportCoach.count()).toBe(2);
  });

  it("refuses teams whose count differs from teamCount and creates and charges nothing", async () => {
    await expect(
      leagues(as()).createLeague({
        ...base,
        teamCount: 3,
        teams: [{ name: "Varro", wikiSlug: null }],
        requestId: "press-0001",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await db.sportLeague.count()).toBe(0);
    expect(await db.exchangeTransaction.count()).toBe(0);
    expect((await sovereignsOf(db as never, [dev.id]))[dev.id]).toBe(5000);
  });

  it("stores no file or category page as a league or club article", async () => {
    const result = await leagues(as()).createLeague({
      ...base,
      teamCount: 2,
      wikiSlug: "Category:Varro League",
      teams: [
        { name: "Varro", wikiSlug: "File:Crest.png" },
        { name: "Lest", wikiSlug: "Lest FC" },
      ],
    });

    expect(result.wikiSlug).toBeNull();
    expect(result.teams.map((t) => t.wikiSlug)).toEqual([null, "Lest_FC"]);
  });

  it("still makes placeholder clubs when no teams are given", async () => {
    const result = await leagues(as()).createLeague({ ...base, teamCount: 2 });

    expect(result.teams.map((t) => t.name)).toEqual(["Varro League Team 1", "Varro League Team 2"]);
    expect(result.wikiSlug).toBeNull();
  });
});

describe("updateLeague's wiki article", () => {
  async function league() {
    return leagues(as()).createLeague({ ...base, teamCount: 2, wikiSlug: "Varro_League" });
  }

  it("stores a new article title as a slug: trimmed, spaces as underscores", async () => {
    const { id } = await league();

    const updated = await leagues(as()).updateLeague({ id, wikiSlug: "  Varro Premier League " });

    expect(updated.wikiSlug).toBe("Varro_Premier_League");
  });

  it("stores no file or category page, and clears the article on null", async () => {
    const { id } = await league();

    expect(
      (await leagues(as()).updateLeague({ id, wikiSlug: "File:Crest.png" })).wikiSlug
    ).toBeNull();
    await leagues(as()).updateLeague({ id, wikiSlug: "Varro_League" });
    expect((await leagues(as()).updateLeague({ id, wikiSlug: null })).wikiSlug).toBeNull();
  });

  it("leaves the article alone when the update does not name one", async () => {
    const { id } = await league();

    expect((await leagues(as()).updateLeague({ id, name: "Varro Cup" })).wikiSlug).toBe(
      "Varro_League"
    );
  });

  it("refuses a slug over 500 characters", async () => {
    const { id } = await league();

    await expect(
      leagues(as()).updateLeague({ id, wikiSlug: "A".repeat(501) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("previewWikiTeams", () => {
  it("returns the teams of the league article after checking the page is visible", async () => {
    mockWikitext.mockResolvedValue({ wikitext: "== Teams ==\n* [[FC Varro|Varro]]\n* [[Lest]]" });

    const teams = await leagues(as()).previewWikiTeams({ wikiSlug: "Varro_League" });

    expect(mockAssertVisible).toHaveBeenCalledWith(expect.anything(), "Varro_League", "ixwiki");
    expect(mockWikitext).toHaveBeenCalledWith("Varro_League", "ixwiki");
    expect(teams).toEqual([
      { name: "Varro", wikiSlug: "FC_Varro" },
      { name: "Lest", wikiSlug: "Lest" },
    ]);
  });

  it("returns no teams for a page that does not exist", async () => {
    mockWikitext.mockResolvedValue(null);

    expect(await leagues(as()).previewWikiTeams({ wikiSlug: "Nowhere" })).toEqual([]);
  });

  it("needs a signed-in caller", async () => {
    const anonymous = leagues(createMockRouterContext({ auth: null, user: null }) as never);

    await expect(anonymous.previewWikiTeams({ wikiSlug: "Varro_League" })).rejects.toThrow(
      /sign in/i
    );
    expect(mockWikitext).not.toHaveBeenCalled();
  });
});
