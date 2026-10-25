/** @jest-environment node */
/**
 * Plan 403: ArticleRepository writes and reads one MediaWiki-canonical identity per title.
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { enqueueRender, invalidateDependents } from "~/lib/wiki-os/services/render-service";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";
import { scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";
import { Prisma } from "@prisma/client";
import { InternalError } from "~/lib/app-error";
import { DeletedPageError, EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const mockUpsert = jest.fn();
const mockCount = jest.fn();
const mockRevisionFindFirst = jest.fn();
const mockRevisionCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockRevisionFindMany = jest.fn();
const mockJobCreate = jest.fn();
const mockQueryRaw = jest.fn();
const mockTransactionOptions = jest.fn();
const mockTxArticleFindUnique = jest.fn();
const mockExecuteRaw = jest.fn();
const mockConflictFindUnique = jest.fn();
const mockConflictUpdateMany = jest.fn();

jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/server/db", () => {
  const tx = {
    user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    wikiArticle: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      count: (...a: unknown[]) => mockCount(...a),
      findUnique: (...a: unknown[]) => mockTxArticleFindUnique(...a),
    },
    wikiRevision: {
      findFirst: (...a: unknown[]) => mockRevisionFindFirst(...a),
      create: (...a: unknown[]) => mockRevisionCreate(...a),
    },
    wikiMirrorJob: { create: (...a: unknown[]) => mockJobCreate(...a) },
    wikiConflict: {
      findUnique: (...a: unknown[]) => mockConflictFindUnique(...a),
      updateMany: (...a: unknown[]) => mockConflictUpdateMany(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  };
  return {
    db: {
      $transaction: (cb: (t: typeof tx) => unknown, options?: unknown) => {
        mockTransactionOptions(options);
        return cb(tx);
      },
      wikiRevision: {
        findMany: (...a: unknown[]) => mockRevisionFindMany(...a),
        findFirst: (...a: unknown[]) => mockRevisionFindFirst(...a),
      },
      wikiArticle: {
        findUnique: (...a: unknown[]) => mockFindUnique(...a),
        findMany: (...a: unknown[]) => mockFindMany(...a),
        findFirst: (...a: unknown[]) => mockFindFirst(...a),
      },
      // describeEachWikiosMode answers the switch and marker rows through this mock
      systemConfig: { findUnique: jest.fn() },
    },
  };
});
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));

const savedRow = (title: string) => ({
  id: "a1",
  title,
  slug: title.toLowerCase(),
  source: "ixwiki",
  wikitext: "body",
  namespace: 0,
  namespacePrefix: null,
  protectionLevel: "ALL",
  protectionExpiry: null,
  syncedAt: new Date(),
  updatedAt: new Date(),
});

const articleRow = (title: string, overrides: Record<string, unknown> = {}) => ({
  id: `id-${title}`,
  title,
  source: "ixwiki",
  status: "PUBLISHED",
  format: "WIKITEXT",
  contentHtml: "<p>x</p>",
  contentJson: null,
  wikitext: `body of ${title}`,
  summary: null,
  namespace: 0,
  namespacePrefix: null,
  protectionLevel: "ALL",
  protectionExpiry: null,
  redirectTargetSlug: null,
  redirectTargetFragment: null,
  readingTime: 1,
  wordCount: 3,
  viewCount: 0,
  leadImageUrl: null,
  authorId: null,
  lastEditorId: null,
  syncedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCount.mockResolvedValue(0);
  mockRevisionFindFirst.mockResolvedValue(null);
  mockRevisionCreate.mockResolvedValue({ id: "r1" });
  mockJobCreate.mockResolvedValue({});
  mockQueryRaw.mockResolvedValue([{ id: "a1" }]); // the page's row, locked
  mockTxArticleFindUnique.mockResolvedValue(null);
  mockExecuteRaw.mockResolvedValue(0);
  mockFindUnique.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(null);
  mockRevisionFindMany.mockResolvedValue([]);
  mockConflictFindUnique.mockResolvedValue({ trailRevisionId: null });
  mockConflictUpdateMany.mockResolvedValue({ count: 1 });
});

describe("ArticleRepository.saveArticle", () => {
  const save = (
    slug: string,
    title = "",
    wikitext = "body",
    extra: { editSummary?: string; excerpt?: string } = {}
  ) => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug, title, wikitext, ...extra });
  };

  it("upserts on the canonical title, not the spelling that was typed", async () => {
    await save("foo_bar");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.where).toEqual({ source_title: { source: "ixwiki", title: "Foo bar" } });
    expect(args.create).toMatchObject({ title: "Foo bar", slug: "foo_bar" });
    expect(args.update).toMatchObject({ slug: "foo_bar" });
  });
  it("rejects a title MediaWiki would refuse before touching the database", async () => {
    await expect(save("a[b")).rejects.toThrow("Invalid title");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("ArticleRepository.saveArticle and the rendered view (plan 404)", () => {
  const save = (wikitext: string, extra: { contentHtml?: string } = {}) => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext, ...extra });
  };

  it("marks the view stale and never clears the HTML readers are still served", async () => {
    await save("new text");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.update).toMatchObject({ wikitext: "new text", htmlSyncedAt: null });
    expect(args.update).not.toHaveProperty("contentHtml");
    expect(args.create).not.toHaveProperty("htmlSyncedAt");
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).not.toHaveProperty("contentHtml", "");
  });

  it("a save that blanks the page leaves the stored HTML alone (the render replaces it: renderArticle shows nothing for a page whose current revision is empty), marks it stale and queues the render", async () => {
    await save("");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.update).toMatchObject({ wikitext: "", htmlSyncedAt: null });
    expect(args.update).not.toHaveProperty("contentHtml");
    // the new current revision IS the blank text: 0 bytes, not hidden, not parked
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({ wikitext: "", byteSize: 0 });
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).not.toHaveProperty("textDeleted", true);
    expect(enqueueRender).toHaveBeenCalledTimes(1);
  });
  it("compares the text in the database: a count on the title and the new wikitext, nothing read back", async () => {
    await save("new text");

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockCount.mock.calls[0]?.[0]).toEqual({
      where: { source: "ixwiki", title: "Foo", wikitext: "new text" },
    });
  });
  it("leaves the view and the queue alone when the saved text is the text of a row with no revision yet", async () => {
    mockCount.mockResolvedValue(1);

    await save("same text");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.update).not.toHaveProperty("htmlSyncedAt");
    expect(args.update).not.toHaveProperty("contentHtml");
    expect(enqueueRender).not.toHaveBeenCalled();
    // The page had no revision (no head to return), so its text is recorded as one.
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
  });
  it("queues no render when the transaction failed", async () => {
    mockUpsert.mockRejectedValue(new Error("db down"));

    await expect(
      ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext: "text" })
    ).rejects.toThrow("db down");
    expect(enqueueRender).not.toHaveBeenCalled();
  });
});

describe("ArticleRepository.saveArticle after plan 406", () => {
  const save = (wikitext: string) => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext });
  };
  it("marks the pages that transclude the saved page stale, after the transaction, only when its text changed", async () => {
    await save("new text");
    expect(invalidateDependents).toHaveBeenCalledTimes(1);
    expect(invalidateDependents).toHaveBeenCalledWith("Foo", "ixwiki");

    jest.mocked(invalidateDependents).mockClear();
    mockCount.mockResolvedValue(1);
    await save("same text");
    expect(invalidateDependents).not.toHaveBeenCalled();
  });

  it("sizes the new revision against the page's current revision, never a parked one", async () => {
    mockRevisionFindFirst.mockResolvedValue({ byteSize: 3 });

    await save("four");

    expect(mockRevisionFindFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { articleId: "a1", parked: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({ byteSize: 4, byteDelta: 1 });
  });
});

describe("ArticleRepository.saveArticle: a save that cannot get its turn is busy, not broken (m2)", () => {
  const save = () => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug: "foo", title: "Foo", wikitext: "new text" });
  };
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("Transaction API error: Transaction already closed", {
      code,
      clientVersion: "test",
    });

  it("limits how long it waits for the page's lock to 10 s (lock_timeout, for the transaction only), before it asks for the lock", async () => {
    await save();

    const [strings, ...values] = mockExecuteRaw.mock.calls[0]!;
    expect((strings as TemplateStringsArray).join("?")).toBe(
      "SELECT set_config('lock_timeout', ?, true)"
    );
    expect(values).toEqual(["10s"]);
    expect(mockExecuteRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockQueryRaw.mock.invocationCallOrder[0]!
    );
  });
  it.each([
    ["Prisma's P2028 (the transaction timed out or could not start)", () => prismaError("P2028")],
    ["P2034 (a deadlock or write conflict)", () => prismaError("P2034")],
    [
      "PostgreSQL's lock timeout (55P03), which Prisma reports for a raw query as P2010",
      () =>
        new Prisma.PrismaClientKnownRequestError(
          "Raw query failed. Code: `55P03`. Message: `ERROR: canceling statement due to lock timeout`",
          { code: "P2010", clientVersion: "test" }
        ),
    ],
    [
      "the InternalError the database client makes of a timed-out query inside the transaction",
      () =>
        new InternalError(
          "Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction."
        ),
    ],
  ])("answers PageBusyError, retryable and a 409 for tRPC, for %s", async (_name, error) => {
    mockQueryRaw.mockRejectedValue(error());

    const failure = await save().catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(PageBusyError);
    expect(failure).toMatchObject({
      statusCode: 409,
      trpcCode: "CONFLICT",
      message: expect.stringContaining("busy"),
    });
    expect(mockRevisionCreate).not.toHaveBeenCalled();
  });
});

describe("ArticleRepository.saveArticle: the page is locked, and the edit-conflict check is part of the save (F1)", () => {
  const HEAD = { id: "rev-head", mwRevId: null, byteSize: 10 };
  const save = (extra: { expectedHeadRef?: string | null } = {}, wikitext = "new text") => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug: "foo", title: "Foo", wikitext, ...extra });
  };
  const nothingWritten = () => {
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockRevisionCreate).not.toHaveBeenCalled();
    expect(mockJobCreate).not.toHaveBeenCalled();
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
    expect(enqueueRender).not.toHaveBeenCalled();
    expect(notifyWatchers).not.toHaveBeenCalled();
  };

  it("locks the article row (FOR NO KEY UPDATE, by source and title) before it reads the head, and reads the head before it writes", async () => {
    mockRevisionFindFirst.mockResolvedValue(HEAD);

    await save();

    const sql = (mockQueryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
    expect(sql).toMatch(
      /FROM wiki_articles WHERE "source" = \? AND "title" = \? FOR NO KEY UPDATE/
    );
    expect(mockQueryRaw.mock.calls[0]?.slice(1)).toEqual(["ixwiki", "Foo"]);
    // the row exists: the only raw statement besides the lock is the wait limit, no advisory lock
    expect(
      mockExecuteRaw.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join("?"))
    ).toEqual(["SELECT set_config('lock_timeout', ?, true)"]);
    const order = (fn: jest.Mock) => fn.mock.invocationCallOrder[0]!;
    expect(order(mockQueryRaw)).toBeLessThan(order(mockRevisionFindFirst));
    expect(order(mockRevisionFindFirst)).toBeLessThan(order(mockUpsert));
    expect(order(mockUpsert)).toBeLessThan(order(mockRevisionCreate));
  });

  it("queues the creators of a page that has no row yet on an advisory lock (taken with $executeRaw: it returns void), keyed by source and title", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await save({ expectedHeadRef: null });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(2); // the wait limit, then the advisory lock
    const [strings, ...values] = mockExecuteRaw.mock.calls[1]!;
    expect((strings as TemplateStringsArray).join("?")).toMatch(
      /SELECT pg_advisory_xact_lock\(\?::int, hashtext\(\?\)\)/
    );
    expect(values).toEqual([41102, "ixwiki:Foo"]);
    // and only then looks for a head
    expect(mockExecuteRaw.mock.invocationCallOrder[1]).toBeLessThan(
      mockRevisionFindFirst.mock.invocationCallOrder[0]!
    );
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
  });

  it("throws an edit conflict, writes nothing and tells nobody when the base is not the head", async () => {
    mockRevisionFindFirst.mockResolvedValue({ id: "rev-head", mwRevId: 4321, byteSize: 10 });
    mockTxArticleFindUnique.mockResolvedValue({ wikitext: "Somebody else's text" });

    const failure = await save({ expectedHeadRef: "rev-older" }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EditConflictError);
    expect((failure as EditConflictError).conflict).toEqual({
      currentWikitext: "Somebody else's text",
      currentRevisionRef: "4321",
    });
    expect(mockTxArticleFindUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { source_title: { source: "ixwiki", title: "Foo" } },
    });
    nothingWritten();
  });

  it("saves when the base names the head by its row id or, once stamped, by its MediaWiki rev_id", async () => {
    mockRevisionFindFirst.mockResolvedValue({ id: "rev-head", mwRevId: 4321, byteSize: 10 });

    await save({ expectedHeadRef: "rev-head" });
    await save({ expectedHeadRef: "4321" });

    expect(mockRevisionCreate).toHaveBeenCalledTimes(2);
  });

  it("takes a null base as 'the editor believes the page is new': fine for a page with no live revision, a conflict for one that has", async () => {
    await save({ expectedHeadRef: null });
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ id: "a1" }]);
    mockRevisionFindFirst.mockResolvedValue(HEAD);
    mockTxArticleFindUnique.mockResolvedValue({ wikitext: "A page made meanwhile" });
    const failure = await save({ expectedHeadRef: null }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EditConflictError);
    expect((failure as EditConflictError).conflict).toEqual({
      currentWikitext: "A page made meanwhile",
      currentRevisionRef: "rev-head",
    });
    nothingWritten();
  });

  it("conflicts when the editor had a base but the page has no live revision any more", async () => {
    mockRevisionFindFirst.mockResolvedValue(null);
    mockTxArticleFindUnique.mockResolvedValue(null);

    const failure = await save({ expectedHeadRef: "rev-gone" }).catch((error: unknown) => error);

    expect((failure as EditConflictError).conflict).toEqual({
      currentWikitext: "",
      currentRevisionRef: null,
    });
    nothingWritten();
  });
  it("makes the check against the latest LIVE revision, read by the locked row's id: a parked one is not the head", async () => {
    await save({ expectedHeadRef: "rev-head" }).catch(() => undefined);

    // O(1) in the length of the history: the (articleId, parked, createdAt) index, no join
    expect(mockRevisionFindFirst.mock.calls[0]?.[0].where).toEqual({
      articleId: "a1",
      parked: false,
    });
    expect(mockRevisionFindFirst.mock.calls[0]?.[0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });
  it("records the head it was made on top of as the new revision's parent (F5), none for the first revision", async () => {
    mockRevisionFindFirst.mockResolvedValue(HEAD);
    await save();
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({
      parentRevisionId: "rev-head",
      byteDelta: Buffer.byteLength("new text") - 10,
    });

    mockRevisionCreate.mockClear();
    mockRevisionFindFirst.mockResolvedValue(null);
    await save();
    expect(mockRevisionCreate.mock.calls[0]?.[0].data.parentRevisionId).toBeNull();
  });
});
describe("ArticleRepository.saveArticle and the mirror outbox (plan 407)", () => {
  const save = (extra: { source?: string } = {}) => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext: "text", ...extra });
  };

  it("inserts exactly one revision job, inside the transaction and after the revision it names", async () => {
    const order: string[] = [];
    mockRevisionCreate.mockImplementation(async () => {
      order.push("revision");
      return { id: "r1" };
    });
    mockJobCreate.mockImplementation(async () => void order.push("job"));
    jest.mocked(enqueueRender).mockImplementation(() => void order.push("enqueue"));

    await save();

    expect(mockJobCreate).toHaveBeenCalledTimes(1);
    expect(mockJobCreate).toHaveBeenCalledWith({
      data: {
        source: "ixwiki",
        kind: "revision",
        title: "Foo",
        articleId: "a1",
        revisionId: "r1",
      },
    });
    // the job is part of the transaction: it is written before the post-commit work
    expect(order).toEqual(["revision", "job", "enqueue"]);
  });
  it("writes no job for the MediaWiki: namespace: the mirror account may never write it", async () => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );

    await ArticleRepository.saveArticle({
      slug: "MediaWiki:Sidebar",
      title: "MediaWiki:Sidebar",
      wikitext: "text",
    });

    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
    expect(mockJobCreate).not.toHaveBeenCalled();
  });
  it("names the saved page by its canonical title, not the spelling that was typed", async () => {
    await ArticleRepository.saveArticle({ slug: "foo_bar", title: "", wikitext: "text" });

    expect(mockJobCreate.mock.calls[0]?.[0].data).toMatchObject({
      kind: "revision",
      title: "Foo bar",
    });
  });
  it("fails the save, and queues nothing after it, when the job cannot be written", async () => {
    mockJobCreate.mockRejectedValue(new Error("outbox down"));

    await expect(save()).rejects.toThrow("outbox down");
    expect(enqueueRender).not.toHaveBeenCalled();
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
  });
});
describeEachWikiosMode(
  "ArticleRepository.saveArticle: deleted pages and null edits (Task 14, A7)",
  () => {
    const page = {
      id: "a1",
      title: "Foo",
      source: "ixwiki",
      status: "PUBLISHED",
      namespace: 0,
      namespacePrefix: null,
      protectionLevel: "ALL",
      protectionExpiry: null,
      syncedAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    };
    const save = (wikitext = "same text") =>
      ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext }, "user-1", "Heku");

    it("reads the locked row's status (never its text) after the lock, and refuses a deleted page before writing", async () => {
      const order: string[] = [];
      mockQueryRaw.mockImplementation(async () => {
        order.push("lock");
        return [{ id: "a1" }];
      });
      mockTxArticleFindUnique.mockImplementation(async () => {
        order.push("status");
        return { ...page, status: "ARCHIVED" };
      });

      await expect(save()).rejects.toBeInstanceOf(DeletedPageError);

      expect(order).toEqual(["lock", "status"]);
      const read = mockTxArticleFindUnique.mock.calls[0]?.[0];
      expect(read.where).toEqual({ source_title: { source: "ixwiki", title: "Foo" } });
      expect(read.select).toMatchObject({ status: true });
      expect(read.select).not.toHaveProperty("wikitext");
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockRevisionCreate).not.toHaveBeenCalled();
      expect(mockJobCreate).not.toHaveBeenCalled();
      expect(scheduleMirrorKick).not.toHaveBeenCalled();
    });

    it("a null edit writes no revision and no mirror job and returns the head", async () => {
      mockTxArticleFindUnique.mockResolvedValue(page);
      mockRevisionFindFirst.mockResolvedValue({ id: "h1", mwRevId: 41, byteSize: 9 });
      mockCount.mockResolvedValue(1);

      const saved = await save();

      expect(saved.nullEdit).toBe(true);
      expect(saved.revisionId).toBe("h1");
      expect(saved.article).toMatchObject({ id: "a1", title: "Foo", wikitext: "same text" });
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockRevisionCreate).not.toHaveBeenCalled();
      expect(mockJobCreate).not.toHaveBeenCalled();
      expect(scheduleMirrorKick).not.toHaveBeenCalled();
      expect(enqueueRender).not.toHaveBeenCalled();
      expect(invalidateDependents).not.toHaveBeenCalled();
      expect(notifyWatchers).not.toHaveBeenCalled();
    });

    it("is no null edit when the head's text is hidden: the head read carries textDeleted", async () => {
      mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
        savedRow(args.create.title)
      );
      mockTxArticleFindUnique.mockResolvedValue(page);
      mockRevisionFindFirst.mockResolvedValue({
        id: "h1",
        mwRevId: 41,
        byteSize: 9,
        textDeleted: true,
      });
      mockCount.mockResolvedValue(1);

      const saved = await save();

      expect(saved).toMatchObject({ nullEdit: false, revisionId: "r1" });
      expect(mockRevisionFindFirst.mock.calls[0]?.[0].select).toMatchObject({ textDeleted: true });
      expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
    });

    it("is no null edit when the text changed", async () => {
      mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
        savedRow(args.create.title)
      );
      mockTxArticleFindUnique.mockResolvedValue(page);
      mockRevisionFindFirst.mockResolvedValue({ id: "h1", mwRevId: 41, byteSize: 9 });

      const saved = await save("other text");

      expect(saved).toMatchObject({ nullEdit: false, revisionId: "r1" });
      expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
      expect(mockJobCreate).toHaveBeenCalledTimes(1);
    });
  }
);

describe("ArticleRepository.recordTrailRevision (the classic winner's trail)", () => {
  const head = { id: "h1", wikitext: "Caphiria is an empire." };
  const trail = () =>
    ArticleRepository.recordTrailRevision({
      articleId: "a1",
      summary: "Overwrote revision 7 by Foo, saved from the same version (conflict c1)",
      conflictId: "c1",
    });

  beforeEach(() => {
    mockTxArticleFindUnique.mockResolvedValue({ id: "a1", title: "Caphiria", source: "ixwiki" });
    mockRevisionFindFirst.mockResolvedValue(head);
    mockRevisionCreate.mockResolvedValue({ id: "t1" });
  });

  it("recordTrailRevision copies the head text, enqueues one job and refuses a second trail", async () => {
    await expect(trail()).resolves.toEqual({ revisionId: "t1" });

    expect(mockQueryRaw).toHaveBeenCalled(); // under the page's lock
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
    expect(mockRevisionCreate.mock.calls[0]![0].data).toMatchObject({
      articleId: "a1",
      wikitext: "Caphiria is an empire.",
      summary: "Overwrote revision 7 by Foo, saved from the same version (conflict c1)",
      author: "WikiOS",
      authorId: null,
      parentRevisionId: "h1",
      byteSize: 22,
      byteDelta: 0,
      minor: true,
    });
    expect(mockConflictUpdateMany).toHaveBeenCalledWith({
      where: { id: "c1", trailRevisionId: null },
      data: { trailRevisionId: "t1" },
    });
    expect(mockJobCreate).toHaveBeenCalledTimes(1);
    expect(mockJobCreate).toHaveBeenCalledWith({
      data: {
        source: "ixwiki",
        kind: "revision",
        title: "Caphiria",
        articleId: "a1",
        revisionId: "t1",
      },
    });
    expect(scheduleMirrorKick).toHaveBeenCalled();
    // the text did not change: no render, no watchers
    expect(enqueueRender).not.toHaveBeenCalled();
    expect(notifyWatchers).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();

    mockConflictFindUnique.mockResolvedValue({ trailRevisionId: "t1" });
    await expect(trail()).resolves.toBeNull();
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
    expect(mockJobCreate).toHaveBeenCalledTimes(1);
  });

  it("writes no trail on a page deleted before it got the lock: no revision, no job, nothing claimed", async () => {
    // the first read finds the page, the read under the lock finds it deleted
    mockTxArticleFindUnique
      .mockResolvedValueOnce({ id: "a1", title: "Caphiria", source: "ixwiki" })
      .mockResolvedValueOnce({ status: "ARCHIVED" });

    await expect(trail()).resolves.toBeNull();

    const order = [
      mockQueryRaw.mock.invocationCallOrder[0]!,
      mockTxArticleFindUnique.mock.invocationCallOrder[1]!,
    ];
    expect(order[0]).toBeLessThan(order[1]); // the status is read under the page's lock
    expect(mockTxArticleFindUnique.mock.calls[1]?.[0]).toEqual({
      where: { id: "a1" },
      select: { status: true },
    });
    expect(mockRevisionCreate).not.toHaveBeenCalled();
    expect(mockConflictUpdateMany).not.toHaveBeenCalled();
    expect(mockJobCreate).not.toHaveBeenCalled();
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
  });

  it("logs the skip under the lock as the check before the lock does, and only then", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(trail()).resolves.toEqual({ revisionId: "t1" });
      expect(warn).not.toHaveBeenCalled();

      mockTxArticleFindUnique
        .mockResolvedValueOnce({ id: "a1", title: "Caphiria", source: "ixwiki" })
        .mockResolvedValueOnce({ status: "ARCHIVED" });
      await expect(trail()).resolves.toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "[WikiConflicts] No trail for conflict c1: its page is deleted."
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("a trail another writer claimed first answers null and enqueues no job", async () => {
    mockConflictUpdateMany.mockResolvedValue({ count: 0 });

    await expect(trail()).resolves.toBeNull();
    expect(mockJobCreate).not.toHaveBeenCalled();
  });
});

describe("ArticleRepository.findBySlug", () => {
  it("returns the exact canonical row even when a case-variant row also exists", async () => {
    const rows = new Map([
      ["foo bar", articleRow("foo bar", { wikitext: "stale text" })],
      ["Foo bar", articleRow("Foo bar")],
    ]);
    mockFindUnique.mockImplementation(
      async (args: { where: { source_title: { title: string } } }) =>
        rows.get(args.where.source_title.title) ?? null
    );

    const article = await ArticleRepository.findBySlug("foo_bar");

    expect(mockFindUnique.mock.calls[0]?.[0].where).toEqual({
      source_title: { source: "ixwiki", title: "Foo bar" },
    });
    expect(article?.title).toBe("Foo bar");
    expect(article?.wikitext).toBe("body of Foo bar");
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("keeps NATO and Nato as two different articles", async () => {
    const rows = new Map([
      ["NATO", articleRow("NATO")],
      ["Nato", articleRow("Nato")],
    ]);
    mockFindUnique.mockImplementation(
      async (args: { where: { source_title: { title: string } } }) =>
        rows.get(args.where.source_title.title) ?? null
    );

    expect((await ArticleRepository.findBySlug("NATO"))?.title).toBe("NATO");
    expect((await ArticleRepository.findBySlug("Nato"))?.title).toBe("Nato");
    expect((await ArticleRepository.findBySlug("nato"))?.title).toBe("Nato");
  });

  it("falls back to a unique case-variant row by slug", async () => {
    mockFindMany.mockResolvedValue([articleRow("NATO")]);

    const article = await ArticleRepository.findBySlug("nato");

    expect(mockFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "ixwiki", slug: "nato" },
      orderBy: { updatedAt: "desc" },
      take: 2,
    });
    expect(article?.title).toBe("NATO");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("does not guess between two case-variant rows: the last resort takes the newest", async () => {
    mockFindMany.mockResolvedValue([articleRow("NATO"), articleRow("Nato")]);
    mockFindFirst.mockResolvedValue(articleRow("NATO"));

    const article = await ArticleRepository.findBySlug("nAto");

    const args = mockFindFirst.mock.calls[0]?.[0];
    expect(args.orderBy).toEqual({ updatedAt: "desc" });
    expect(args.where.OR.length).toBeGreaterThan(0);
    expect(article?.title).toBe("NATO");
  });
});

describe("ArticleRepository.getHistory", () => {
  // what the select returns: no wikitext, no format, no author id
  const revision = (articleId: string, id = `rev-${articleId}`) => ({
    id,
    mwRevId: null,
    summary: null,
    minor: false,
    author: "alice",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    byteSize: 4,
    byteDelta: 4,
    sha1: null,
    parked: false,
    textDeleted: false,
    commentDeleted: false,
    userDeleted: false,
  });

  it("reads the revisions of the one canonical article, never a case variant's", async () => {
    const rows = new Map([
      ["foo bar", articleRow("foo bar")],
      ["Foo bar", articleRow("Foo bar")],
    ]);
    mockFindUnique.mockImplementation(
      async (args: { where: { source_title: { title: string } } }) =>
        rows.get(args.where.source_title.title) ?? null
    );
    mockRevisionFindMany.mockResolvedValue([revision("id-Foo bar")]);

    const history = await ArticleRepository.getHistory("foo_bar", "ixwiki", 10);

    expect(mockRevisionFindMany).toHaveBeenCalledTimes(1);
    expect(mockRevisionFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { articleId: "id-Foo bar", parked: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    });
    expect(history).toEqual([
      expect.objectContaining({ articleId: "id-Foo bar", author: "alice" }),
    ]);
  });
  it("leaves parked revisions out by default (the first entry is the page's current revision) and lists them, flagged, on request", async () => {
    mockFindMany.mockResolvedValue([articleRow("NATO")]);
    mockRevisionFindMany.mockResolvedValue([
      { ...revision("id-NATO"), parked: true },
      { ...revision("id-NATO"), parked: false },
    ]);

    await ArticleRepository.getHistory("nato");
    expect(mockRevisionFindMany.mock.calls[0]?.[0].where).toEqual({
      articleId: "id-NATO",
      parked: false,
    });

    const history = await ArticleRepository.getHistory("nato", "ixwiki", 50, undefined, {
      includeParked: true,
    });
    expect(mockRevisionFindMany.mock.calls[1]?.[0].where).toEqual({ articleId: "id-NATO" });
    expect(history.map((r) => r.parked)).toEqual([true, false]);
  });

  describe("a parked revision between two live ones (plan 406)", () => {
    // newest first: live r3, PARKED r2, live r1. The fake honours `where.parked`, the cursor and `take`.
    const history = [
      { ...revision("Foo", "r3"), parked: false, createdAt: new Date("2026-06-03T00:00:00Z") },
      { ...revision("Foo", "r2"), parked: true, createdAt: new Date("2026-06-02T00:00:00Z") },
      { ...revision("Foo", "r1"), parked: false, createdAt: new Date("2026-06-01T00:00:00Z") },
    ];
    type Where = { id?: string; parked?: boolean };
    const visible = (where: Where) => history.filter((r) => where.parked !== false || !r.parked);

    beforeEach(() => {
      mockFindUnique.mockResolvedValue(articleRow("Foo"));
      mockRevisionFindFirst.mockImplementation(
        async ({ where }: { where: Where }) => visible(where).find((r) => r.id === where.id) ?? null
      );
      mockRevisionFindMany.mockImplementation(
        async ({
          where,
          take,
          skip = 0,
          cursor,
        }: {
          where: Where;
          take: number;
          skip?: number;
          cursor?: { id: string };
        }) => {
          const rows = visible(where);
          const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + skip : 0;
          return rows.slice(start, start + take);
        }
      );
    });

    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

    it("is invisible to history paging: neither a page's entry, nor where the next page starts", async () => {
      expect(ids(await ArticleRepository.getHistory("Foo", "ixwiki", 10))).toEqual(["r3", "r1"]);
      // paging one at a time steps over it
      expect(ids(await ArticleRepository.getHistory("Foo", "ixwiki", 1))).toEqual(["r3"]);
      expect(ids(await ArticleRepository.getHistory("Foo", "ixwiki", 1, { before: "r3" }))).toEqual(
        ["r1"]
      );
      // it cannot be the anchor of a page either: "after r2" names nothing the default list shows
      expect(await ArticleRepository.getHistory("Foo", "ixwiki", 5, { before: "r2" })).toEqual([]);
      expect(await ArticleRepository.getHistory("Foo", "ixwiki", 5, { from: "r2" })).toEqual([]);
    });

    it("is the diff base's blind spot: the revision before the live r3 is r1, never r2", async () => {
      // what getDiff reads: the revision itself and the one after it, from r3
      const [revision3, base] = await ArticleRepository.getHistory("Foo", "ixwiki", 2, {
        from: "r3",
      });

      expect([revision3?.id, base?.id]).toEqual(["r3", "r1"]);
    });
  });
});
