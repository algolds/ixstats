/** @jest-environment node */
/**
 * Plan 408: every revision `saveArticle` writes carries MediaWiki's base-36 SHA-1 of its text.
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

const mockRevisionCreate = jest.fn();
const mockUpsert = jest.fn();

jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/server/db", () => {
  const tx = {
    user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    wikiArticle: {
      count: jest.fn().mockResolvedValue(0),
      upsert: (...a: unknown[]) => mockUpsert(...a),
    },
    wikiRevision: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: (...a: unknown[]) => mockRevisionCreate(...a),
    },
    wikiMirrorJob: { create: jest.fn().mockResolvedValue({}) },
  };
  return { db: { $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));

beforeEach(() => {
  mockUpsert.mockResolvedValue({
    id: "a1",
    title: "Foo",
    slug: "foo",
    source: "ixwiki",
    wikitext: "body é",
    namespace: 0,
    namespacePrefix: null,
    protectionLevel: "ALL",
    protectionExpiry: null,
    syncedAt: new Date(),
    updatedAt: new Date(),
  });
});

describe("ArticleRepository.saveArticle revision hash", () => {
  it("stores the base-36 SHA-1 of the saved wikitext on the new revision", async () => {
    mockRevisionCreate.mockResolvedValue({ id: "r1" });

    await ArticleRepository.saveArticle({ slug: "foo", title: "Foo", wikitext: "body é" });

    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({
      sha1: mwSha1Base36("body é"),
      byteSize: 7,
    });
  });

  it("saves, and hashes, the text without the control characters XML cannot carry (as MediaWiki stores it)", async () => {
    mockRevisionCreate.mockResolvedValue({ id: "r1" });
    const typed = "bo\u0001dy\u000B é\uFFFE\u0000\ttab\r\nend\u001F";

    await ArticleRepository.saveArticle({ slug: "foo", title: "Foo", wikitext: typed });

    const stored = "body é\ttab\r\nend";
    expect(mockRevisionCreate.mock.calls.at(-1)?.[0].data).toMatchObject({
      wikitext: stored,
      sha1: mwSha1Base36(stored),
      byteSize: Buffer.byteLength(stored, "utf8"),
    });
    expect(mockUpsert.mock.calls.at(-1)?.[0]).toMatchObject({
      create: { wikitext: stored },
      update: { wikitext: stored },
    });
  });
});
