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
  ArticleRepository: { findBySlug: jest.fn() },
  MediaAssetService: {},
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  getArticleHtml: jest.fn(),
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
  resolveRedirect: jest.fn(async (title: string) => title),
  getInfobox: jest.fn(),
  getImageMeta: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
  saveArticleHtmlShadow: jest.fn(),
  getArticleHtmlShadow: jest.fn(),
  getArticleAuthors: jest.fn().mockResolvedValue(null),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getArticleHtmlShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";

const createCaller = createCallerFactory(wikiosPageContentRouter);

const article = (status: string) =>
  ({
    title: "Caphiria",
    status,
    contentHtml: "<p>The kingdom of Caphiria.</p>",
    wikitext: "The kingdom of Caphiria.",
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  }) as never;

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
});

describe("getArticleHtml on an archived page", () => {
  beforeEach(() => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(article("ARCHIVED"));
  });

  it("is NOT_FOUND for a signed-out reader and for a signed-in user without deletedhistory", async () => {
    await expect(signedOut().getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(signedIn("user").getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not fall through to a cached copy", async () => {
    jest.mocked(getArticleHtmlShadow).mockResolvedValue({
      html: "<p>cached</p>",
      timestamp: "2026-09-01T00:00:00Z",
    } as never);
    await expect(signedOut().getArticleHtml({ title: "Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(getArticleHtmlShadow).not.toHaveBeenCalled();
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
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(article("PUBLISHED"));
    const page = await signedOut().getArticleHtml({ title: "Caphiria" });
    expect(page.contentHtml).toContain("kingdom of Caphiria");
  });
});
