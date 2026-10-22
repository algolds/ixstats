/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/modules/realms/realms.prefill", () => ({
  fetchNationPagePrefill: jest.fn(),
  EMPTY_PREFILL: { country: {}, identity: {} },
}));

import { createHash } from "node:crypto";
import sharp from "sharp";
import { globalCache } from "~/lib/cache";
import { realmsRouter } from "~/server/api/routers/realms";
import { fetchChosenWikiMapOriginal } from "~/server/modules/realms/realms.wiki";
import {
  EURTH_WIKI,
  fakeIiwiki,
  IIWIKI_FIXTURES,
  json,
  type FakeWiki,
} from "~/tests/helpers/iiwiki-fixtures";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { z } from "zod";
import {
  createDiscoveryClient,
  DiscoveryStopped,
} from "~/lib/realms/sources/wiki-discovery-client";
import { discoverRoster } from "~/lib/realms/sources/iiwiki-discovery";
import { loreImportOptions } from "~/lib/realms/lore-import";
import {
  realmWikiMap,
  realmWikiSettings,
  realmWikiSettingsSchema,
  withRealmWikiMap,
  withRealmWikiSettings,
  type RealmWikiMap,
} from "~/lib/realms/realm-wiki-settings";
import {
  crawlRealmCategory,
  loreDowngrades,
  prunableTitles,
  type WikiQuery,
} from "~/lib/realms/lore-import";
import { realmForWikiArticle } from "~/server/modules/realms/realms.map";

type Viewer = {
  id: string;
  clerkUserId: string;
  role?: { name: string; level: number } | null;
} | null;
const player: Viewer = { id: "u_player", clerkUserId: "clerk_player", role: null };
const founder: Viewer = { id: "u_founder", clerkUserId: "clerk_founder", role: null };
const admin: Viewer = {
  id: "u_admin",
  clerkUserId: "clerk_admin",
  role: { name: "admin", level: 10 },
};

function realmDb(settings: Record<string, unknown> = { maxNationsPerUser: 2 }, status = "active") {
  const state = { settings };
  const db: any = {
    state,
    realm: {
      findUnique: jest.fn(async () => ({
        id: "eurth-id",
        slug: "eurth",
        name: "Eurth",
        ownerId: "clerk_founder",
        status,
        settings: state.settings,
      })),
      update: jest.fn(async ({ data }: { data: { settings: Record<string, unknown> } }) => {
        state.settings = data.settings;
        return {};
      }),
    },
  };
  return db;
}

function caller(db: any, viewer: Viewer) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer ? { ...viewer, lastSeenAt: new Date() } : null,
  });
  return realmsRouter.createCaller(ctx as never).wiki;
}

const realFetch = globalThis.fetch;
let wiki: FakeWiki;
let png: Buffer;
const pngSha1 = () => createHash("sha1").update(png).digest("hex");

/** The recorded wiki, plus image downloads from /images/ and an optional override. */
function installWiki(respond?: (url: URL, index: number) => Response | undefined) {
  wiki = fakeIiwiki((url, index) => {
    const answer = respond?.(url, index);
    if (answer) return answer;
    if (url.pathname.startsWith("/images/"))
      return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
    return undefined;
  });
  globalThis.fetch = wiki.fetch;
}

/** imageinfo for the political map whose SHA-1 is that of `png`. */
function imageinfoFor(sha1: string) {
  const recorded = IIWIKI_FIXTURES.imageinfo as {
    query: { pages: Array<{ title: string; imageinfo?: Array<Record<string, unknown>> }> };
  };
  const page = recorded.query.pages.find((p) => p.title === "File:Eurth political map 2024.png")!;
  return {
    query: {
      pages: [
        {
          ...page,
          imageinfo: [{ ...page.imageinfo![0], sha1, size: png.byteLength, width: 64, height: 32 }],
        },
      ],
    },
  };
}

beforeAll(async () => {
  png = await sharp({
    create: { width: 64, height: 32, channels: 3, background: { r: 0, g: 90, b: 200 } },
  })
    .png()
    .toBuffer();
});
beforeEach(async () => {
  installWiki();
  await globalCache.delete("realm-wiki-hints:eurth-id");
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("realms.wiki permissions: site admins and the realm's founder only", () => {
  it("refuses a player for every read and write, asking the wiki nothing", async () => {
    const db = realmDb({ wiki: EURTH_WIKI });
    const w = caller(db, player);
    await expect(w.get({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.save({ slug: "eurth", wiki: null })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(w.discover({ slug: "eurth", step: { kind: "roster" } })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(w.chooseMap({ slug: "eurth", fileTitle: "File:X.png" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(w.recheckMap({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.infoboxHints({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(wiki.calls).toEqual([]);
  });
});

describe("archived realms", () => {
  it("still show their wiki settings but take no wiki changes, asking the wiki nothing", async () => {
    const db = realmDb({ wiki: EURTH_WIKI }, "archived");
    const w = caller(db, founder);
    expect((await w.get({ slug: "eurth" })).wiki).toEqual(EURTH_WIKI);
    await expect(w.save({ slug: "eurth", wiki: null })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(w.chooseMap({ slug: "eurth", fileTitle: "File:X.png" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(w.recheckMap({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(wiki.calls).toEqual([]);
  });
});

describe("realms.wiki.save", () => {
  it("validates, normalizes and stores the settings, keeping the realm's other settings", async () => {
    const db = realmDb();
    await caller(db, founder).save({
      slug: "eurth",
      wiki: {
        ...EURTH_WIKI,
        rootCategory: "category:Eurth",
        rosterCategory: "Category:Countries_(Eurth)",
      },
    });
    expect(db.state.settings).toEqual({ maxNationsPerUser: 2, wiki: EURTH_WIKI });

    await caller(db, admin).save({ slug: "eurth", wiki: null });
    expect(db.state.settings).toEqual({ maxNationsPerUser: 2 });
  });
});
describe("realms.wiki.chooseMap and recheckMap", () => {
  it("refuses a download whose SHA-1 differs from the wiki's, storing nothing", async () => {
    const db = realmDb({ wiki: EURTH_WIKI });
    await expect(
      caller(db, founder).chooseMap({
        slug: "eurth",
        fileTitle: "File:Eurth political map 2024.png",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("SHA-1") });
    expect(db.realm.update).not.toHaveBeenCalled();
  });
  it("hands the map import the chosen original, and refuses one that changed since it was chosen", async () => {
    installWiki((url) =>
      url.searchParams.get("prop") === "imageinfo" ? json(imageinfoFor(pngSha1())) : undefined
    );
    const db = realmDb({ wiki: EURTH_WIKI });
    await caller(db, founder).chooseMap({
      slug: "eurth",
      fileTitle: "File:Eurth political map 2024.png",
    });

    const original = await fetchChosenWikiMapOriginal(db, "eurth-id");
    expect(original).toMatchObject({
      filename: "Eurth political map 2024.png",
      width: 64,
      height: 32,
      sha1: pngSha1(),
    });
    expect(original.buffer.equals(png)).toBe(true);

    installWiki((url) =>
      url.searchParams.get("prop") === "imageinfo" ? json(imageinfoFor("d".repeat(40))) : undefined
    );
    await expect(fetchChosenWikiMapOriginal(db, "eurth-id")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(fetchChosenWikiMapOriginal(realmDb(), "eurth-id")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("the discovery client is a polite wiki client", () => {
  const API = "https://iiwiki.com/api.php";
  const Any = z.object({ query: z.unknown().optional() }).passthrough();
  function setup(
    respond?: Parameters<typeof fakeIiwiki>[0],
    options: { maxRetryAfterMs?: number; maxRequests?: number; pauseFirst?: boolean } = {}
  ) {
    const wiki = fakeIiwiki(respond);
    const sleeps: number[] = [];
    const client = createDiscoveryClient("iiwiki", {
      fetchImpl: wiki.fetch,
      apiUrl: API,
      delayMs: 400,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      ...options,
    });
    return { wiki, sleeps, client };
  }
  const rosterQuery = { list: "categorymembers", cmtitle: "Category:Countries (Eurth)" };
  describe("discovery client throttling", () => {
    it("stops as rate-limited when the wiki asks for a longer wait than it will take", async () => {
      const { client, wiki } = setup(
        () => new Response("", { status: 503, headers: { "Retry-After": "120" } }),
        { maxRetryAfterMs: 20_000 }
      );
      await expect(client.query(rosterQuery, Any)).rejects.toBeInstanceOf(DiscoveryStopped);
      expect(client.stopped()).toMatchObject({ kind: "rate-limited", status: 503 });
      // Once stopped, later queries send nothing.
      await expect(client.query(rosterQuery, Any)).rejects.toBeInstanceOf(DiscoveryStopped);
      expect(wiki.calls).toHaveLength(1);
    });

    it("stops at the request cap", async () => {
      const { client } = setup(undefined, { maxRequests: 2 });
      await client.query(rosterQuery, Any);
      await client.query(rosterQuery, Any);
      await expect(client.query(rosterQuery, Any)).rejects.toThrow("discovery cap");
      expect(client.stopped()?.kind).toBe("cap");
    });
    it("sends the allowlisted user agent and formatversion 2", async () => {
      const seen: Array<Record<string, string>> = [];
      const client = createDiscoveryClient("iiwiki", {
        apiUrl: API,
        fetchImpl: (async (_url: string, init?: RequestInit) => {
          seen.push(init?.headers as Record<string, string>);
          return json({ query: {} });
        }) as typeof fetch,
      });
      await client.query({ list: "categorymembers" }, Any);
      expect(seen[0]).toMatchObject({ "User-Agent": "IxStats-Builder" });
    });
  });
});

describe("discovery on iiwiki", () => {
  const API = "https://iiwiki.com/api.php";
  const noSleep = jest.fn(async () => undefined);
  function client(respond?: Parameters<typeof fakeIiwiki>[0], maxRequests?: number) {
    const wiki = fakeIiwiki(respond);
    return {
      wiki,
      client: createDiscoveryClient("iiwiki", {
        fetchImpl: wiki.fetch,
        apiUrl: API,
        sleep: noSleep,
        maxRequests,
      }),
    };
  }
  describe("a discovery step's blocked and partial results", () => {
    it("treats a Cloudflare challenge page as blocked", async () => {
      const challenge = new Response(
        "<html><title>Just a moment...</title><script src=/cdn-cgi/challenge-platform/x></script></html>",
        {
          status: 200,
          headers: { "content-type": "text/html" },
        }
      );
      const { client: c } = client((_url, index) => (index === 0 ? challenge : undefined));
      const step = await discoverRoster(c, EURTH_WIKI);

      expect(step.stopped).toMatchObject({ kind: "blocked", phase: "roster" });
      expect(step.data.nations).toEqual([]);
    });
  });
});

describe("realm wiki settings", () => {
  const EURTH_WIKI = {
    source: "iiwiki" as const,
    rootCategory: "Category:Eurth",
    keyword: "Eurth",
    rosterCategory: "Category:Countries (Eurth)",
    portalTitle: "Portal:Eurth",
    mapCategories: [] as string[],
  };
  const parse = (input: Record<string, unknown>) => realmWikiSettingsSchema.safeParse(input);
  const base = { source: "iiwiki", rootCategory: "Category:Eurth", keyword: "Eurth" };
  describe("realm wiki settings validation", () => {
    it.each<[Record<string, unknown>, string]>([
      [{ ...base, source: "ixwiki" }, "IxWiki is Ixnay's and never crawled"],
      [{ ...base, source: "https://evil.example" }, "a wiki is named by id, never by URL"],
      [{ ...base, rootCategory: "Category:Eurth|x" }, "characters MediaWiki forbids"],
      [
        { ...base, mapCategories: Array.from({ length: 6 }, (_, i) => `Category:M${i}`) },
        "too many map categories",
      ],
    ])("refuses %j (%s)", (input) => {
      expect(parse(input).success).toBe(false);
    });
  });
  describe("reading and writing Realm.settings", () => {
    it("keeps every other key when the wiki is set or cleared", () => {
      const stored = { maxNationsPerUser: 3, inWorldDate: { kind: "fixed", label: "Year 1" } };
      const withWiki = withRealmWikiSettings(stored, EURTH_WIKI);
      expect(withWiki).toEqual({ ...stored, wiki: EURTH_WIKI });
      expect(realmWikiSettings(withWiki)).toEqual(EURTH_WIKI);
      expect(withRealmWikiSettings(withWiki, null)).toEqual(stored);
    });
    it("stores the chosen map under settings.map, keeping other map keys", () => {
      const map: RealmWikiMap = {
        source: {
          wiki: "iiwiki",
          fileTitle: "File:Eurth political map 2024.png",
          sha1: "a".repeat(40),
        },
        attribution: "Map by Cartographer, CC BY-SA 4.0, via IIWiki",
        file: {
          width: 8192,
          height: 4096,
          size: 9876543,
          mime: "image/png",
          licence: "CC BY-SA 4.0",
          descriptionUrl: "https://iiwiki.com/wiki/File:Eurth_political_map_2024.png",
          chosenAt: "2026-10-07T12:00:00.000Z",
          chosenBy: "clerk_founder",
          checkedAt: null,
        },
      };
      const settings = withRealmWikiMap(
        { maxNationsPerUser: 2, map: { projection: "equirectangular" } },
        map
      );
      expect(settings).toMatchObject({
        maxNationsPerUser: 2,
        map: { projection: "equirectangular", source: map.source, attribution: map.attribution },
      });
      expect(realmWikiMap(settings)).toEqual(map);
      expect(
        realmWikiMap({ map: { source: { wiki: "iiwiki", fileTitle: "File:X.png", sha1: "nope" } } })
      ).toBeNull();
    });
  });
  describe("import-realm-lore defaults from the realm's wiki settings", () => {
    it("does not apply one wiki's settings to another wiki", () => {
      expect(() => loreImportOptions({ source: "althistory" }, EURTH_WIKI)).toThrow(
        "missing --category, --keyword"
      );
    });
  });
});

describe("lore import", () => {
  type Member = { ns: number; title: string };
  const ROOT = "Category:Eurth";
  const HISTORY = "Category:History (Eurth)";
  const ROSTER = "Category:Countries (Eurth)";
  /** Category:Eurth contains itself (a cycle), a keyword subcategory, a skipped "redirects" one and an unrelated one. */
  const TREE: Record<string, Member[]> = {
    [ROOT]: [
      { ns: 0, title: "B" },
      { ns: 0, title: "A" },
      { ns: 14, title: ROOT },
      { ns: 14, title: HISTORY },
      { ns: 14, title: "Category:Eurth redirects" },
      { ns: 14, title: "Category:Unrelated" },
    ],
    [HISTORY]: [
      { ns: 0, title: "C" },
      { ns: 0, title: "A" }, // also listed under the root — one page, counted once
    ],
    /** The curated roster: one subcategory per active nation, named after it; not reachable from the root crawl. */
    [ROSTER]: [
      { ns: 14, title: "Category:Nanto (Eurth)" },
      { ns: 14, title: "Category:Abantium" },
      { ns: 0, title: "B" },
      { ns: 10, title: "Template:Eurth country" }, // not a nation
      { ns: 14, title: "Category:B" }, // same nation as page B
    ],
  };
  const CONTENT: Record<string, string> = {
    A: "'''A''' is a region.\n== History ==\n{{Infobox country\n| name = A\n}} (below the lead, so not a nation)",
    B: "{{Infobox country\n| name = B\n}}\n'''B''' is a nation.\n== Geography ==",
    C: "Plain lore.",
    D: "{{ infobox former country | name = D }}\n'''D''' was a nation.",
    E: "{{Infobox country at games\n| country = E\n}}\nE at the games.",
    F: "{{Infobox_country|name=F}}\n'''F''' is a nation.",
    G: "{{Infobox country geography\n| country = G\n}}",
    H: "{{Infobox country demographics | country = H }}",
  };
  const PAGE_SIZE = 3;
  /** MediaWiki (formatversion 2) answers; the root's members come back in two continued pages. */
  function respond(params: Record<string, string>): object {
    if (params.list === "categorymembers") {
      const all = TREE[params.cmtitle ?? ""] ?? [];
      if (params.cmcontinue) return { query: { categorymembers: all.slice(PAGE_SIZE) } };
      if (all.length <= PAGE_SIZE) return { query: { categorymembers: all } };
      return {
        continue: { cmcontinue: "page|2", continue: "-||" },
        query: { categorymembers: all.slice(0, PAGE_SIZE) },
      };
    }
    if (params.prop === "revisions") {
      const pages = (params.titles ?? "").split("|").map((title) => ({
        title,
        revisions: [{ slots: { main: { content: CONTENT[title] ?? "" } } }],
      }));
      return { query: { pages } };
    }
    throw new Error(`unexpected query ${JSON.stringify(params)}`);
  }
  function fakeWiki() {
    const calls: Array<Record<string, string>> = [];
    const query: WikiQuery = async (params, schema) => {
      calls.push(params);
      return schema.parse(respond(params));
    };
    return { query, calls };
  }
  const requestedCategories = (calls: Array<Record<string, string>>) =>
    new Set(calls.filter((c) => c.list === "categorymembers").map((c) => c.cmtitle));
  describe("crawlRealmCategory", () => {
    it("indexes the keyword subtree, survives the self-cycle and never reads skipped or unrelated categories", async () => {
      const { query, calls } = fakeWiki();

      const result = await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth" });

      expect(result).toEqual({
        pages: ["A", "B", "C"],
        categoriesVisited: [ROOT, HISTORY],
        truncated: false,
      });
      expect(requestedCategories(calls)).toEqual(new Set([ROOT, HISTORY]));
      expect(requestedCategories(calls)).not.toContain("Category:Eurth redirects");
      expect(requestedCategories(calls)).not.toContain("Category:Unrelated");
    });
  });
  describe("wiki continuation guard", () => {
    it("throws instead of looping when the wiki repeats the same continuation", async () => {
      const calls: Array<Record<string, string>> = [];
      // A proxy that strips continue params: every answer is the first page again, with the same `continue`.
      const query: WikiQuery = async (params, schema) => {
        calls.push(params);
        return schema.parse({
          continue: { cmcontinue: "page|2", continue: "-||" },
          query: { categorymembers: [{ ns: 0, title: "A" }] },
        });
      };

      await expect(
        crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth" })
      ).rejects.toThrow(/same continuation/);
      expect(calls).toHaveLength(2);
    });
  });
  describe("prunableTitles (--prune)", () => {
    it("deletes only indexed titles no longer in the index, keeping the claimed or founded ones", () => {
      expect(
        prunableTitles(
          ["A", "Gone", "Claimed", "B", "Founded"],
          ["A", "B", "New"],
          ["Claimed", "Founded", "A"]
        )
      ).toEqual({ prune: ["Gone"], kept: ["Claimed", "Founded"] });
    });
  });
  describe("loreDowngrades (re-import)", () => {
    it("never turns a claimed or founded nation page back into lore", () => {
      expect(
        loreDowngrades(
          ["Gone From Roster", "Claimed", "Founded"],
          ["Claimed", "Founded", "Unrelated"]
        )
      ).toEqual({ downgrade: ["Gone From Roster"], kept: ["Claimed", "Founded"] });
    });
  });
});

/**
 * A coordinates embed in another wiki's article shows the map of the realm whose lore index holds that article,
 * else of the only realm whose lore comes from that wiki; otherwise the viewer's realm.
 */
describe("a wiki article's realm", () => {
  function dbWith(byTitle: string[], byWiki: string[], status = "active") {
    return {
      realmPage: {
        findMany: jest.fn(async ({ where }: { where: { title?: string } }) =>
          (where.title ? byTitle : byWiki).map((realmId) => ({ realmId }))
        ),
      },
      realm: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
          slug: `slug-of-${where.id}`,
          status,
        })),
      },
    };
  }
  describe("realmForWikiArticle", () => {
    it("gives up when several realms qualify, or the realm is unpublished", async () => {
      await expect(
        realmForWikiArticle(dbWith(["a", "b"], ["a", "b"]) as never, "iiwiki", "X")
      ).resolves.toBeNull();
      await expect(
        realmForWikiArticle(dbWith(["a"], ["a"], "draft") as never, "iiwiki", "X")
      ).resolves.toBeNull();
    });
  });
});
