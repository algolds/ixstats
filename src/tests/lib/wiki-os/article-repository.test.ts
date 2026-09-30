/** @jest-environment node */
/**
 * Plan 403: ArticleRepository writes and reads one MediaWiki-canonical identity per title.
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";

const mockUpsert = jest.fn();
const mockRevisionFindFirst = jest.fn();
const mockRevisionCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockRevisionFindMany = jest.fn();

jest.mock("~/server/db", () => {
  const tx = {
    user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    wikiArticle: { upsert: (...a: unknown[]) => mockUpsert(...a) },
    wikiRevision: {
      findFirst: (...a: unknown[]) => mockRevisionFindFirst(...a),
      create: (...a: unknown[]) => mockRevisionCreate(...a),
    },
  };
  return {
    db: {
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
      wikiRevision: { findMany: (...a: unknown[]) => mockRevisionFindMany(...a) },
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
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
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
  mockRevisionFindFirst.mockResolvedValue(null);
  mockRevisionCreate.mockResolvedValue({ id: "r1" });
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

  it("returns null when nothing matches", async () => {
    await expect(ArticleRepository.findBySlug("Nowhere")).resolves.toBeNull();
  });

  it("returns null for a stub row without wikitext or html", async () => {
    mockFindUnique.mockResolvedValue(articleRow("Foo", { wikitext: "", contentHtml: "" }));

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
  const revision = (articleId: string) => ({
    id: `rev-${articleId}`,
    mwRevId: null,
    articleId,
    summary: null,
    minor: false,
    author: "alice",
    authorId: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    wikitext: "body",
    byteSize: 4,
    byteDelta: 4,
    format: "WIKITEXT",
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
      where: { articleId: "id-Foo bar" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(history).toEqual([
      expect.objectContaining({ articleId: "id-Foo bar", author: "alice" }),
    ]);
  });

  it("follows a unique case-variant slug match, and the newest row when it is ambiguous", async () => {
    mockFindMany.mockResolvedValue([articleRow("NATO")]);
    await ArticleRepository.getHistory("nato");
    expect(mockRevisionFindMany.mock.calls[0]?.[0].where).toEqual({ articleId: "id-NATO" });

    mockFindMany.mockResolvedValue([articleRow("NATO"), articleRow("Nato")]);
    mockFindFirst.mockResolvedValue(articleRow("NATO"));
    await ArticleRepository.getHistory("nAto");
    expect(mockFindFirst.mock.calls[0]?.[0].orderBy).toEqual({ updatedAt: "desc" });
    expect(mockRevisionFindMany.mock.calls[1]?.[0].where).toEqual({ articleId: "id-NATO" });
  });

  it("is empty, without reading revisions, when the article does not exist", async () => {
    await expect(ArticleRepository.getHistory("Nowhere")).resolves.toEqual([]);
    expect(mockRevisionFindMany).not.toHaveBeenCalled();
  });
});
