/** @jest-environment node */
/** The admin's name evidence, the legacy name search and the claims queue (IxnayID design decision 4, plan A Task 6). */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  evidenceForNames,
  findLinkTargets,
  listClaimQueue,
  searchLegacyNames,
} from "~/server/modules/identity/identity.name-search";
import { fetchClassicWikiUsers } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

let db: MemoryPrisma;
let articleId: string;

const revision = (author: string, source = "ixwiki") =>
  db.wikiRevision.create({ data: { articleId, author, wikitext: "", source } });

const entry = (
  date: string,
  type: string,
  winnerUser: string | null,
  runnerUpUser: string | null
) => db.lorewardEntry.create({ data: { date, type, winnerUser, runnerUpUser } });

const claim = (
  id: string,
  userId: string,
  name: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  at: { createdAt: Date; decidedAt?: Date; evidence?: string }
) =>
  db.wikiNameClaim.create({
    data: { id, userId, name, status, origin: "PLAYER", requestedById: userId, ...at },
  });

const day = (d: number) => new Date(Date.UTC(2026, 9, d));

beforeEach(async () => {
  db = createMemoryPrisma();
  await db.realm.create({ data: { id: "r1", slug: "r1", name: "Realm", ownerId: "user_p1" } });
  await db.country.create({
    data: {
      id: "c1",
      realmId: "r1",
      name: "Aurelia",
      slug: "aurelia",
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      maxGdpGrowthRate: 0,
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      currentPopulation: 1,
      currentGdpPerCapita: 1,
      currentTotalGdp: 1,
      baselineDate: new Date(Date.UTC(2040, 0, 1)),
      economicTier: "Developing",
      populationTier: "Micro",
    },
  });
  await db.user.create({
    data: { id: "p1", clerkUserId: "user_p1", handle: "pone", countryId: "c1" },
  });
  await db.user.create({ data: { id: "p2", clerkUserId: "user_p2", forumUsername: "Second" } });
  articleId = (await db.wikiArticle.create({ data: { title: "Page", wikitext: "" } })).id;
});

describe("searchLegacyNames", () => {
  it("gathers names from revisions, Loreward stats and places, and MediaWiki, normalised and sorted", async () => {
    await revision("Rev_only");
    await revision("Rev only");
    await revision("wikios>alpha only");
    await revision("Sister only", "iiwiki");
    await db.lorewardUserStats.create({ data: { username: "Stats only", totalScore: 5 } });
    await entry("2026-10-01", "daily", "Winner only", "runner_only");
    const fetchClassicUsers = jest
      .fn()
      .mockResolvedValue([{ name: "Classic only", editCount: 40 }]);

    const found = await searchLegacyNames(db, { fetchClassicUsers }, "ONLY", 20);

    expect(found.map((e) => e.name)).toEqual([
      "Classic only",
      "Rev only",
      "Runner only",
      "Stats only",
      "Winner only",
    ]);
    expect(fetchClassicUsers).toHaveBeenCalledWith("ONLY", 20);
    expect(found.find((e) => e.name === "Classic only")?.classicEdits).toBe(40);
    expect(found.find((e) => e.name === "Rev only")).toMatchObject({
      wikiosEdits: 2,
      classicEdits: null,
    });
    expect(found.find((e) => e.name === "Stats only")?.lorewards?.totalScore).toBe(5);
  });

  it("cuts the sorted names to the limit", async () => {
    for (const author of ["Cc name", "Aa name", "Bb name"]) await revision(author);
    const fetchClassicUsers = jest.fn().mockResolvedValue([]);
    const found = await searchLegacyNames(db, { fetchClassicUsers }, "name", 2);
    expect(found.map((e) => e.name)).toEqual(["Aa name", "Bb name"]);
  });

  it("still answers from the other sources when MediaWiki fails, with no classic edits", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await revision("Foo bar");
    const fetchClassicUsers = jest.fn().mockRejectedValue(new Error("ixwiki did not answer"));

    const found = await searchLegacyNames(db, { fetchClassicUsers }, "foo", 20);

    expect(found).toEqual([expect.objectContaining({ name: "Foo bar", classicEdits: null })]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("evidenceForNames", () => {
  it("counts edits under both spellings, Lorewards standing, imported groups, blocks in force and the claims", async () => {
    for (const author of ["Foo bar", "Foo_bar", "Foo bar", "wikios>foo_bar"])
      await revision(author);
    await revision("Foo bar", "iiwiki");
    await db.lorewardUserStats.create({
      data: { username: "Foo bar", totalScore: 12, dailyWins: 2, weeklyWins: 1 },
    });
    await entry("2026-10-01", "daily", "Foo bar", "Baz");
    await entry("2026-W40", "weekly", "Someone", "Foo_bar");
    await db.wikiUserGroup.create({
      data: { wikiUsername: "Foo bar", group: "sysop", source: "mw-import" },
    });
    await db.wikiUserGroup.create({
      data: { wikiUsername: "Foo bar", group: "rollbacker", expiresAt: day(1) },
    });
    await db.wikiBlock.create({ data: { wikiUsername: "Foo bar", expiresAt: day(1) } });
    await db.wikiBlock.create({ data: { wikiUsername: "Baz", expiresAt: null } });
    await claim("k1", "p1", "Foo bar", "APPROVED", { createdAt: day(2), decidedAt: day(3) });
    await claim("k2", "p2", "Baz", "PENDING", { createdAt: day(2) });

    const evidence = await evidenceForNames(db, ["foo_bar", "Baz"]);

    expect(evidence.get("Foo bar")).toEqual({
      name: "Foo bar",
      wikiosEdits: 3,
      lorewards: { totalScore: 12, dailyWins: 2, weeklyWins: 1, monthlyWins: 0, places: 2 },
      importedGroups: ["sysop"],
      blocked: false,
      owner: { userId: "p1", handle: "pone" },
      pendingClaims: 0,
      classicEdits: null,
    });
    expect(evidence.get("Baz")).toEqual({
      name: "Baz",
      wikiosEdits: 0,
      lorewards: { totalScore: 0, dailyWins: 0, weeklyWins: 0, monthlyWins: 0, places: 1 },
      importedGroups: [],
      blocked: true,
      owner: null,
      pendingClaims: 1,
      classicEdits: null,
    });
  });

  it("answers nothing for no names, and no Lorewards for a name with no standing", async () => {
    expect((await evidenceForNames(db, [])).size).toBe(0);
    expect((await evidenceForNames(db, ["Nobody"])).get("Nobody")?.lorewards).toBeNull();
  });
});

describe("listClaimQueue", () => {
  beforeEach(async () => {
    await revision("Old two");
    await claim("k-new", "p2", "Old two", "PENDING", { createdAt: day(5) });
    await claim("k-old", "p1", "Old one", "PENDING", {
      createdAt: day(1),
      evidence: "My alt made these",
    });
    await claim("k-a", "p1", "Done a", "APPROVED", { createdAt: day(1), decidedAt: day(2) });
    await claim("k-b", "p2", "Done b", "APPROVED", { createdAt: day(1), decidedAt: day(4) });
  });

  it("lists pending claims oldest first with the account and the name's evidence, paged by id", async () => {
    const first = await listClaimQueue(db, { status: "PENDING", cursor: null, limit: 1 });
    expect(first.nextCursor).toBe("k-old");
    expect(first.items).toEqual([
      expect.objectContaining({
        id: "k-old",
        name: "Old one",
        status: "PENDING",
        account: { userId: "p1", handle: "pone", clerkUserId: "user_p1", countryName: "Aurelia" },
        playerEvidence: "My alt made these",
        evidence: expect.objectContaining({ name: "Old one", wikiosEdits: 0, pendingClaims: 1 }),
      }),
    ]);
    const second = await listClaimQueue(db, { status: "PENDING", cursor: "k-old", limit: 1 });
    expect(second.nextCursor).toBeNull();
    expect(second.items[0]).toMatchObject({
      id: "k-new",
      account: { userId: "p2", handle: null, clerkUserId: "user_p2", countryName: null },
      playerEvidence: null,
      evidence: { wikiosEdits: 1 },
    });
    expect(second.items[0]).not.toHaveProperty("user");
  });

  it("lists decided claims newest decision first", async () => {
    const page = await listClaimQueue(db, { status: "APPROVED", cursor: null, limit: 25 });
    expect(page.items.map((i) => i.id)).toEqual(["k-b", "k-a"]);
    expect(page.items[0]?.evidence.owner).toEqual({ userId: "p2", handle: null });
  });
});

describe("findLinkTargets", () => {
  it("finds accounts by handle, forum name, country name and exact ids", async () => {
    const ids = async (q: string) => (await findLinkTargets(db, q)).map((t) => t.userId);
    expect(await findLinkTargets(db, "@PON")).toEqual([
      { userId: "p1", handle: "pone", clerkUserId: "user_p1", countryName: "Aurelia" },
    ]);
    expect(await ids("secon")).toEqual(["p2"]);
    expect(await ids("aurel")).toEqual(["p1"]);
    expect(await ids("user_p2")).toEqual(["p2"]);
    expect(await ids("p1")).toEqual(["p1"]);
    expect(await ids("user_p")).toEqual([]);
    expect(await ids("  ")).toEqual([]);
  });

  it("returns ten accounts at most", async () => {
    for (let i = 0; i < 12; i++)
      await db.user.create({ data: { clerkUserId: `user_x${i}`, handle: `many_${i}` } });
    expect(await findLinkTargets(db, "many")).toHaveLength(10);
  });
});

describe("fetchClassicWikiUsers", () => {
  it("reads MediaWiki's user list by prefix with the allowlisted user agent", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          batchcomplete: true,
          query: {
            allusers: [
              { userid: 49, name: "Foo bar", editcount: 321 },
              { userid: 50, name: "Foo baz" },
            ],
          },
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } }
      )
    );

    await expect(fetchClassicWikiUsers("foo_b", 5)).resolves.toEqual([
      { name: "Foo bar", editCount: 321 },
      { name: "Foo baz", editCount: null },
    ]);

    const [url, init] = fetchSpy.mock.calls[0]!;
    const params = new URL(String(url)).searchParams;
    expect(params.get("list")).toBe("allusers");
    expect(params.get("auprefix")).toBe("Foo b");
    expect(params.get("aulimit")).toBe("5");
    expect(params.get("auprop")).toBe("editcount");
    expect(new Headers(init?.headers).get("User-Agent")).toBe("IxStats-Builder");
    fetchSpy.mockRestore();
  });
});
