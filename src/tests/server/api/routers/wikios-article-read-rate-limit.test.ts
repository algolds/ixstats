/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
/**
 * F10: `wikios.getArticleHtml` has its own article-read bucket (`wiki_read`, 600/min per client), not the
 * shared 100/min `public` one, so a reader who hover-prefetches is not told that pages that exist are missing.
 */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {},
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: {},
  MediaAssetService: {},
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({ __esModule: true }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({ __esModule: true }));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({ __esModule: true }));
jest.mock("~/lib/wiki-os/services/article-view-service", () => ({ __esModule: true }));
jest.mock("~/lib/wiki-os/services/main-page-service", () => ({ __esModule: true }));
jest.mock("~/lib/wiki-os/services/sister-render-service", () => ({
  __esModule: true,
  renderSisterArticle: jest.fn(),
  SisterRenderError: class SisterRenderError extends Error {},
}));
jest.mock("~/lib/wiki-os/storage", () => ({ __esModule: true }));
jest.mock("~/server/shared/wiki-placeholders", () => ({ __esModule: true }));
jest.mock("~/server/shared/ixstats-template-provider", () => ({
  __esModule: true,
  ixstatsTemplateProvider: { name: "never", canHandle: () => false, resolve: async () => new Map() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const caller = () =>
  createCallerFactory(wikiosPageContentRouter)(
    createMockRouterContext({ auth: null, user: null, rateLimitIdentifier: "ip:203.0.113.7" }) as never
  );

/** A title no page can have: the procedure answers NOT_FOUND without touching anything, once it is let through. */
const NO_SUCH_TITLE = "[invalid]";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockCheck.mockResolvedValue({ success: true, remaining: 599, resetAt: new Date(Date.now() + 60_000) });
});

describe("wikios.getArticleHtml rate limit", () => {
  it("counts each read against the client's own wiki_read bucket of 600 a minute", async () => {
    await expect(caller().getArticleHtml({ title: NO_SUCH_TITLE })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockCheck).toHaveBeenCalledWith("ip:203.0.113.7", "wiki_read", { maxRequests: 600, windowMs: 60_000 });
  });

  it("is refused once the client is over the bucket, before the article is looked up", async () => {
    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date(Date.now() + 30_000) });

    await expect(caller().getArticleHtml({ title: NO_SUCH_TITLE })).rejects.toThrow(/Too many requests/);
  });
});
