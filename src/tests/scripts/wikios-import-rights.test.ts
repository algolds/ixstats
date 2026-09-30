/** @jest-environment node */
// Plan 409: the one-time MediaWiki rights import. Pure mapping, the throttled API client and the paged
// readers run against mocked API responses (nothing here contacts a wiki); applyPlan runs against an
// in-memory fake of the WikiOS tables.
import type { PrismaClient } from "@prisma/client";
import {
  MIN_INTERVAL_MS,
  applyPlan,
  buildPlan,
  collectAll,
  createApiClient,
  databaseHost,
  mapBlocks,
  mapGroups,
  mapProtectedTitles,
  mapProtections,
  parseAllPages,
  parseAllUsers,
  parseArgs,
  parseBlocks,
  parseExpiry,
  parseInfo,
  parseNamespaceIds,
  parseProtectedTitles,
  type ApiGet,
  type ImportPlan,
} from "../../../scripts/wikios-import-rights";
import { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const NOW = new Date("2026-09-30T12:00:00Z");
const FUTURE = "2027-01-01T00:00:00Z";
const PAST = "2026-01-01T00:00:00Z";

describe("parseExpiry", () => {
  it.each([undefined, "infinity", "infinite", "indefinite", "never", "Infinity"])(
    "%p is no expiry",
    (value) => {
      expect(parseExpiry(value)).toBeNull();
    }
  );

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
        cascade: true,
        reason: "Imported from MediaWiki",
      },
      {
        title: "Template:Infobox country",
        action: "move",
        level: "autoconfirmed",
        expiresAt: new Date(FUTURE),
        cascade: false,
        reason: "Imported from MediaWiki",
      },
      {
        title: "File:Flag.png",
        action: "upload",
        level: "sysop",
        expiresAt: null,
        cascade: false,
        reason: "Imported from MediaWiki",
      },
    ]);
    expect(notes).toEqual([]);
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
        cascade: false,
        reason: "Imported from MediaWiki: repeated spam",
      },
      {
        title: "Semi",
        action: "create",
        level: "autoconfirmed",
        expiresAt: new Date(FUTURE),
        cascade: false,
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

describe("response parsing", () => {
  it("reads each listing and its continuation, and treats a missing query as empty", () => {
    expect(
      parseAllUsers({
        continue: { aufrom: "Z", continue: "-||" },
        query: { allusers: [{ name: "A", groups: ["sysop"] }] },
      })
    ).toEqual({
      items: [{ name: "A", groups: ["sysop"] }],
      next: { aufrom: "Z", continue: "-||" },
    });
    expect(parseAllUsers({ batchcomplete: true })).toEqual({ items: [], next: undefined });
    expect(
      parseAllPages({ query: { allpages: [{ pageid: 1, ns: 0, title: "Main Page" }] } }).items
    ).toEqual(["Main Page"]);
    expect(
      parseInfo({
        query: {
          pages: [
            { title: "A", protection: [{ type: "edit", level: "sysop", expiry: "infinity" }] },
            { title: "B", missing: true },
          ],
        },
      })
    ).toEqual([
      { title: "A", protection: [{ type: "edit", level: "sysop", expiry: "infinity" }] },
      { title: "B", protection: [] },
    ]);
    expect(
      parseProtectedTitles({
        query: { protectedtitles: [{ ns: 0, title: "T", level: "sysop", expiry: "infinity" }] },
      }).items
    ).toHaveLength(1);
    expect(
      parseBlocks({
        query: { blocks: [{ user: "U", userid: 1, expiry: "infinity", partial: false }] },
      }).items
    ).toHaveLength(1);
  });

  it("lists the real namespace ids, without Special and Media", () => {
    expect(
      parseNamespaceIds({
        query: {
          namespaces: {
            "-2": { id: -2 },
            "-1": { id: -1 },
            "0": { id: 0 },
            "828": { id: 828 },
            "10": { id: 10 },
          },
        },
      })
    ).toEqual([0, 10, 828]);
  });

  it("turns an API error object into a thrown Error", () => {
    expect(() =>
      parseAllUsers({ error: { code: "badvalue", info: "Unrecognized value" } })
    ).toThrow("badvalue");
  });

  it("refuses a response of the wrong shape", () => {
    expect(() => parseBlocks({ query: { blocks: "nope" } })).toThrow();
  });
});

describe("collectAll", () => {
  it("follows continuation parameters until the listing ends", async () => {
    const calls: Array<Record<string, string>> = [];
    const get: ApiGet = async (params) => {
      calls.push(params);
      return params.aufrom
        ? { query: { allusers: [{ name: "B", groups: [] }] } }
        : {
            continue: { aufrom: "B", continue: "-||" },
            query: { allusers: [{ name: "A", groups: [] }] },
          };
    };
    const users = await collectAll(get, { list: "allusers" }, parseAllUsers);
    expect(users.map((u) => u.name)).toEqual(["A", "B"]);
    expect(calls).toEqual([
      { list: "allusers" },
      { list: "allusers", aufrom: "B", continue: "-||" },
    ]);
  });

  it("gives up on a listing that never ends", async () => {
    const get: ApiGet = async () => ({ continue: { aufrom: "again" }, query: { allusers: [] } });
    await expect(collectAll(get, { list: "allusers" }, parseAllUsers)).rejects.toThrow(
      "did not finish"
    );
  });
});

describe("createApiClient", () => {
  const response = (body: object, ok = true) =>
    ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;

  it("asks with the allowlisted UA, JSON formatversion 2 and the given parameters", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ query: {} }));
    const get = createApiClient("https://wiki.example/api.php", {
      fetchImpl,
      sleep: async () => {},
    });

    await get({ list: "blocks", bklimit: "max" });

    const [url, init] = fetchImpl.mock.calls[0] as [URL, { headers: Record<string, string> }];
    expect(url.origin + url.pathname).toBe("https://wiki.example/api.php");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "query",
      format: "json",
      formatversion: "2",
      list: "blocks",
      bklimit: "max",
    });
    expect(init.headers["User-Agent"]).toBe("IxStats-Builder");
    // read-only: a plain GET, nothing sent in a body
    expect(init).not.toHaveProperty("method");
    expect(init).not.toHaveProperty("body");
  });

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

  it("throws on an HTTP error", async () => {
    const get = createApiClient("https://wiki.example/api.php", {
      fetchImpl: jest.fn().mockResolvedValue(response({}, false)),
      sleep: async () => {},
    });
    await expect(get({})).rejects.toThrow("503");
  });
});

describe("buildPlan", () => {
  /** A scripted wiki: answers by the listing the parameters ask for. */
  const wiki = (
    overrides: { protectedTitles?: number } = {}
  ): { get: ApiGet; calls: Array<Record<string, string>> } => {
    const calls: Array<Record<string, string>> = [];
    const manyPages = Array.from({ length: 51 }, (_, i) => ({ title: `Page ${i}` }));
    const get: ApiGet = async (params) => {
      calls.push(params);
      if (params.meta === "siteinfo")
        return { query: { namespaces: { "-1": { id: -1 }, "0": { id: 0 }, "10": { id: 10 } } } };
      if (params.list === "allusers") {
        return {
          query: {
            allusers:
              params.augroup === "sysop"
                ? [{ name: "kir", groups: ["sysop", "bureaucrat"] }]
                : params.augroup === "bot"
                  ? [{ name: "Helper", groups: ["bot"] }]
                  : [],
          },
        };
      }
      if (params.list === "allpages") {
        return {
          query: {
            allpages:
              params.apnamespace === "0"
                ? manyPages
                : params.apnamespace === "10"
                  ? [{ title: "Template:Infobox" }]
                  : [],
          },
        };
      }
      if (params.prop === "info") {
        return {
          query: {
            pages: (params.titles ?? "").split("|").map((title) => ({
              title,
              protection: [
                {
                  type: "edit",
                  level: title === "Template:Infobox" ? "sysop" : "autoconfirmed",
                  expiry: "infinity",
                },
              ],
            })),
          },
        };
      }
      if (params.list === "protectedtitles") {
        return {
          query: {
            protectedtitles: overrides.protectedTitles
              ? [{ title: "Salted", level: "sysop", expiry: "infinity" }]
              : [],
          },
        };
      }
      if (params.list === "blocks") {
        return {
          query: {
            blocks: [
              {
                user: "Vandal",
                userid: 4,
                expiry: "infinity",
                reason: "spam",
                allowusertalk: true,
              },
              { user: "9.9.9.9" },
            ],
          },
        };
      }
      throw new Error(`unexpected request ${JSON.stringify(params)}`);
    };
    return { get, calls };
  };

  it("reads every listing and maps it", async () => {
    const { get, calls } = wiki({ protectedTitles: 1 });
    const plan = await buildPlan(get, NOW);

    expect(plan.groups).toEqual([
      { wikiUsername: "Kir", group: "sysop" },
      { wikiUsername: "Kir", group: "bureaucrat" },
      { wikiUsername: "Helper", group: "bot" },
    ]);
    expect(plan.restrictions.filter((r) => r.action === "edit")).toHaveLength(52);
    expect(plan.restrictions.find((r) => r.title === "Template:Infobox")).toMatchObject({
      level: "sysop",
    });
    expect(plan.restrictions.find((r) => r.action === "create")).toMatchObject({
      title: "Salted",
      level: "sysop",
    });
    expect(plan.blocks).toEqual([
      { wikiUsername: "Vandal", reason: "spam", expiresAt: null, allowUserTalk: true },
    ]);
    expect(plan.notes).toEqual(["Skipped 1 block(s) on IP addresses or ranges."]);

    // the four imported groups are each asked for; Special and Media are never listed; 52 titles go out in batches of 50
    expect(calls.filter((c) => c.list === "allusers").map((c) => c.augroup)).toEqual([
      "sysop",
      "bureaucrat",
      "interface-admin",
      "bot",
    ]);
    expect(calls.filter((c) => c.list === "allpages").map((c) => c.apnamespace)).toEqual([
      "0",
      "10",
    ]);
    expect(calls.filter((c) => c.prop === "info").map((c) => c.titles?.split("|").length)).toEqual([
      50, 2,
    ]);
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
        cascade: false,
        reason: "Imported from MediaWiki",
      },
      {
        title: "Salted",
        action: "create",
        level: "sysop",
        expiresAt: null,
        cascade: false,
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
    fake.tables.wikiAccountLink.seed(
      {
        userId: "dbkir",
        source: "ixwiki",
        username: "Kir",
        verifiedAt: new Date("2026-01-01"),
        verifiedById: null,
      },
      {
        userId: "dbpending",
        source: "ixwiki",
        username: "Pending",
        verifiedAt: null,
        verifiedById: null,
      }
    );
    fake.tables.wikiArticle.seed({ source: "ixwiki", title: "Caphiria" });
    return { fake, prisma: fake.db as unknown as PrismaClient };
  };

  it("stores a verified username's rows against the user, and any other against the wiki username", async () => {
    const { fake, prisma } = setup();
    const result = await applyPlan(prisma, plan());

    expect(result).toEqual({ groups: 2, restrictions: 2, blocks: 2 });
    const groups = fake.tables.wikiUserGroup.rows;
    expect(groups.find((g) => g.group === "sysop")).toMatchObject({
      userId: "dbkir",
      source: "mw-import",
    });
    expect(groups.find((g) => g.group === "sysop")).not.toHaveProperty("wikiUsername");
    expect(groups.find((g) => g.group === "bureaucrat")).toMatchObject({
      wikiUsername: "Pending",
      source: "mw-import",
    });
    expect(groups.find((g) => g.group === "bureaucrat")).not.toHaveProperty("userId");

    const blocks = fake.tables.wikiBlock.rows;
    expect(blocks.find((b) => b.wikiUsername === "Kir")).toMatchObject({
      userId: "dbkir",
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

  it("leaves a name whose link an admin confirmed keyed by wiki username, so the admin's link inherits nothing", async () => {
    const { fake, prisma } = setup();
    fake.tables.wikiAccountLink.rows.find((link) => link.username === "Kir")!.verifiedById =
      "dbadmin";

    await applyPlan(prisma, plan());

    const sysop = fake.tables.wikiUserGroup.rows.find((g) => g.group === "sysop");
    expect(sysop).toMatchObject({ wikiUsername: "Kir", source: "mw-import" });
    expect(sysop).not.toHaveProperty("userId");
    const block = fake.tables.wikiBlock.rows.find((b) => b.wikiUsername === "Kir");
    expect(block?.userId).toBeNull();
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
  it("needs --api, which must be an http(s) URL", () => {
    expect(() => parseArgs([])).toThrow("--api");
    expect(() => parseArgs(["--api", "ixwiki.com/api.php"])).toThrow("--api");
    expect(parseArgs(["--api", "https://ixwiki.com/api.php"])).toEqual({
      api: "https://ixwiki.com/api.php",
      yes: false,
    });
  });

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
