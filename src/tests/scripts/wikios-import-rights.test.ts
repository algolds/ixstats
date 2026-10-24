/** @jest-environment node */
// Plan 409: the one-time MediaWiki rights import. Pure mapping, the throttled API client and the paged
// readers run against mocked API responses (nothing here contacts a wiki); applyPlan runs against an
// in-memory fake of the WikiOS tables.
import type { PrismaClient } from "@prisma/client";
import {
  MIN_INTERVAL_MS,
  applyPlan,
  createApiClient,
  databaseHost,
  mapBlocks,
  mapGroups,
  mapProtectedTitles,
  mapProtections,
  parseArgs,
  parseExpiry,
  type ImportPlan,
} from "../../../scripts/wikios-import-rights";
import { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const NOW = new Date("2026-09-30T12:00:00Z");
const FUTURE = "2027-01-01T00:00:00Z";
const PAST = "2026-01-01T00:00:00Z";

describe("parseExpiry", () => {
  it.each([undefined, "infinity", "indefinite"])("%p is no expiry", (value) => {
    expect(parseExpiry(value)).toBeNull();
  });

  it("reads an ISO timestamp and refuses gibberish", () => {
    expect(parseExpiry(FUTURE)).toEqual(new Date(FUTURE));
    expect(() => parseExpiry("next tuesday")).toThrow("Unreadable expiry");
  });
});

describe("mapGroups", () => {
  it("keeps the imported groups, normalizes names, and gives a multi-group user one grant each", () => {
    const grants = mapGroups([
      { name: "kir", groups: ["*", "user", "autoconfirmed", "bureaucrat", "sysop"] },
      { name: "Some_bot", groups: ["bot", "suppress", "checkuser"] },
      { name: "Kir", groups: ["sysop"] },
    ]);
    expect(grants).toEqual([
      { wikiUsername: "Kir", group: "bureaucrat" },
      { wikiUsername: "Kir", group: "sysop" },
      { wikiUsername: "Some bot", group: "bot" },
    ]);
  });

  it("returns nothing for users in no imported group", () => {
    expect(mapGroups([{ name: "Plain", groups: ["*", "user"] }])).toEqual([]);
  });
});

describe("mapProtections", () => {
  const page = (title: string, protection: object[]) => ({ title, protection }) as never;

  it("maps a page's own edit, move and upload protections to canonical titles", () => {
    const notes: string[] = [];
    const rows = mapProtections(
      [
        page("template:infobox country", [
          { type: "edit", level: "sysop", expiry: "infinity", cascade: true },
          { type: "move", level: "autoconfirmed", expiry: FUTURE },
        ]),
        page("File:Flag.png", [{ type: "upload", level: "sysop" }]),
      ],
      NOW,
      notes
    );
    expect(rows).toEqual([
      {
        title: "Template:Infobox country",
        action: "edit",
        level: "sysop",
        expiresAt: null,
        reason: "Imported from MediaWiki",
      },
      {
        title: "Template:Infobox country",
        action: "move",
        level: "autoconfirmed",
        expiresAt: new Date(FUTURE),
        reason: "Imported from MediaWiki",
      },
      {
        title: "File:Flag.png",
        action: "upload",
        level: "sysop",
        expiresAt: null,
        reason: "Imported from MediaWiki",
      },
    ]);
    // a cascade flag is not stored (it is not enforced yet), and the operator is told
    expect(notes).toEqual([
      "Template:Infobox country (edit): cascade protection is not supported yet; imported as plain protection.",
    ]);
  });

  it("skips expired protections, inherited cascade protection and types it does not import", () => {
    const rows = mapProtections(
      [
        page("Old", [{ type: "edit", level: "sysop", expiry: PAST }]),
        page("Child", [
          { type: "edit", level: "sysop", expiry: "infinity", cascade: true, source: "Parent" },
        ]),
        page("Other", [
          { type: "create", level: "sysop" },
          { type: "weird", level: "sysop" },
        ]),
      ],
      NOW,
      []
    );
    expect(rows).toEqual([]);
  });

  it("tightens a level it has no counterpart for to sysop and says so", () => {
    const notes: string[] = [];
    const rows = mapProtections(
      [page("Page", [{ type: "edit", level: "templateeditor" }])],
      NOW,
      notes
    );
    expect(rows[0]).toMatchObject({ level: "sysop" });
    expect(notes).toEqual([
      'Page (edit): MediaWiki level "templateeditor" has no WikiOS counterpart; imported as sysop.',
    ]);
  });

  it("skips a title MediaWiki would refuse, with a note", () => {
    const notes: string[] = [];
    expect(mapProtections([page("a[b", [{ type: "edit", level: "sysop" }])], NOW, notes)).toEqual(
      []
    );
    expect(notes).toEqual(['Skipped "a[b": not a valid page title.']);
  });
});

describe("mapProtectedTitles", () => {
  it("maps create-protections, carrying the comment, and skips expired ones", () => {
    const rows = mapProtectedTitles(
      [
        { title: "user:salted", level: "sysop", expiry: "infinity", comment: "repeated spam" },
        { title: "Old", level: "sysop", expiry: PAST },
        { title: "Semi", level: "autoconfirmed", expiry: FUTURE },
      ],
      NOW,
      []
    );
    expect(rows).toEqual([
      {
        title: "User:Salted",
        action: "create",
        level: "sysop",
        expiresAt: null,
        reason: "Imported from MediaWiki: repeated spam",
      },
      {
        title: "Semi",
        action: "create",
        level: "autoconfirmed",
        expiresAt: new Date(FUTURE),
        reason: "Imported from MediaWiki",
      },
    ]);
  });
});

describe("mapBlocks", () => {
  it("imports blocks on registered users in force, with user-talk access and the reason", () => {
    const notes: string[] = [];
    const rows = mapBlocks(
      [
        { user: "vandal_bob", userid: 7, expiry: "infinity", reason: "spam", allowusertalk: false },
        { user: "Temp", userid: 8, expiry: FUTURE },
        { user: "Expired", userid: 9, expiry: PAST },
      ],
      NOW,
      notes
    );
    expect(rows).toEqual([
      { wikiUsername: "Vandal bob", reason: "spam", expiresAt: null, allowUserTalk: false },
      { wikiUsername: "Temp", reason: null, expiresAt: new Date(FUTURE), allowUserTalk: true },
    ]);
    expect(notes).toEqual([]);
  });

  it("skips IP and partial blocks and says how many", () => {
    const notes: string[] = [];
    const rows = mapBlocks(
      [
        { user: "203.0.113.9" },
        { user: "198.51.100.0/24", userid: 0 },
        { user: "Partial", userid: 3, partial: true },
      ],
      NOW,
      notes
    );
    expect(rows).toEqual([]);
    expect(notes).toEqual([
      "Skipped 2 block(s) on IP addresses or ranges.",
      "Skipped 1 partial (page or namespace) block(s).",
    ]);
  });

  it("truncates a long reason to the column's 500 characters", () => {
    const [row] = mapBlocks([{ user: "A", userid: 1, reason: "x".repeat(900) }], NOW, []);
    expect(row?.reason).toHaveLength(500);
  });
});
describe("createApiClient", () => {
  const response = (body: object, ok = true) =>
    ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;
  it("waits a second between requests, never before the first, and never less even if asked", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({}));
    const sleep = jest.fn().mockResolvedValue(undefined);
    const get = createApiClient("https://wiki.example/api.php", {
      fetchImpl,
      sleep,
      intervalMs: 10,
    });

    await get({});
    expect(sleep).not.toHaveBeenCalled();
    await get({});
    await get({});
    expect(sleep.mock.calls).toEqual([[MIN_INTERVAL_MS], [MIN_INTERVAL_MS]]);
  });
});
describe("applyPlan", () => {
  const plan = (): ImportPlan => ({
    groups: [
      { wikiUsername: "Kir", group: "sysop" },
      { wikiUsername: "Pending", group: "bureaucrat" },
    ],
    restrictions: [
      {
        title: "Caphiria",
        action: "edit",
        level: "sysop",
        expiresAt: new Date(FUTURE),
        reason: "Imported from MediaWiki",
      },
      {
        title: "Salted",
        action: "create",
        level: "sysop",
        expiresAt: null,
        reason: "Imported from MediaWiki",
      },
    ],
    blocks: [
      { wikiUsername: "Kir", reason: "test", expiresAt: null, allowUserTalk: true },
      { wikiUsername: "Stranger", reason: null, expiresAt: null, allowUserTalk: false },
    ],
    notes: [],
  });

  const setup = () => {
    const fake = createFakeWikiDb();
    // Kir's name is claimed (a system owner approved it); the claim connects it to the account at read time
    fake.tables.wikiNameClaim.seed({ userId: "dbkir", name: "Kir", rightsPass: true });
    fake.tables.wikiArticle.seed({ source: "ixwiki", title: "Caphiria" });
    return { fake, prisma: fake.db as unknown as PrismaClient };
  };

  it("keys every group and block by the wiki username alone, claimed or not (claims connect names at read time)", async () => {
    const { fake, prisma } = setup();
    const result = await applyPlan(prisma, plan());

    expect(result).toEqual({ groups: 2, restrictions: 2, blocks: 2 });
    const groups = fake.tables.wikiUserGroup.rows;
    expect(groups.find((g) => g.group === "sysop")).toMatchObject({
      wikiUsername: "Kir",
      source: "mw-import",
    });
    expect(groups.find((g) => g.group === "bureaucrat")).toMatchObject({
      wikiUsername: "Pending",
      source: "mw-import",
    });
    expect(groups.some((g) => "userId" in g)).toBe(false);

    const blocks = fake.tables.wikiBlock.rows;
    expect(blocks.find((b) => b.wikiUsername === "Kir")).toMatchObject({
      userId: null,
      source: "mw-import",
    });
    expect(blocks.find((b) => b.wikiUsername === "Stranger")).toMatchObject({
      userId: null,
      allowUserTalk: false,
    });
  });

  it("writes the restrictions and mirrors the edit level onto the article", async () => {
    const { fake, prisma } = setup();
    await applyPlan(prisma, plan());

    expect(
      fake.tables.wikiRestriction.rows.map((r) => `${r.title}:${r.action}:${r.level}`).sort()
    ).toEqual(["Caphiria:edit:sysop", "Salted:create:sysop"]);
    expect(fake.tables.wikiArticle.rows[0]).toMatchObject({
      protectionLevel: "SYSOP",
      protectionExpiry: new Date(FUTURE),
    });
  });

  it("never reads a claim or a link: whether a name's groups pass is decided when rights are read", async () => {
    const { fake, prisma } = setup();
    const claims = jest.spyOn(fake.db.wikiNameClaim, "findMany");
    const links = jest.spyOn(fake.db.wikiAccountLink, "findMany");

    await applyPlan(prisma, plan());

    expect(claims).not.toHaveBeenCalled();
    expect(links).not.toHaveBeenCalled();
  });

  it("is idempotent, and never overwrites a row WikiOS already has", async () => {
    const { fake, prisma } = setup();
    await applyPlan(prisma, plan());
    fake.tables.wikiRestriction.rows.find((r) => r.title === "Caphiria")!.level = "autoconfirmed";

    await applyPlan(prisma, plan());

    expect(fake.tables.wikiUserGroup.rows).toHaveLength(2);
    expect(fake.tables.wikiRestriction.rows).toHaveLength(2);
    expect(fake.tables.wikiBlock.rows).toHaveLength(2);
    expect(fake.tables.wikiRestriction.rows.find((r) => r.title === "Caphiria")).toMatchObject({
      level: "autoconfirmed",
    });
  });
});

describe("command line", () => {
  it("is a dry run unless --yes, and refuses both", () => {
    expect(parseArgs(["--api", "https://w/api.php", "--dry-run"]).yes).toBe(false);
    expect(parseArgs(["--api", "https://w/api.php", "--yes"]).yes).toBe(true);
    expect(() => parseArgs(["--api", "https://w/api.php", "--yes", "--dry-run"])).toThrow(
      "contradict"
    );
  });

  it("names the database host without its credentials", () => {
    expect(databaseHost("postgresql://user:secret@localhost:5433/ixstats")).toBe("localhost:5433");
    expect(databaseHost("postgresql://user:secret@db.internal/ixstats")).toBe("db.internal:5432");
    expect(databaseHost("not a url")).toBeNull();
    expect(databaseHost(undefined)).toBeNull();
  });
});
