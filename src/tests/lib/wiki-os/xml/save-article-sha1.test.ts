/** @jest-environment node */
/**
 * Plan 408: every revision `saveArticle` writes carries MediaWiki's base-36 SHA-1 of its text.
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

const mockRevisionCreate = jest.fn();

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
      upsert: jest.fn().mockResolvedValue({
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
      }),
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

describe("ArticleRepository.saveArticle revision hash", () => {
  it("stores the base-36 SHA-1 of the saved wikitext on the new revision", async () => {
    mockRevisionCreate.mockResolvedValue({ id: "r1" });

    await ArticleRepository.saveArticle({ slug: "foo", title: "Foo", wikitext: "body é" });

    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({
      sha1: mwSha1Base36("body é"),
      byteSize: 7,
    });
  });
});
