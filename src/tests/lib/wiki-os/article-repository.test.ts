/** @jest-environment node */
/**
 * Plan 403: ArticleRepository writes and reads one MediaWiki-canonical identity per title.
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { enqueueRender, invalidateDependents } from "~/lib/wiki-os/services/render-service";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";
import { scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";
import { Prisma } from "@prisma/client";
import { InternalError } from "~/lib/app-error";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";

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

  it("canonicalizes `title` when both are given", async () => {
    await save("ignored", "foo_bar");

    expect(mockUpsert.mock.calls[0]?.[0].where.source_title.title).toBe("Foo bar");
  });

  it("writes the namespace of a Talk: page on create and update", async () => {
    await save("Talk:x");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.where.source_title.title).toBe("Talk:X");
    expect(args.create).toMatchObject({ namespace: 1, namespacePrefix: "Talk" });
    expect(args.update).toMatchObject({ namespace: 1, namespacePrefix: "Talk" });
  });

  it("writes the main namespace for an ordinary page", async () => {
    await save("Foo");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.create).toMatchObject({ namespace: 0, namespacePrefix: null });
    expect(args.update).toMatchObject({ namespace: 0, namespacePrefix: null });
  });

  it("rejects a title MediaWiki would refuse before touching the database", async () => {
    await expect(save("a[b")).rejects.toThrow("Invalid title");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("keeps the edit summary on the revision and the excerpt of the text on the article (plan 402)", async () => {
    const text = "Foo is a [[country]] in Eurth.";
    const { article } = await save("Foo", "", text, { editSummary: "fixed typo" });

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.create.summary).toBe("Foo is a country in Eurth.");
    expect(args.update.summary).toBe("Foo is a country in Eurth.");
    expect(article.summary).toBe("Foo is a country in Eurth.");
    expect(mockRevisionCreate.mock.calls[0]?.[0].data.summary).toBe("fixed typo");
  });

  it("does not blank the excerpt when the edit summary is empty (plan 402)", async () => {
    await save("Foo", "", "Foo is a country.", { editSummary: "" });

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.update.summary).toBe("Foo is a country.");
    expect(mockRevisionCreate.mock.calls[0]?.[0].data.summary).toBe("");
  });

  it("stores no edit summary as null and never uses it as the excerpt (plan 402)", async () => {
    await save("Foo", "", "Foo is a country.");

    expect(mockRevisionCreate.mock.calls[0]?.[0].data.summary).toBeNull();
    expect(mockUpsert.mock.calls[0]?.[0].create.summary).toBe("Foo is a country.");
  });

  it("caps the derived excerpt and lets an explicit excerpt override it (plan 402)", async () => {
    await save("Foo", "", "word ".repeat(500));
    expect(mockUpsert.mock.calls[0]?.[0].create.summary.length).toBeLessThanOrEqual(480);

    await save("Foo", "", "Foo is a country.", { excerpt: "Custom excerpt." });
    expect(mockUpsert.mock.calls[1]?.[0].create.summary).toBe("Custom excerpt.");
    expect(mockUpsert.mock.calls[1]?.[0].update.summary).toBe("Custom excerpt.");
  });

  it("clamps an explicit excerpt to the VarChar(500) column (plan 402)", async () => {
    await save("Foo", "", "Foo is a country.", { excerpt: "x".repeat(2_000) });

    expect(mockUpsert.mock.calls[0]?.[0].create.summary).toHaveLength(480);
    expect(mockUpsert.mock.calls[0]?.[0].update.summary).toHaveLength(480);
  });

  it("derives the excerpt from the lead of a huge page only (plan 402)", async () => {
    const lead = "Foo is a country in Eurth. ";
    const text = lead + "filler ".repeat(300_000);
    const started = performance.now();

    await save("Foo", "", text);

    expect(performance.now() - started).toBeLessThan(1_000);
    const summary: string = mockUpsert.mock.calls[0]?.[0].create.summary;
    expect(summary.startsWith("Foo is a country in Eurth.")).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(480);
  });

  it("stores a null excerpt for a blank page (plan 402)", async () => {
    await save("Foo", "", "");

    expect(mockUpsert.mock.calls[0]?.[0].update.summary).toBeNull();
  });

  it("writes a redirect's canonical target title and fragment on create and update (plan 402)", async () => {
    const { article } = await save("Old", "", "#REDIRECT [[foo#Bar]]");

    const args = mockUpsert.mock.calls[0]?.[0];
    const expected = { redirectTargetSlug: "Foo", redirectTargetFragment: "Bar" };
    expect(args.create).toMatchObject(expected);
    expect(args.update).toMatchObject(expected);
    expect(article).toMatchObject(expected);
  });

  it("writes nulls for ordinary text, so an edited-away redirect is cleared (plan 402)", async () => {
    const { article } = await save("Old", "", "Now a real article. #REDIRECT [[Foo]]");

    const args = mockUpsert.mock.calls[0]?.[0];
    const expected = { redirectTargetSlug: null, redirectTargetFragment: null };
    expect(args.create).toMatchObject(expected);
    expect(args.update).toMatchObject(expected);
    expect(article).toMatchObject(expected);
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

  it("leaves the view and the queue alone when the saved text is the text already stored", async () => {
    mockCount.mockResolvedValue(1);

    await save("same text");

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.update).not.toHaveProperty("htmlSyncedAt");
    expect(args.update).not.toHaveProperty("contentHtml");
    expect(enqueueRender).not.toHaveBeenCalled();
    // The revision is still recorded: a null edit is an edit.
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
  });

  it("queues the first render of a page that is new", async () => {
    mockCount.mockResolvedValue(0);

    await save("brand new");

    expect(mockUpsert.mock.calls[0]?.[0].create).not.toHaveProperty("htmlSyncedAt");
    expect(enqueueRender).toHaveBeenCalledWith("a1");
  });

  it("stores HTML only when the caller hands it one", async () => {
    await save("text", { contentHtml: "<p>given</p>" });

    const args = mockUpsert.mock.calls[0]?.[0];
    expect(args.create.contentHtml).toBe("<p>given</p>");
    expect(args.update.contentHtml).toBe("<p>given</p>");
  });

  it("queues exactly one render, after the transaction committed", async () => {
    const order: string[] = [];
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) => {
      order.push("upsert");
      return savedRow(args.create.title);
    });
    mockRevisionCreate.mockImplementation(async () => {
      order.push("revision");
      return { id: "r1" };
    });
    jest.mocked(enqueueRender).mockImplementation(() => void order.push("enqueue"));

    await ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext: "text" });

    expect(enqueueRender).toHaveBeenCalledTimes(1);
    expect(enqueueRender).toHaveBeenCalledWith("a1");
    expect(order).toEqual(["upsert", "revision", "enqueue"]);
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

  it("does not scan the wikitext for links on the save path: the render fills the link graph", async () => {
    const result = await save("[[Bar]] and [[Baz]]");

    expect(LinkGraphService.syncArticleLinks).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("extractedLinksCount");
  });

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
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) => savedRow(args.create.title));
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
    expect((strings as TemplateStringsArray).join("?")).toBe("SELECT set_config('lock_timeout', ?, true)");
    expect(values).toEqual(["10s"]);
    expect(mockExecuteRaw.mock.invocationCallOrder[0]).toBeLessThan(mockQueryRaw.mock.invocationCallOrder[0]!);
  });

  it("gives its transaction time to wait for the page's lock: 10 s to start, 30 s to run", async () => {
    await save();

    expect(mockTransactionOptions).toHaveBeenCalledWith({ maxWait: 10_000, timeout: 30_000 });
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
      () => new InternalError("Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction."),
    ],
  ])("answers PageBusyError, retryable and a 409 for tRPC, for %s", async (_name, error) => {
    mockQueryRaw.mockRejectedValue(error());

    const failure = await save().catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(PageBusyError);
    expect(failure).toMatchObject({ statusCode: 409, trpcCode: "CONFLICT", message: expect.stringContaining("busy") });
    expect(mockRevisionCreate).not.toHaveBeenCalled();
  });

  it("lets every other failure of the save through as it is", async () => {
    const other = new Error("connection refused");
    mockQueryRaw.mockRejectedValue(other);
    await expect(save()).rejects.toBe(other);

    mockQueryRaw.mockRejectedValue(prismaError("P2002")); // a unique violation is not a busy page
    await expect(save()).rejects.not.toBeInstanceOf(PageBusyError);
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
    expect(sql).toMatch(/FROM wiki_articles WHERE "source" = \? AND "title" = \? FOR NO KEY UPDATE/);
    expect(mockQueryRaw.mock.calls[0]?.slice(1)).toEqual(["ixwiki", "Foo"]);
    // the row exists: the only raw statement besides the lock is the wait limit, no advisory lock
    expect(mockExecuteRaw.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join("?"))).toEqual([
      "SELECT set_config('lock_timeout', ?, true)",
    ]);
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

    expect((failure as EditConflictError).conflict).toEqual({ currentWikitext: "", currentRevisionRef: null });
    nothingWritten();
  });

  it("makes no check without an expected head (a revert, a rollback, an upload's page), but still locks the page", async () => {
    mockRevisionFindFirst.mockResolvedValue(HEAD);

    await save();

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
  });

  it("makes the check against the latest LIVE revision, read by the locked row's id: a parked one is not the head", async () => {
    await save({ expectedHeadRef: "rev-head" }).catch(() => undefined);

    // O(1) in the length of the history: the (articleId, parked, createdAt) index, no join
    expect(mockRevisionFindFirst.mock.calls[0]?.[0].where).toEqual({ articleId: "a1", parked: false });
    expect(mockRevisionFindFirst.mock.calls[0]?.[0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("finds the head by title (a join) only when the page had no row to lock: the creator before it may have made it", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await save({ expectedHeadRef: null });

    expect(mockRevisionFindFirst.mock.calls[0]?.[0].where).toEqual({
      article: { source: "ixwiki", title: "Foo" },
      parked: false,
    });
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

describe("ArticleRepository.saveArticle tells the watchers (plan 416, WK-19)", () => {
  const save = (extra: { editSummary?: string } = {}, authorName?: string) => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle(
      { slug: "Foo", title: "Foo", wikitext: "new text", ...extra },
      "user_clerk",
      authorName
    );
  };

  it("notifies once, after the commit, with the editor left out and the diff's two revisions", async () => {
    mockRevisionFindFirst.mockResolvedValue({ id: "r_prev", mwRevId: 77, byteSize: 3 });
    mockRevisionCreate.mockResolvedValue({
      id: "r_new",
      summary: "Fixed a date",
      authorId: "db_editor",
    });

    await save({ editSummary: "Fixed a date" }, "Kir");

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "edited",
      articleId: "a1",
      title: "Foo",
      editor: "Kir",
      editorUserId: "db_editor",
      summary: "Fixed a date",
      previousRef: "77", // a revision synced from MediaWiki is referred to by its rev_id
      currentRef: "r_new",
    });
  });

  it("notifies after the revision is written, never before the transaction committed", async () => {
    const order: string[] = [];
    mockRevisionCreate.mockImplementation(async () => {
      order.push("revision");
      return { id: "r1" };
    });
    jest.mocked(notifyWatchers).mockImplementation(async () => {
      order.push("notify");
      return 0;
    });

    await save();

    expect(order).toEqual(["revision", "notify"]);
  });

  it("has no earlier revision to diff against for a new page", async () => {
    await save();

    expect(notifyWatchers).toHaveBeenCalledWith(expect.objectContaining({ previousRef: null }));
  });

  it("does not notify for a save that changed nothing, or one that failed", async () => {
    mockCount.mockResolvedValue(1);
    await save();
    expect(notifyWatchers).not.toHaveBeenCalled();

    mockCount.mockResolvedValue(0);
    mockUpsert.mockRejectedValue(new Error("db down"));
    await expect(
      ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext: "x" })
    ).rejects.toThrow("db down");
    expect(notifyWatchers).not.toHaveBeenCalled();
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

  it("names the saved page by its canonical title, not the spelling that was typed", async () => {
    await ArticleRepository.saveArticle({ slug: "foo_bar", title: "", wikitext: "text" });

    expect(mockJobCreate.mock.calls[0]?.[0].data).toMatchObject({
      kind: "revision",
      title: "Foo bar",
    });
  });

  it("queues a job for a save that changed nothing too: the revision exists, so MediaWiki gets it", async () => {
    mockCount.mockResolvedValue(1);

    await save();

    expect(mockJobCreate).toHaveBeenCalledTimes(1);
  });

  it("kicks the worker once the job is committed, never when the transaction failed", async () => {
    await save();
    expect(scheduleMirrorKick).toHaveBeenCalledTimes(1);

    jest.mocked(scheduleMirrorKick).mockClear();
    mockUpsert.mockRejectedValue(new Error("db down"));
    await expect(
      ArticleRepository.saveArticle({ slug: "Foo", title: "Foo", wikitext: "text" })
    ).rejects.toThrow("db down");
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
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

  it("writes no job for a realm that has no MediaWiki to mirror to", async () => {
    await save({ source: "iiwiki" });

    expect(mockJobCreate).not.toHaveBeenCalled();
  });

  it("fails the save, and queues nothing after it, when the job cannot be written", async () => {
    mockJobCreate.mockRejectedValue(new Error("outbox down"));

    await expect(save()).rejects.toThrow("outbox down");
    expect(enqueueRender).not.toHaveBeenCalled();
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
  });
});

describe("ArticleRepository.findArticleForView (plan 404)", () => {
  const viewRow = (title: string, overrides: Record<string, unknown> = {}) => ({
    id: `id-${title}`,
    title,
    status: "PUBLISHED",
    htmlSyncedAt: new Date("2026-09-30T10:00:00Z"),
    revisions: [{ createdAt: new Date("2026-09-29T08:00:00Z") }],
    categories: [{ category: { name: "Countries" } }, { category: { name: "Eurth" } }],
    ...overrides,
  });

  it("reads one row with only what locating the rendered view takes", async () => {
    mockFindUnique.mockResolvedValue(viewRow("Foo bar"));

    const head = await ArticleRepository.findArticleForView("foo_bar");

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindMany).not.toHaveBeenCalled();
    const { where, select } = mockFindUnique.mock.calls[0]?.[0];
    expect(where).toEqual({ source_title: { source: "ixwiki", title: "Foo bar" } });
    expect(Object.keys(select).sort()).toEqual([
      "categories",
      "htmlSyncedAt",
      "id",
      "revisions",
      "status",
      "title",
    ]);
    expect(select.revisions).toMatchObject({ take: 1, orderBy: { createdAt: "desc" } });
    // The last-modified time is the page's current revision's: a parked one is not that.
    expect(select.revisions.where).toEqual({ parked: false });
    expect(select.categories.take).toBe(50);
    // A category MediaWiki hides (a maintenance or tracking one) is not shown on the page.
    expect(select.categories.where).toEqual({ category: { hidden: false } });
    expect(head).toEqual({
      id: "id-Foo bar",
      title: "Foo bar",
      status: "PUBLISHED",
      htmlSyncedAt: new Date("2026-09-30T10:00:00Z"),
      lastModified: new Date("2026-09-29T08:00:00Z"),
      categories: ["Countries", "Eurth"],
    });
  });

  it("resolves a case variant by slug like findBySlug does", async () => {
    mockFindMany.mockResolvedValue([viewRow("NATO")]);

    const head = await ArticleRepository.findArticleForView("nato");

    expect(head?.title).toBe("NATO");
    expect(mockFindMany.mock.calls[0]?.[0].select).toHaveProperty("htmlSyncedAt");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("reports a stale article and an article with no revision rows", async () => {
    mockFindUnique.mockResolvedValue(viewRow("Foo", { htmlSyncedAt: null, revisions: [] }));

    await expect(ArticleRepository.findArticleForView("Foo")).resolves.toMatchObject({
      htmlSyncedAt: null,
      lastModified: null,
    });
  });

  it("is null for a missing article, and lets a database error through", async () => {
    await expect(ArticleRepository.findArticleForView("Nowhere")).resolves.toBeNull();

    mockFindUnique.mockRejectedValue(new Error("db down"));
    await expect(ArticleRepository.findArticleForView("Foo")).rejects.toThrow("db down");
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

  it("looks another wiki's title up without IxWiki's namespace table", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Project:foo", { source: "iiwiki" }));

    const article = await ArticleRepository.findBySlug("project:foo", "iiwiki");

    expect(mockFindUnique.mock.calls[0]?.[0].where).toEqual({
      source_title: { source: "iiwiki", title: "Project:foo" },
    });
    expect(article?.title).toBe("Project:foo");
  });

  it("never reads the rendered HTML or the view bundle", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo"));

    await ArticleRepository.findBySlug("Foo");

    const select = mockFindUnique.mock.calls[0]?.[0].select;
    expect(select).toMatchObject({ id: true, wikitext: true });
    for (const heavy of ["contentHtml", "contentJson", "renderedView", "htmlContent"]) {
      expect(select).not.toHaveProperty(heavy);
    }
  });

  it("returns null when nothing matches", async () => {
    await expect(ArticleRepository.findBySlug("Nowhere")).resolves.toBeNull();
  });

  it("returns null for a stub row without wikitext", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo", { wikitext: "" }));

    await expect(ArticleRepository.findBySlug("Foo")).resolves.toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("still tries the legacy lookup for a title MediaWiki would refuse", async () => {
    mockFindFirst.mockResolvedValue(articleRow("a[b"));

    const article = await ArticleRepository.findBySlug("a[b");

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(article?.title).toBe("a[b");
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

  it("never reads a revision's text: the select is the history columns only", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo"));
    mockRevisionFindMany.mockResolvedValue([]);

    await ArticleRepository.getHistory("Foo");

    expect(mockRevisionFindMany.mock.calls[0]?.[0].select).toEqual({
      id: true,
      mwRevId: true,
      summary: true,
      minor: true,
      author: true,
      createdAt: true,
      byteSize: true,
      byteDelta: true,
      sha1: true,
      parked: true,
      textDeleted: true,
      commentDeleted: true,
      userDeleted: true,
    });
  });

  it("carries MediaWiki's revision-deletion flags to the caller, which decides who sees what", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo"));
    mockRevisionFindMany.mockResolvedValue([
      { ...revision("Foo"), sha1: "abc", textDeleted: true, userDeleted: true },
    ]);

    const [row] = await ArticleRepository.getHistory("Foo");

    expect(row).toMatchObject({
      author: "alice",
      sha1: "abc",
      textDeleted: true,
      commentDeleted: false,
      userDeleted: true,
    });
  });

  it("pages after a revision: the cursor skips the revision itself, by rev_id or row id", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo"));
    mockRevisionFindMany.mockResolvedValue([revision("Foo", "rev-older")]);

    mockRevisionFindFirst.mockResolvedValueOnce({ id: "rev-9001" });
    await ArticleRepository.getHistory("Foo", "ixwiki", 50, { before: "9001" });
    expect(mockRevisionFindFirst.mock.calls.at(-1)?.[0]).toMatchObject({
      where: { articleId: "id-Foo", mwRevId: 9001 },
    });
    expect(mockRevisionFindMany.mock.calls.at(-1)?.[0]).toMatchObject({
      cursor: { id: "rev-9001" },
      skip: 1,
      take: 50,
    });

    mockRevisionFindFirst.mockResolvedValueOnce({ id: "cuid-7" });
    await ArticleRepository.getHistory("Foo", "ixwiki", 2, { before: "cuid-7" });
    expect(mockRevisionFindFirst.mock.calls.at(-1)?.[0]).toMatchObject({
      where: { articleId: "id-Foo", id: "cuid-7" },
    });
  });

  it("starts at the revision itself for `from`, and is empty for a revision of another page", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo"));
    mockRevisionFindMany.mockResolvedValue([revision("Foo")]);
    mockRevisionFindFirst.mockResolvedValueOnce({ id: "cuid-7" });

    await ArticleRepository.getHistory("Foo", "ixwiki", 2, { from: "cuid-7" });
    const args = mockRevisionFindMany.mock.calls.at(-1)?.[0];
    expect(args).toMatchObject({ cursor: { id: "cuid-7" }, take: 2 });
    expect(args).not.toHaveProperty("skip");

    mockRevisionFindMany.mockClear();
    mockRevisionFindFirst.mockResolvedValueOnce(null);
    await expect(
      ArticleRepository.getHistory("Foo", "ixwiki", 2, { before: "elsewhere" })
    ).resolves.toEqual([]);
    expect(mockRevisionFindMany).not.toHaveBeenCalled();
  });

  it("follows a unique case-variant slug match, and the newest row when it is ambiguous", async () => {
    mockFindMany.mockResolvedValue([articleRow("NATO")]);
    await ArticleRepository.getHistory("nato");
    expect(mockRevisionFindMany.mock.calls[0]?.[0].where).toEqual({
      articleId: "id-NATO",
      parked: false,
    });

    mockFindMany.mockResolvedValue([articleRow("NATO"), articleRow("Nato")]);
    mockFindFirst.mockResolvedValue(articleRow("NATO"));
    await ArticleRepository.getHistory("nAto");
    expect(mockFindFirst.mock.calls[0]?.[0].orderBy).toEqual({ updatedAt: "desc" });
    expect(mockRevisionFindMany.mock.calls[1]?.[0].where).toEqual({
      articleId: "id-NATO",
      parked: false,
    });
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

    it("is there for a history list that asks for it, in order, and can anchor a page", async () => {
      const all = { includeParked: true };
      expect(ids(await ArticleRepository.getHistory("Foo", "ixwiki", 10, undefined, all))).toEqual([
        "r3",
        "r2",
        "r1",
      ]);
      expect(
        ids(await ArticleRepository.getHistory("Foo", "ixwiki", 5, { before: "r2" }, all))
      ).toEqual(["r1"]);
    });
  });

  it("is empty, without reading revisions, when the article does not exist", async () => {
    await expect(ArticleRepository.getHistory("Nowhere")).resolves.toEqual([]);
    expect(mockRevisionFindMany).not.toHaveBeenCalled();
  });
});
