/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 401 regression tests: WikiOS authorization gaps (S4 verified wiki link, S5 stash ownership,
// S6 author profile, S7 render-proxy/cache/limits).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    wikiArticle: { upsert: jest.fn() },
    wikiRevision: { findFirst: jest.fn(), create: jest.fn() },
    stash: { findFirst: jest.fn(), create: jest.fn() },
    stashItem: { upsert: jest.fn() },
    lorewardUserStats: { findUnique: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn() },
  MediaAssetService: { registerAsset: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  __esModule: true,
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  __esModule: true,
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  wikitextToHtml: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/sync-worker", () => ({
  __esModule: true,
  MediaWikiExportWorker: { enqueue: jest.fn() },
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  __esModule: true,
  CloudflareGuardian: { verifyTurnstile: jest.fn(), purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/write-service", () => ({
  __esModule: true,
  executeMediaWikiWrite: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn().mockResolvedValue(null),
  getBacklinks: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageManagementService: { restoreArticle: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { db } from "~/server/db";

const mockDb = db as unknown as {
  user: { findFirst: jest.Mock; update: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  wikiArticle: { upsert: jest.Mock };
  wikiRevision: { findFirst: jest.Mock; create: jest.Mock };
  stash: { findFirst: jest.Mock; create: jest.Mock };
  stashItem: { upsert: jest.Mock };
  lorewardUserStats: { findUnique: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

const asCtx = (ctx: unknown) => ctx as never;

const userCtx = (wikiUsername: string | null = null) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", wikiUsername, role: { name: "user", level: 100 } },
  });

describe("S4: wiki identity for authorization is the verified WikiAccountLink", () => {
  const editCaller = () => createCallerFactory(wikiosEditingRouter)(asCtx(userCtx("Legacy")));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: {} as never,
      revisionId: "rev-1" as never,
      extractedLinksCount: 0,
    });
  });

  it("forbids User:<name> when User.wikiUsername is set but no verified link exists", async () => {
    mockDb.wikiAccountLink.findFirst.mockResolvedValue(null);

    await expect(
      editCaller().saveWikitext({ title: "User:Legacy/Notes", wikitext: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("allows the user's own User: page with a verified link, looked up by internal id", async () => {
    mockDb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Verified" });

    await editCaller().saveWikitext({ title: "User:Verified/Notes", wikitext: "x" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    expect(mockDb.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { userId: "db1", source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    });
  });

  it("does not let the legacy wikiUsername satisfy an AUTOCONFIRMED protection", async () => {
    jest
      .mocked(ArticleRepository.findBySlug)
      .mockResolvedValue({ protectionLevel: "AUTOCONFIRMED", protectionExpiry: null } as never);

    mockDb.wikiAccountLink.findFirst.mockResolvedValue(null);
    await expect(editCaller().saveWikitext({ title: "Guarded", wikitext: "x" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    mockDb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Verified" });
    await editCaller().saveWikitext({ title: "Guarded", wikitext: "x" });
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
  });

  it("saveArticle no longer writes User.wikiUsername", async () => {
    const { ArticleRepository: RealArticleRepository } = jest.requireActual<
      typeof import("~/lib/wiki-os/core/article-repository")
    >("~/lib/wiki-os/core/article-repository");
    const tx = mockDb;
    mockDb.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
    mockDb.user.findFirst.mockResolvedValue({ id: "db1" });
    mockDb.wikiArticle.upsert.mockResolvedValue({
      id: "a1",
      title: "Caphiria",
      slug: "Caphiria",
      source: "ixwiki",
      wikitext: "x",
      namespace: 0,
      namespacePrefix: null,
      protectionLevel: "ALL",
      protectionExpiry: null,
      syncedAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.wikiRevision.findFirst.mockResolvedValue(null);
    mockDb.wikiRevision.create.mockResolvedValue({
      id: "r1",
      articleId: "a1",
      summary: null,
      minor: false,
      author: "Some_Country",
      createdAt: new Date(),
    });

    await RealArticleRepository.saveArticle(
      { slug: "Caphiria", title: "Caphiria", wikitext: "x" },
      "user_1",
      "Some_Country"
    );

    expect(mockDb.user.findFirst).toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.wikiRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: "db1" }) })
    );
  });
});

describe("S5: stashPage only writes into the caller's own stashes", () => {
  const stashCaller = () => createCallerFactory(wikiosStashRouter)(asCtx(userCtx()));

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.stashItem.upsert.mockResolvedValue({});
  });

  it("answers NOT_FOUND for another user's stashId and never upserts", async () => {
    mockDb.stash.findFirst.mockResolvedValue(null);

    await expect(
      stashCaller().stashPage({ pageTitle: "Caphiria", stashId: "someone_elses_stash" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.stash.findFirst).toHaveBeenCalledWith({
      where: { id: "someone_elses_stash", userId: { in: ["db1", "user_1"] } },
      select: { id: true },
    });
    expect(mockDb.stashItem.upsert).not.toHaveBeenCalled();
  });

  it("upserts into an owned stashId", async () => {
    mockDb.stash.findFirst.mockResolvedValue({ id: "mine" });

    const result = await stashCaller().stashPage({ pageTitle: "Caphiria", stashId: "mine" });

    expect(result).toEqual({ success: true, stashId: "mine" });
    expect(mockDb.stashItem.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("S6: getAuthorProfile resolves the requested name only", () => {
  const CALLER_COUNTRY = { id: "caller_country", name: "Callerland", flag: null };
  const OTHER_COUNTRY = { id: "other_country", name: "Otherland", flag: null };

  const signedInCtx = () =>
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: {
        id: "db1",
        clerkUserId: "user_1",
        countryId: "caller_country",
        country: CALLER_COUNTRY,
        wikiUsername: "Caller",
        role: { id: "role_caller", name: "user", level: 100 },
      },
    });
  const anonymousCtx = () => createMockRouterContext({ auth: null, user: null });

  const profile = (ctx: unknown, input?: { username?: string }) =>
    createCallerFactory(wikiosUserTalkRouter)(asCtx(ctx)).getAuthorProfile(input);

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.wikiAccountLink.findFirst.mockResolvedValue(null);
    mockDb.user.findFirst.mockResolvedValue(null);
    mockDb.lorewardUserStats.findUnique.mockResolvedValue(null);
  });

  it("returns no user data to an anonymous caller when nobody matches the name", async () => {
    const result = await profile(anonymousCtx(), { username: "Nobody" });

    expect(result).toMatchObject({ username: "Nobody", country: null, role: null });
    // No `OR` with an undefined clerkUserId (which matches every row): the name is the only filter.
    expect(mockDb.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { wikiUsername: "Nobody" } })
    );
  });

  it("never gives a signed-in caller their own country under another name", async () => {
    const result = await profile(signedInCtx(), { username: "Somebody_else" });

    expect(result).toMatchObject({ username: "Somebody_else", country: null, role: null });
  });

  it("prefers the owner of a verified ixwiki link, by the MediaWiki-normalised name", async () => {
    mockDb.wikiAccountLink.findFirst.mockResolvedValue({
      user: { country: OTHER_COUNTRY, role: { name: "member", level: 50 } },
    });

    const result = await profile(anonymousCtx(), { username: "somebody_else" });

    expect(mockDb.wikiAccountLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", username: "Somebody else", verifiedAt: { not: null } },
      })
    );
    expect(mockDb.user.findFirst).not.toHaveBeenCalled();
    expect(result).toMatchObject({ country: OTHER_COUNTRY, role: { name: "member", level: 50 } });
  });

  it("returns role name and level only, never a role or user id", async () => {
    mockDb.user.findFirst.mockResolvedValue({
      country: OTHER_COUNTRY,
      role: { name: "member", level: 50 },
    });

    const result = await profile(anonymousCtx(), { username: "Somebody" });

    expect(result?.role).toEqual({ name: "member", level: 50 });
    expect(JSON.stringify(result)).not.toMatch(/roleId|clerkUserId|role_caller/);
  });

  it("uses the caller's own record when no name is requested, without leaking the role id", async () => {
    const result = await profile(signedInCtx());

    expect(mockDb.user.findFirst).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      username: "Caller",
      country: CALLER_COUNTRY,
      role: { name: "user", level: 100 },
    });
    expect(result?.role).not.toHaveProperty("id");
  });

  it("returns null for an anonymous caller who names nobody", async () => {
    await expect(profile(anonymousCtx())).resolves.toBeNull();
  });
});
