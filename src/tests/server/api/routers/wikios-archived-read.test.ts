/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a deleted (archived) page reads as "not found" unless the reader holds `deletedhistory`.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: {},
  MediaAssetService: {},
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findArticleForView: jest.fn() },
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/render-service"),
  loadViewBundle: jest.fn(),
  ensureRendered: jest.fn(),
  renderFallbackView: jest.fn(),
  enqueueRender: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  __esModule: true,
  syncSinglePage: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  getArticleHtml: jest.fn(),
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
  resolveRedirect: jest.fn(async (title: string) => ({ title, fragment: null })),
  getInfobox: jest.fn(),
  getImageMeta: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
  getArticleAuthors: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/storage"),
  resolveActiveCountryId: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/server/shared/ixstats-template-provider", () => ({
  __esModule: true,
  ixstatsTemplateProvider: { name: "never", canHandle: () => false, resolve: async () => new Map() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { buildViewBundle, loadViewBundle } from "~/lib/wiki-os/services/render-service";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";

const createCaller = createCallerFactory(wikiosPageContentRouter);

let ids = 0;
/** The head of a rendered page with the given status (a fresh id each time: the view cache is per id). */
const head = (status: string) => {
  ids++;
  return {
    id: `art-${ids}`,
    title: "Caphiria",
    status,
    htmlSyncedAt: new Date("2026-09-01T00:00:00Z"),
    lastModified: new Date("2026-09-01T00:00:00Z"),
    categories: [],
  } as never;
};

const signedIn = (role: string) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: role, level: 100 } },
    }) as never
  );
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  jest.mocked(loadViewBundle).mockResolvedValue({
    bundle: buildViewBundle("<p>The kingdom of Caphiria.</p>"),
    htmlSyncedAt: new Date("2026-09-01T00:00:00Z"),
  } as never);
});

describe("getArticleHtml on an archived page", () => {
  beforeEach(() => {
    jest.mocked(ArticleRepository.findArticleForView).mockImplementation(async () => head("ARCHIVED"));
  });

  it("is NOT_FOUND for a signed-out reader and for a signed-in user without deletedhistory", async () => {
    await expect(signedOut().getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(signedIn("user").getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is neither rendered nor imported again from MediaWiki for a reader who may not see it", async () => {
    await expect(signedOut().getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(loadViewBundle).not.toHaveBeenCalled();
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("is served to a sysop, who holds deletedhistory", async () => {
    const page = await signedIn("admin").getArticleHtml({ title: "Caphiria" });
    expect(page.title).toBe("Caphiria");
    expect(page.contentHtml).toContain("kingdom of Caphiria");
  });

  it("is served to a reader granted deletedhistory through the owner role", async () => {
    const page = await signedIn("owner").getArticleHtml({ title: "Caphiria" });
    expect(page.title).toBe("Caphiria");
  });
});

describe("getArticleHtml on a published page", () => {
  it("is served to everyone", async () => {
    jest.mocked(ArticleRepository.findArticleForView).mockResolvedValue(head("PUBLISHED"));
    const page = await signedOut().getArticleHtml({ title: "Caphiria" });
    expect(page.contentHtml).toContain("kingdom of Caphiria");
  });
});
