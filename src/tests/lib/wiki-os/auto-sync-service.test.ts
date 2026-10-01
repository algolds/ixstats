/** @jest-environment node */
/**
 * Plan 339 Step 2 + plan 406: runAutoSyncCycle is the single recentchanges sync. It keeps a high-water
 * mark in SystemConfig, follows rccontinue, never advances past a failed page, and applies MediaWiki
 * revisions one at a time, oldest first, by the inbound rule (fast-forward, echo or park).
 */
import { createHash } from "node:crypto";
import { runAutoSyncCycle, syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";
import { notificationAPI } from "~/lib/notifications/api";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

const mockSystemConfigFindUnique = jest.fn();
const mockSystemConfigUpsert = jest.fn();
const mockArticleFindUnique = jest.fn();
const mockArticleFindFirst = jest.fn();
const mockArticleUpdate = jest.fn();
const mockRevisionFindUnique = jest.fn();
const mockRevisionFindFirst = jest.fn();
const mockRevisionCreateMany = jest.fn();
const mockRevisionUpdateMany = jest.fn();
const mockAccountLinkFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    systemConfig: {
      findUnique: (...a: unknown[]) => mockSystemConfigFindUnique(...a),
      upsert: (...a: unknown[]) => mockSystemConfigUpsert(...a),
    },
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockArticleFindUnique(...a),
      findFirst: (...a: unknown[]) => mockArticleFindFirst(...a),
      update: (...a: unknown[]) => mockArticleUpdate(...a),
    },
    wikiRevision: {
      findUnique: (...a: unknown[]) => mockRevisionFindUnique(...a),
      findFirst: (...a: unknown[]) => mockRevisionFindFirst(...a),
      createMany: (...a: unknown[]) => mockRevisionCreateMany(...a),
      updateMany: (...a: unknown[]) => mockRevisionUpdateMany(...a),
    },
    wikiAccountLink: { findFirst: (...a: unknown[]) => mockAccountLinkFindFirst(...a) },
  },
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  ArticleRepository: { importPageRevisions: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/sync-worker", () => ({
  MediaWikiExportWorker: { enqueue: jest.fn() },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/wiki-os/services/title-cache-eviction", () => ({
  evictWikiTitleCaches: jest.fn().mockResolvedValue(undefined),
}));

const HWM_KEY = "wikiAutoSync.rcHighWater";

const importPageRevisions = jest.mocked(ArticleRepository.importPageRevisions);
const enqueueExport = jest.mocked(MediaWikiExportWorker.enqueue);
const notify = jest.mocked(notificationAPI.create);

// ---------------------------------------------------------------------------
// A fake MediaWiki: revisions by id, the newest revision of each title, a recent-changes queue
// ---------------------------------------------------------------------------

interface FakeRevision {
  pageId?: number;
  ns?: number;
  title: string;
  revid: number;
  parentid?: number;
  user?: string;
  text?: string;
  timestamp?: string;
  minor?: boolean;
  comment?: string;
}

interface Change {
  title: string;
  revid: number;
  timestamp: string;
}

const change = (title: string, revid: number, second: number): Change => ({
  title,
  revid,
  timestamp: `2026-09-27T10:00:0${second}Z`,
});

const jsonResponse = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The hex SHA-1 the API reports for `text`. */
const sha1Hex = (text: string): string => createHash("sha1").update(text, "utf8").digest("hex");

const realFetch = globalThis.fetch;
let rcResponses: Array<{ changes: Change[]; next?: Record<string, string> }> = [];
let mwRevisions: Map<number, FakeRevision> = new Map();
let failingRevisions = new Set<number>();

const revisionPage = (rev: FakeRevision) => ({
  pageid: rev.pageId ?? 1,
  ns: rev.ns ?? 0,
  title: rev.title,
  revisions: [
    {
      revid: rev.revid,
      parentid: rev.parentid ?? 0,
      timestamp: rev.timestamp ?? "2026-09-27T10:00:00Z",
      user: rev.user ?? "alice",
      comment: rev.comment ?? "edit",
      minor: rev.minor ?? false,
      slots: { main: { content: rev.text ?? "Body text.", contentmodel: "wikitext" } },
    },
  ],
});

const fetchMock = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const params = new URL(String(input)).searchParams;
  if (params.get("list") === "recentchanges") {
    const next = rcResponses.shift() ?? { changes: [] };
    return jsonResponse({
      query: { recentchanges: next.changes },
      ...(next.next ? { continue: next.next } : {}),
    });
  }
  const revid = Number(params.get("revids"));
  if (params.has("revids") && failingRevisions.has(revid)) return jsonResponse({}, 500);
  if (params.get("rvprop") === "ids|sha1") {
    const text = mwRevisions.get(revid)?.text ?? "";
    return jsonResponse({ query: { pages: [{ revisions: [{ revid, sha1: sha1Hex(text) }] }] } });
  }
  const rev = params.has("revids")
    ? mwRevisions.get(revid)
    : [...mwRevisions.values()].filter((r) => r.title === params.get("titles")).at(-1);
  return jsonResponse({
    query: { pages: rev ? [revisionPage(rev)] : [{ title: "x", missing: true }] },
  });
});

const fetchedRevids = (): number[] =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)).searchParams)
    .filter((params) => params.has("revids") && params.get("rvprop") !== "ids|sha1")
    .map((params) => Number(params.get("revids")));

const rcCalls = (): URLSearchParams[] =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)).searchParams)
    .filter((params) => params.get("list") === "recentchanges");

const storedHighWater = (): string | undefined =>
  mockSystemConfigUpsert.mock.calls.at(-1)?.[0]?.update?.value;

// ---------------------------------------------------------------------------
// A tiny Postgres: the article row and the head revision the sync reads
// ---------------------------------------------------------------------------

interface StoredArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  wikitext: string;
  namespace: number;
  namespacePrefix: string | null;
  mwPageId: number | null;
}

interface StoredHead {
  id: string;
  mwRevId: number | null;
  sha1: string | null;
  byteSize: number;
  createdAt: Date;
}

let article: StoredArticle | null = null;
let head: StoredHead | null = null;
let knownRevids = new Set<number>();

const storedArticle = (over: Partial<StoredArticle> = {}): StoredArticle => ({
  id: "art-1",
  title: "Foo",
  slug: "foo",
  status: "PUBLISHED",
  wikitext: "WikiOS text.",
  namespace: 0,
  namespacePrefix: null,
  mwPageId: 1,
  ...over,
});

/** WikiOS's head: the revision with the text "WikiOS text.", stamped with MediaWiki revision `mwRevId`. */
const storedHead = (mwRevId: number | null, over: Partial<StoredHead> = {}): StoredHead => ({
  id: "rev-9",
  mwRevId,
  sha1: mwSha1Base36("WikiOS text."),
  byteSize: 12,
  createdAt: new Date("2026-09-27T09:00:00Z"),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  rcResponses = [];
  mwRevisions = new Map();
  failingRevisions = new Set();
  article = null;
  head = null;
  knownRevids = new Set();
  globalThis.fetch = fetchMock as typeof fetch;

  mockSystemConfigFindUnique.mockResolvedValue(null);
  mockSystemConfigUpsert.mockResolvedValue({});
  mockArticleFindUnique.mockImplementation(async ({ where }) =>
    article && article.title === where.source_title.title ? article : null
  );
  mockArticleFindFirst.mockResolvedValue(null);
  mockArticleUpdate.mockResolvedValue({});
  mockRevisionFindUnique.mockImplementation(async ({ where }) =>
    knownRevids.has(where.source_mwRevId.mwRevId) ? { id: "existing" } : null
  );
  mockRevisionFindFirst.mockImplementation(async () => head);
  mockRevisionCreateMany.mockResolvedValue({ count: 1 });
  mockRevisionUpdateMany.mockResolvedValue({ count: 1 });
  mockAccountLinkFindFirst.mockResolvedValue(null);
  importPageRevisions.mockImplementation(async (input) => {
    const revision = input.revisions[0]!;
    // What the importer's write leaves behind: the revision is the head and its text the page's.
    head = {
      id: "rev-new",
      mwRevId: revision.mwRevId,
      sha1: revision.sha1,
      byteSize: revision.byteSize,
      createdAt: revision.createdAt,
    };
    article = storedArticle({ title: input.title, wikitext: revision.wikitext ?? "" });
    return { created: false, inserted: 1, filled: 0, skipped: 0, conflicts: 0, headUpdated: true };
  });
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// The cycle: high-water mark, pagination, failures (plan 339)
// ---------------------------------------------------------------------------

describe("the cycle", () => {
  it("first run without HWM requests the latest changes (all namespaces) and stores the newest timestamp", async () => {
    // MediaWiki's default order is newest first.
    rcResponses = [{ changes: [change("B", 2, 2), change("A", 1, 1)] }];

    await runAutoSyncCycle();

    const [params] = rcCalls();
    expect(params?.get("rclimit")).toBe("30");
    expect(params?.get("rcdir")).toBeNull();
    expect(params?.has("rcnamespace")).toBe(false);
    expect(params?.get("rctype")).toBe("edit|new");
    expect(fetchedRevids()).toEqual([1, 2]);
    expect(mockSystemConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: HWM_KEY } })
    );
    expect(storedHighWater()).toBe("2026-09-27T10:00:02Z");
  });

  it("with HWM requests rcdir=newer&rcstart=<hwm>", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });

    await runAutoSyncCycle();

    const [params] = rcCalls();
    expect(params?.get("rcdir")).toBe("newer");
    expect(params?.get("rcstart")).toBe("2026-09-27T09:00:00Z");
    expect(params?.get("rclimit")).toBe("50");
    expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
  });

  it("follows rccontinue across two pages", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });
    rcResponses = [
      { changes: [change("A", 1, 1)], next: { rccontinue: "x", continue: "-||" } },
      { changes: [change("B", 2, 2)] },
    ];

    await runAutoSyncCycle();

    const calls = rcCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.get("rccontinue")).toBe("x");
    expect(calls[1]?.get("continue")).toBe("-||");
    expect(storedHighWater()).toBe("2026-09-27T10:00:02Z");
  });

  it("does not advance HWM past a failed page sync, and still syncs the other pages", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });
    rcResponses = [{ changes: [change("A", 1, 1), change("B", 2, 2), change("C", 3, 3)] }];
    mwRevisions = new Map([
      [1, { title: "A", revid: 1 }],
      [3, { title: "C", revid: 3 }],
    ]);
    failingRevisions = new Set([2]);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await runAutoSyncCycle();

    expect(fetchedRevids()).toEqual([1, 2, 3]);
    expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
    consoleError.mockRestore();
  });

  it("holds back later revisions of a page whose earlier revision failed (they would precede their parent)", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });
    rcResponses = [{ changes: [change("A", 1, 1), change("A", 2, 2), change("B", 3, 3)] }];
    mwRevisions = new Map([[3, { title: "B", revid: 3 }]]);
    failingRevisions = new Set([1]);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await runAutoSyncCycle();

    expect(fetchedRevids()).toEqual([1, 3]);
    consoleError.mockRestore();
  });

  it("skips a change whose revision is already stored", async () => {
    rcResponses = [{ changes: [change("A", 1, 1)] }];
    knownRevids = new Set([1]);

    await runAutoSyncCycle();

    expect(fetchedRevids()).toEqual([]);
    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
  });

  it("skips a revision MediaWiki no longer has (deleted since)", async () => {
    rcResponses = [{ changes: [change("A", 1, 1)] }];

    await runAutoSyncCycle();

    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
  });
});

// ---------------------------------------------------------------------------
// Fast-forward, echo, park (plan 406 A)
// ---------------------------------------------------------------------------

describe("fast-forward", () => {
  it("imports a page MediaWiki has and WikiOS lacks, through the importer, as one revision and the head", async () => {
    rcResponses = [{ changes: [change("Foo", 100, 1)] }];
    mwRevisions = new Map([
      [
        100,
        {
          title: "Foo",
          revid: 100,
          pageId: 7,
          user: "alice",
          text: "[[Bar]] text",
          comment: "first",
          minor: true,
          timestamp: "2026-09-27T10:00:01Z",
        },
      ],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions).toHaveBeenCalledTimes(1);
    const input = importPageRevisions.mock.calls[0]![0];
    expect(input).toMatchObject({
      source: "ixwiki",
      title: "Foo",
      slug: "foo",
      namespace: 0,
      namespacePrefix: null,
      mwPageId: 7,
      dryRun: false,
      restrictions: [],
      protectionLevel: null,
    });
    expect(input.revisions).toEqual([
      {
        mwRevId: 100,
        createdAt: new Date("2026-09-27T10:00:01Z"),
        author: "alice",
        authorId: null,
        summary: "first",
        commentDeleted: false,
        textDeleted: false,
        userDeleted: false,
        minor: true,
        byteSize: 12,
        byteDelta: 12,
        sha1: mwSha1Base36("[[Bar]] text"),
        wikitext: "[[Bar]] text",
      },
    ]);
    expect(input.head).toMatchObject({
      mwRevId: 100,
      wikitext: "[[Bar]] text",
      wordCount: 2,
      readingTime: 1,
      redirectTargetSlug: null,
      redirectTargetFragment: null,
    });
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it("imports an edit whose parent is WikiOS's head (by MediaWiki revision id)", async () => {
    article = storedArticle();
    head = storedHead(90);
    rcResponses = [{ changes: [change("Foo", 91, 1)] }];
    mwRevisions = new Map([
      [91, { title: "Foo", revid: 91, parentid: 90, text: "Edited in MediaWiki." }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions).toHaveBeenCalledTimes(1);
    const input = importPageRevisions.mock.calls[0]![0];
    expect(input.title).toBe("Foo");
    expect(input.revisions[0]).toMatchObject({ mwRevId: 91, byteDelta: 20 - 12 });
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it("imports two sequential MediaWiki edits of one page in one cycle, the second on top of the first", async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });
    article = storedArticle();
    head = storedHead(90);
    rcResponses = [{ changes: [change("Foo", 91, 1), change("Foo", 92, 2)] }];
    mwRevisions = new Map([
      [91, { title: "Foo", revid: 91, parentid: 90, text: "First edit.", timestamp: "2026-09-27T10:00:01Z" }],
      [92, { title: "Foo", revid: 92, parentid: 91, text: "Second edit.", timestamp: "2026-09-27T10:00:02Z" }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions.mock.calls.map(([input]) => input.revisions[0]?.mwRevId)).toEqual([
      91, 92,
    ]);
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(storedHighWater()).toBe("2026-09-27T10:00:02Z");
  });

  it("imports when the head was never stamped but the edit's parent has exactly WikiOS's text", async () => {
    article = storedArticle();
    head = storedHead(null);
    rcResponses = [{ changes: [change("Foo", 91, 1)] }];
    mwRevisions = new Map([
      [80, { title: "Foo", revid: 80, text: "WikiOS text." }],
      [91, { title: "Foo", revid: 91, parentid: 80, text: "Edited in MediaWiki." }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions).toHaveBeenCalledTimes(1);
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
  });

  it("never lets a revision sort before the head it builds on (MediaWiki's clock is behind)", async () => {
    article = storedArticle();
    head = storedHead(90, { createdAt: new Date("2026-09-27T10:00:05.500Z") });
    rcResponses = [{ changes: [change("Foo", 91, 1)] }];
    mwRevisions = new Map([
      [91, { title: "Foo", revid: 91, parentid: 90, text: "Quick edit.", timestamp: "2026-09-27T10:00:05Z" }],
    ]);

    await runAutoSyncCycle();

    const input = importPageRevisions.mock.calls[0]![0];
    expect(input.revisions[0]!.createdAt.getTime()).toBe(
      new Date("2026-09-27T10:00:05.501Z").getTime()
    );
    expect(input.head?.createdAt).toEqual(input.revisions[0]!.createdAt);
  });

  it("credits the revision to the WikiOS user who verified the MediaWiki account", async () => {
    rcResponses = [{ changes: [change("Foo", 100, 1)] }];
    mwRevisions = new Map([[100, { title: "Foo", revid: 100, user: "alice_b" }]]);
    mockAccountLinkFindFirst.mockResolvedValue({ userId: "user-7" });

    await runAutoSyncCycle();

    expect(mockAccountLinkFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ username: "Alice b" }) })
    );
    expect(importPageRevisions.mock.calls[0]![0].revisions[0]).toMatchObject({
      author: "alice_b",
      authorId: "user-7",
    });
  });
});

describe("echo", () => {
  it("stamps the MediaWiki id on a head the mirror exported (its text comes back), and imports nothing", async () => {
    article = storedArticle({ mwPageId: null });
    head = storedHead(null);
    rcResponses = [{ changes: [change("Foo", 91, 1)] }];
    mwRevisions = new Map([
      [91, { title: "Foo", revid: 91, pageId: 7, parentid: 50, text: "WikiOS text." }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(mockRevisionUpdateMany).toHaveBeenCalledWith({
      where: { id: "rev-9", mwRevId: null },
      data: { mwRevId: 91 },
    });
    expect(mockArticleUpdate).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: expect.objectContaining({ mwLatestRevId: 91, mwPageId: 7 }),
    });
  });

  it("treats an edit by the mirror account as WikiOS's own whatever its text", async () => {
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "Mirror@WikiOS";
    try {
      article = storedArticle();
      head = storedHead(90);
      rcResponses = [{ changes: [change("Foo", 91, 1)] }];
      mwRevisions = new Map([
        [91, { title: "Foo", revid: 91, parentid: 50, user: "Mirror", text: "PST changed this." }],
      ]);

      await runAutoSyncCycle();

      expect(importPageRevisions).not.toHaveBeenCalled();
      expect(mockRevisionCreateMany).not.toHaveBeenCalled();
      expect(enqueueExport).not.toHaveBeenCalled();
      expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
    } finally {
      delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;
    }
  });
});

describe("park", () => {
  const parkSetup = () => {
    article = storedArticle();
    head = storedHead(90);
    rcResponses = [{ changes: [change("Foo", 95, 1)] }];
    mwRevisions = new Map([
      [92, { title: "Foo", revid: 92, parentid: 90, text: "Some other text." }],
      [
        95,
        {
          title: "Foo",
          revid: 95,
          parentid: 92,
          user: "carol",
          text: "A conflicting edit.",
          comment: "mine",
          timestamp: "2026-09-27T10:00:01Z",
        },
      ],
    ]);
  };

  it("keeps the edit as a parked revision, leaves the article alone, and pushes WikiOS's head back to MediaWiki", async () => {
    parkSetup();

    await runAutoSyncCycle();

    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockRevisionCreateMany).toHaveBeenCalledTimes(1);
    const [{ data, skipDuplicates }] = mockRevisionCreateMany.mock.calls[0]!;
    expect(skipDuplicates).toBe(true);
    expect(data[0]).toMatchObject({
      articleId: "art-1",
      source: "ixwiki",
      mwRevId: 95,
      author: "carol",
      summary: "mine",
      wikitext: "A conflicting edit.",
      parked: true,
      parkReason: "conflict:90",
      createdAt: new Date("2026-09-27T10:00:01Z"),
    });
    expect(enqueueExport).toHaveBeenCalledWith({
      slug: "foo",
      title: "Foo",
      wikitext: "WikiOS text.",
      summary:
        "Restoring WikiOS revision 90; your edit (rev 95) was kept in WikiOS history as a conflict",
      minor: false,
      revisionId: "rev-9",
    });
  });

  it("notifies the editor when the MediaWiki account has a verified link", async () => {
    parkSetup();
    mockAccountLinkFindFirst.mockResolvedValue({ userId: "user-7" });

    await runAutoSyncCycle();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-7",
        href: "/wiki/Foo?diff=95&oldid=90",
        category: "wiki",
        source: "wikiSync",
      })
    );
  });

  it("notifies nobody when the MediaWiki account is not linked", async () => {
    parkSetup();

    await runAutoSyncCycle();

    expect(notify).not.toHaveBeenCalled();
    expect(mockRevisionCreateMany).toHaveBeenCalledTimes(1);
  });

  it("does not push or notify again for a revision that is already parked (the cycle re-reads its last entry)", async () => {
    parkSetup();
    knownRevids = new Set([95]);

    await runAutoSyncCycle();

    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it("does not push or notify when the parked revision was a duplicate insert", async () => {
    parkSetup();
    mockRevisionCreateMany.mockResolvedValue({ count: 0 });

    await runAutoSyncCycle();

    expect(enqueueExport).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("parks an edit of a page WikiOS deleted without pushing anything back", async () => {
    parkSetup();
    article = storedArticle({ status: "ARCHIVED" });

    await runAutoSyncCycle();

    expect(mockRevisionCreateMany.mock.calls[0]![0].data[0]).toMatchObject({
      parked: true,
      parkReason: "conflict:deleted",
    });
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it("brings a page WikiOS deleted back when MediaWiki creates it anew", async () => {
    article = storedArticle({ status: "ARCHIVED" });
    head = storedHead(90);
    rcResponses = [{ changes: [change("Foo", 99, 1)] }];
    mwRevisions = new Map([
      [99, { title: "Foo", revid: 99, parentid: 0, pageId: 12, text: "Born again." }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions).toHaveBeenCalledTimes(1);
    expect(mockArticleUpdate).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "PUBLISHED" },
    });
    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
  });
});

describe("identity of a synced page (plan 402, 403)", () => {
  it("stores the canonical title, slug and namespace", async () => {
    rcResponses = [{ changes: [change("user talk:jane_doe", 100, 1)] }];
    mwRevisions = new Map([[100, { title: "user talk:jane_doe", revid: 100, ns: 3 }]]);

    await runAutoSyncCycle();

    expect(importPageRevisions.mock.calls[0]![0]).toMatchObject({
      title: "User talk:Jane doe",
      slug: "user_talk:jane_doe",
      namespace: 3,
      namespacePrefix: "User talk",
    });
  });

  it("skips a change whose title MediaWiki itself would refuse", async () => {
    rcResponses = [{ changes: [change("a[b", 100, 1)] }];
    mwRevisions = new Map([[100, { title: "a[b", revid: 100 }]]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await runAutoSyncCycle();

    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
    warn.mockRestore();
  });

  it("keeps MediaWiki's namespace and the title's prefix when the canonical table lacks it", async () => {
    rcResponses = [{ changes: [change("Portal:Eurth", 100, 1), change("Foo: bar", 101, 2)] }];
    mwRevisions = new Map([
      [100, { title: "Portal:Eurth", revid: 100, ns: 100, pageId: 2 }],
      [101, { title: "Foo: bar", revid: 101, ns: 0, pageId: 3 }],
    ]);

    await runAutoSyncCycle();

    const inputFor = (title: string) =>
      importPageRevisions.mock.calls.find(([input]) => input.title === title)?.[0];
    expect(inputFor("Portal:Eurth")).toMatchObject({
      slug: "portal:eurth",
      namespace: 100,
      namespacePrefix: "Portal",
    });
    expect(inputFor("Foo: bar")).toMatchObject({ namespace: 0, namespacePrefix: null });
  });

  it("a namespace the canonical table knows is not overridden by MediaWiki's id", async () => {
    rcResponses = [{ changes: [change("Talk:x", 100, 1)] }];
    mwRevisions = new Map([[100, { title: "Talk:x", revid: 100, ns: 1 }]]);

    await runAutoSyncCycle();

    expect(importPageRevisions.mock.calls[0]![0]).toMatchObject({
      namespace: 1,
      namespacePrefix: "Talk",
    });
  });

  it("stores a synced redirect's canonical target and fragment, and nulls for ordinary text", async () => {
    rcResponses = [{ changes: [change("Old", 100, 1), change("Plain", 101, 2)] }];
    mwRevisions = new Map([
      [100, { title: "Old", revid: 100, pageId: 2, text: "#REDIRECT [[foo_bar#Sec one]]" }],
      [101, { title: "Plain", revid: 101, pageId: 3, text: "See #REDIRECT [[Foo]] here." }],
    ]);

    await runAutoSyncCycle();

    const headFor = (title: string) =>
      importPageRevisions.mock.calls.find(([input]) => input.title === title)?.[0].head;
    expect(headFor("Old")).toMatchObject({
      redirectTargetSlug: "Foo bar",
      redirectTargetFragment: "Sec one",
    });
    expect(headFor("Plain")).toMatchObject({
      redirectTargetSlug: null,
      redirectTargetFragment: null,
    });
  });

  it("applies a revision to the article MediaWiki's page id names when the title is unknown (a page moved in MediaWiki)", async () => {
    article = storedArticle({ title: "Old name", slug: "old_name", mwPageId: 7, wikitext: "Text." });
    mockArticleFindFirst.mockImplementation(async ({ where }) =>
      where.mwPageId === 7 ? article : null
    );
    head = storedHead(90, { sha1: mwSha1Base36("Text."), byteSize: 5 });
    rcResponses = [{ changes: [change("New name", 91, 1)] }];
    mwRevisions = new Map([
      [91, { title: "New name", revid: 91, parentid: 90, pageId: 7, text: "More text." }],
    ]);

    await runAutoSyncCycle();

    expect(importPageRevisions.mock.calls[0]![0]).toMatchObject({
      title: "Old name",
      slug: "old_name",
      mwPageId: 7,
    });
  });
});

// ---------------------------------------------------------------------------
// The webhook and the reader: the newest revision of one page
// ---------------------------------------------------------------------------

describe("syncSinglePage", () => {
  it("imports the newest revision of a page WikiOS lacks and answers true", async () => {
    mwRevisions = new Map([[100, { title: "Foo", revid: 100, text: "Hello." }]]);

    await expect(syncSinglePage("Foo")).resolves.toBe(true);

    expect(importPageRevisions).toHaveBeenCalledTimes(1);
  });

  it("answers true without writing when the revision is already stored", async () => {
    mwRevisions = new Map([[100, { title: "Foo", revid: 100 }]]);
    knownRevids = new Set([100]);

    await expect(syncSinglePage("Foo")).resolves.toBe(true);

    expect(importPageRevisions).not.toHaveBeenCalled();
  });

  it("recognises WikiOS's own export in the webhook that announces it (no duplicate revision)", async () => {
    article = storedArticle({ mwPageId: 1 });
    head = storedHead(null);
    mwRevisions = new Map([[91, { title: "Foo", revid: 91, parentid: 50, text: "WikiOS text." }]]);

    await expect(syncSinglePage("Foo")).resolves.toBe(true);

    expect(importPageRevisions).not.toHaveBeenCalled();
    expect(mockRevisionUpdateMany).toHaveBeenCalledWith({
      where: { id: "rev-9", mwRevId: null },
      data: { mwRevId: 91 },
    });
  });

  it("never parks: a conflicting edit is left to the ordered cycle and answers false", async () => {
    article = storedArticle();
    head = storedHead(90);
    mwRevisions = new Map([
      [92, { title: "Foo", revid: 92, parentid: 90, text: "Some other text." }],
      [95, { title: "Foo", revid: 95, parentid: 92, text: "A conflicting edit." }],
    ]);

    await expect(syncSinglePage("Foo")).resolves.toBe(false);

    expect(mockRevisionCreateMany).not.toHaveBeenCalled();
    expect(enqueueExport).not.toHaveBeenCalled();
    expect(importPageRevisions).not.toHaveBeenCalled();
  });

  it("answers false when MediaWiki has no such page", async () => {
    await expect(syncSinglePage("Nowhere")).resolves.toBe(false);
  });

  it("answers false, never throws, when MediaWiki is down", async () => {
    mwRevisions = new Map([[100, { title: "Foo", revid: 100 }]]);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(syncSinglePage("Foo")).resolves.toBe(false);

    consoleError.mockRestore();
  });
});
