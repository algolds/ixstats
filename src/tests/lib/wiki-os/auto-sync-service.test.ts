/** @jest-environment node */
/**
 * Plan 339 Step 2: runAutoSyncCycle is the single recentchanges sync. It keeps a high-water mark
 * in SystemConfig, follows rccontinue, never advances past a failed page, and inserts revisions
 * idempotently on (source, mwRevId).
 */
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";

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

const pageResponse = (title: string, revid: number) =>
  jsonResponse({
    query: {
      pages: {
        "1": {
          pageid: 1,
          ns: 0,
          title,
          lastrevid: revid,
          revisions: [
            {
              revid,
              timestamp: "2026-09-27T10:00:00Z",
              user: "alice",
              comment: "edit",
              slots: { main: { "*": "Body text." } },
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

test("clears cached contentHtml when the synced wikitext differs (NEW-2)", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Old body." });

  await runAutoSyncCycle();

  const args = mockWikiArticleUpsert.mock.calls[0]?.[0];
  expect(args.update).toMatchObject({ wikitext: "Body text.", contentHtml: "" });
});

test("keeps cached contentHtml when the synced wikitext is unchanged", async () => {
  rcResponses = [{ changes: [change("A", 100, 1)] }];
  mockWikiArticleFindUnique.mockResolvedValue({ wikitext: "Body text." });

  await runAutoSyncCycle();

  const args = mockWikiArticleUpsert.mock.calls[0]?.[0];
  expect(args.update).not.toHaveProperty("contentHtml");
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
