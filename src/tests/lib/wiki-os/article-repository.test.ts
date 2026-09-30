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
});

describe("ArticleRepository.saveArticle", () => {
  const save = (slug: string, title = "") => {
    mockUpsert.mockImplementation(async (args: { create: { title: string } }) =>
      savedRow(args.create.title)
    );
    return ArticleRepository.saveArticle({ slug, title, wikitext: "body" });
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
});
