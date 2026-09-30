/** @jest-environment node */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  Cache: class {
    get = jest.fn();
    set = jest.fn();
  },
  externalApiCache: { get: jest.fn(), set: jest.fn() },
  rateLimiter: { check: (...args: unknown[]) => mockCheck(...args) },
}));

jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  wikiLoreCardGenerator: {
    fetchRandomArticles: jest.fn(),
    fetchArticleMetadataBatch: jest.fn(),
    searchCategories: jest.fn(),
    fetchCategoryMembers: jest.fn(),
    generateCard: jest.fn(),
  },
}));

import { GET as randomArticles } from "~/app/api/wiki/random-articles/route";
import { GET as categories } from "~/app/api/wiki/categories/route";
import { GET as categoryArticles } from "~/app/api/wiki/category-articles/route";
import { GET as previewArticle } from "~/app/api/wiki/preview-article/route";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";

const mockGenerator = jest.mocked(wikiLoreCardGenerator);

const routes = [
  ["random-articles", randomArticles, "?source=ixwiki"],
  ["categories", categories, "?source=ixwiki&prefix=Co"],
  ["category-articles", categoryArticles, "?source=ixwiki&category=Countries"],
  ["preview-article", previewArticle, "?source=ixwiki&title=Caphiria"],
] as const;

const requestFor = (name: string, query: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000/api/wiki/${name}${query}`, { headers });

describe("/api/wiki fan-out routes are rate limited", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue({ success: true, remaining: 10, resetAt: new Date(Date.now() + 60_000) });
    mockGenerator.fetchRandomArticles.mockResolvedValue([]);
    mockGenerator.fetchArticleMetadataBatch.mockResolvedValue([]);
    mockGenerator.searchCategories.mockResolvedValue([]);
    mockGenerator.fetchCategoryMembers.mockResolvedValue([]);
  });

  it.each(routes)("%s answers 429 without calling MediaWiki when over the limit", async (name, handler, query) => {
    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date(Date.now() + 30_000) });

    const res = await handler(requestFor(name, query));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    for (const fn of Object.values(mockGenerator)) expect(fn).not.toHaveBeenCalled();
  });

  it.each(routes)("%s keys the limiter on the trusted client identity, not x-forwarded-for", async (name, handler, query) => {
    mockGenerator.generateCard.mockResolvedValue(null);

    await handler(
      requestFor(name, query, { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" })
    );

    expect(mockCheck).toHaveBeenCalledWith("ip:203.0.113.7", "wiki_proxy");
  });

  it.each(routes)("%s still serves a request under the limit", async (name, handler, query) => {
    mockGenerator.generateCard.mockResolvedValue(null);

    const res = await handler(requestFor(name, query));

    expect(res.status).not.toBe(429);
  });

  it("preview-article never echoes an internal error message", async () => {
    mockGenerator.generateCard.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:3306"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await previewArticle(requestFor("preview-article", "?source=ixwiki&title=Caphiria"));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
    errorSpy.mockRestore();
  });
});
