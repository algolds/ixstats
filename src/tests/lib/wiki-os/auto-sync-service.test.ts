/** @jest-environment node */
/**
 * Plan 339 Step 2: runAutoSyncCycle is the single recentchanges sync. It keeps a high-water mark
 * in SystemConfig, follows rccontinue, never advances past a failed page, and inserts revisions
 * idempotently on (source, mwRevId).
 */
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";

const mockSystemConfigFindUnique = jest.fn();
const mockSystemConfigUpsert = jest.fn();
const mockWikiArticleUpsert = jest.fn();
const mockWikiArticleFindUnique = jest.fn();
const mockWikiArticleFindFirst = jest.fn();
const mockWikiRevisionFindFirst = jest.fn();
const mockWikiRevisionCreateMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    systemConfig: {
      findUnique: (...a: unknown[]) => mockSystemConfigFindUnique(...a),
      upsert: (...a: unknown[]) => mockSystemConfigUpsert(...a),
    },
    wikiArticle: {
      upsert: (...a: unknown[]) => mockWikiArticleUpsert(...a),
      findUnique: (...a: unknown[]) => mockWikiArticleFindUnique(...a),
      findFirst: (...a: unknown[]) => mockWikiArticleFindFirst(...a),
    },
    wikiRevision: {
      findFirst: (...a: unknown[]) => mockWikiRevisionFindFirst(...a),
      createMany: (...a: unknown[]) => mockWikiRevisionCreateMany(...a),
    },
    wikiCategory: { upsert: jest.fn() },
    wikiCategoryMember: { upsert: jest.fn() },
  },
}));

jest.mock("~/lib/wiki-os/services/render-service", () => ({ enqueueRender: jest.fn() }));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));

const HWM_KEY = "wikiAutoSync.rcHighWater";

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

let mediaWikiNamespaces: Record<string, number> = {};
let mediaWikiWikitext: Record<string, string> = {};

const pageResponse = (title: string, revid: number) =>
  jsonResponse({
    query: {
      pages: {
        "1": {
          pageid: 1,
          ns: mediaWikiNamespaces[title] ?? 0,
          title,
          lastrevid: revid,
          revisions: [
            {
              revid,
              timestamp: "2026-09-27T10:00:00Z",
              user: "alice",
              comment: "edit",
              slots: { main: { "*": mediaWikiWikitext[title] ?? "Body text." } },
            },
          ],
        },
      },
    },
  });

const realFetch = globalThis.fetch;
let rcResponses: Array<{ changes: Change[]; next?: Record<string, string> }> = [];
let failingTitles = new Set<string>();

const fetchMock = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = new URL(String(input));
  if (url.searchParams.get("list") === "recentchanges") {
    const next = rcResponses.shift() ?? { changes: [] };
    return jsonResponse({
      query: { recentchanges: next.changes },
      ...(next.next ? { continue: next.next } : {}),
    });
  }
  const title = url.searchParams.get("titles") ?? "";
  return failingTitles.has(title) ? jsonResponse({}, 500) : pageResponse(title, 100);
});

const rcCalls = (): URLSearchParams[] =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)).searchParams)
    .filter((params) => params.get("list") === "recentchanges");

const syncedTitles = (): string[] =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)).searchParams.get("titles"))
    .filter((title): title is string => title !== null);

const storedHighWater = (): string | undefined =>
  mockSystemConfigUpsert.mock.calls.at(-1)?.[0]?.update?.value;

beforeEach(() => {
  jest.clearAllMocks();
  rcResponses = [];
  failingTitles = new Set();
  mediaWikiNamespaces = {};
  mediaWikiWikitext = {};
  globalThis.fetch = fetchMock as typeof fetch;
  mockSystemConfigFindUnique.mockResolvedValue(null);
  mockSystemConfigUpsert.mockResolvedValue({});
  mockWikiArticleUpsert.mockResolvedValue({ id: "art-1" });
  mockWikiArticleFindUnique.mockResolvedValue(null);
  mockWikiArticleFindFirst.mockResolvedValue(null);
  mockWikiRevisionFindFirst.mockResolvedValue(null);
  mockWikiRevisionCreateMany.mockResolvedValue({ count: 1 });
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

test("first run without HWM requests latest changes and stores the newest timestamp", async () => {
  // MediaWiki's default order is newest first.
  rcResponses = [{ changes: [change("B", 2, 2), change("A", 1, 1)] }];

  await runAutoSyncCycle();

  const [params] = rcCalls();
  expect(params?.get("rclimit")).toBe("30");
  expect(params?.get("rcdir")).toBeNull();
  expect(syncedTitles()).toEqual(["A", "B"]);
  expect(mockSystemConfigUpsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { key: HWM_KEY } })
  );
  expect(storedHighWater()).toBe("2026-09-27T10:00:02Z");
});

test("with HWM requests rcdir=newer&rcstart=<hwm>", async () => {
  mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });

  await runAutoSyncCycle();

  const [params] = rcCalls();
  expect(params?.get("rcdir")).toBe("newer");
  expect(params?.get("rcstart")).toBe("2026-09-27T09:00:00Z");
  expect(params?.get("rclimit")).toBe("50");
  expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
});

test("follows rccontinue across two pages", async () => {
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

test("does not advance HWM past a failed page sync", async () => {
  mockSystemConfigFindUnique.mockResolvedValue({ value: "2026-09-27T09:00:00Z" });
  rcResponses = [{ changes: [change("A", 1, 1), change("B", 2, 2), change("C", 3, 3)] }];
  failingTitles = new Set(["B"]);
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  await runAutoSyncCycle();

  expect(syncedTitles()).toEqual(["A", "B", "C"]);
  expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
  consoleError.mockRestore();
});

test("skips a change whose revision is already stored", async () => {
  rcResponses = [{ changes: [change("A", 1, 1)] }];
  mockWikiRevisionFindFirst.mockResolvedValue({ id: "existing" });

  await runAutoSyncCycle();

  expect(syncedTitles()).toEqual([]);
  expect(storedHighWater()).toBe("2026-09-27T10:00:01Z");
});

test("inserts revisions with createMany skipDuplicates", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];

  await runAutoSyncCycle();

  expect(mockWikiRevisionCreateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ mwRevId: 100, source: "ixwiki", articleId: "art-1" })],
    })
  );
});

test("marks the rendered view stale and queues a background render when the synced wikitext differs (NEW-2)", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Old body." });

  await runAutoSyncCycle();

  const args = mockWikiArticleUpsert.mock.calls[0]?.[0];
  expect(args.update).toMatchObject({ wikitext: "Body text.", htmlSyncedAt: null });
  // The previous HTML keeps being served until the render lands: it is never cleared.
  expect(args.update).not.toHaveProperty("contentHtml");
  expect(enqueueRender).toHaveBeenCalledTimes(1);
  expect(enqueueRender).toHaveBeenCalledWith("art-1", { background: true });
});

test("queues the first render of a page that is new to Postgres", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindUnique.mockResolvedValue(null);

  await runAutoSyncCycle();

  expect(enqueueRender).toHaveBeenCalledWith("art-1", { background: true });
});

test("leaves the rendered view and the queue alone when the synced wikitext is unchanged", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Body text." });

  await runAutoSyncCycle();

  const args = mockWikiArticleUpsert.mock.calls[0]?.[0];
  expect(args.update).not.toHaveProperty("contentHtml");
  expect(args.update).not.toHaveProperty("htmlSyncedAt");
  expect(enqueueRender).not.toHaveBeenCalled();
});

test("skips the bot revision WikiOS exported (article mwLatestRevId matches) (NEW-4)", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindFirst.mockResolvedValue({ id: "art-1" });

  await runAutoSyncCycle();

  expect(mockWikiArticleFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { source: "ixwiki", mwLatestRevId: 100 } })
  );
  expect(syncedTitles()).toEqual([]);
  expect(mockWikiArticleUpsert).not.toHaveBeenCalled();
});

test("stores the canonical title, slug and namespace of a synced page (plan 403)", async () => {
  rcResponses = [{ changes: [change("user talk:jane_doe", 100, 1)] }];

  await runAutoSyncCycle();

  const args = mockWikiArticleUpsert.mock.calls[0]?.[0];
  expect(args.where).toEqual({ source_title: { source: "ixwiki", title: "User talk:Jane doe" } });
  expect(args.create).toMatchObject({
    title: "User talk:Jane doe",
    slug: "user_talk:jane_doe",
    namespace: 3,
    namespacePrefix: "User talk",
  });
  expect(args.update).toMatchObject({
    slug: "user_talk:jane_doe",
    namespace: 3,
    namespacePrefix: "User talk",
  });
});

test("skips a change whose title MediaWiki itself would refuse", async () => {
  rcResponses = [{ changes: [change("a[b", 100, 1)] }];

  await runAutoSyncCycle();

  expect(syncedTitles()).toEqual([]);
  expect(mockWikiArticleUpsert).not.toHaveBeenCalled();
});

test("keeps MediaWiki's namespace and the title's prefix when the canonical table lacks it", async () => {
  mediaWikiNamespaces = { "Portal:Eurth": 100, "Foo: bar": 0 };
  rcResponses = [{ changes: [change("Portal:Eurth", 100, 1), change("Foo: bar", 101, 2)] }];

  await runAutoSyncCycle();

  const upsertFor = (title: string) =>
    mockWikiArticleUpsert.mock.calls.find(([args]) => args.create.title === title)?.[0];
  const portal = upsertFor("Portal:Eurth");
  expect(portal.create).toMatchObject({
    title: "Portal:Eurth",
    slug: "portal:eurth",
    namespace: 100,
    namespacePrefix: "Portal",
  });
  expect(portal.update).toMatchObject({ namespace: 100, namespacePrefix: "Portal" });

  expect(upsertFor("Foo: bar").create).toMatchObject({ namespace: 0, namespacePrefix: null });
});

test("a namespace the canonical table knows is not overridden by MediaWiki's id", async () => {
  mediaWikiNamespaces = { "Talk:x": 1 };
  rcResponses = [{ changes: [change("Talk:x", 100, 1)] }];

  await runAutoSyncCycle();

  expect(mockWikiArticleUpsert.mock.calls[0]?.[0].create).toMatchObject({
    namespace: 1,
    namespacePrefix: "Talk",
  });
});

test("stores a synced redirect's canonical target and fragment, and nulls for ordinary text (plan 402)", async () => {
  mediaWikiWikitext = { Old: "#REDIRECT [[foo_bar#Sec one]]", Plain: "See #REDIRECT [[Foo]] here." };
  rcResponses = [{ changes: [change("Old", 100, 1), change("Plain", 101, 2)] }];

  await runAutoSyncCycle();

  const upsertFor = (title: string) =>
    mockWikiArticleUpsert.mock.calls.find(([args]) => args.create.title === title)?.[0];
  const expectedRedirect = {
    redirectTargetSlug: "Foo bar",
    redirectTargetFragment: "Sec one",
  };
  expect(upsertFor("Old").create).toMatchObject(expectedRedirect);
  expect(upsertFor("Old").update).toMatchObject(expectedRedirect);
  const noRedirect = { redirectTargetSlug: null, redirectTargetFragment: null };
  expect(upsertFor("Plain").create).toMatchObject(noRedirect);
  expect(upsertFor("Plain").update).toMatchObject(noRedirect);
});

describe("watchers are told of a MediaWiki edit (plan 416, WK-19)", () => {
  it("notifies the page's watchers when a new revision changed the text, naming the diff's revisions", async () => {
    rcResponses = [{ changes: [change("A", 100, 1)] }];
    mediaWikiWikitext = { A: "New body." };
    mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Old body." });
    // The cycle first asks whether rev 100 is stored (it is not), then for the page's latest revision.
    mockWikiRevisionFindFirst.mockImplementation(async ({ where }: { where: { mwRevId?: number } }) =>
      where.mwRevId ? null : { id: "r_prev", mwRevId: 99, byteSize: 9 }
    );

    await runAutoSyncCycle();

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "edited",
      articleId: "art-1",
      title: "A",
      editor: "alice",
      editorWikiUsername: "alice",
      summary: "edit",
      previousRef: "99",
      currentRef: "100",
    });
  });

  it("does not notify when the text did not change (the echo of a WikiOS save) or the revision was already known", async () => {
    rcResponses = [{ changes: [change("A", 100, 1)] }];
    mediaWikiWikitext = { A: "Same body." };
    mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Same body." });
    await runAutoSyncCycle();
    expect(notifyWatchers).not.toHaveBeenCalled();

    rcResponses = [{ changes: [change("A", 101, 2)] }];
    mediaWikiWikitext = { A: "Another body." };
    mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Old." });
    mockWikiRevisionCreateMany.mockResolvedValue({ count: 0 }); // skipDuplicates: nothing inserted
    await runAutoSyncCycle();
    expect(notifyWatchers).not.toHaveBeenCalled();
  });
});
