/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The wiki routers' gates (plan 409, 410): edit access asks the rights engine (signed out, protected, blocked, a
// namespace the groups cannot write, a deleted page only for who may see it, the public tier), bot passwords need a
// verified wiki link for every procedure, and the country-profile cache is public to read and needs a sign-in to
// refresh.
const mockCheck = jest.fn();
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiNameClaim: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRestriction: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn(), getHistory: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: jest.requireMock("~/lib/wiki-os/core/article-repository").ArticleRepository,
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageOperationError: jest.requireActual("~/lib/wiki-os/core/page-management-service")
    .PageOperationError,
  PageManagementService: { restoreArticle: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  wikitextToHtml: jest.fn(),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  __esModule: true,
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  getVerifiedWikiLink: jest.fn(),
}));
jest.mock("~/lib/wiki-os/api-compat/bot-passwords", () => ({
  __esModule: true,
  listBotPasswords: jest.fn(),
  createBotPassword: jest.fn(),
  deleteBotPassword: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/ixstates/cache-service", () => ({
  __esModule: true,
  wikiCacheService: {
    getCountryProfile: jest.fn(),
    clearCountryCache: jest.fn(),
  },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { db } from "~/server/db";
import { wikiosBotPasswordsRouter } from "~/server/api/routers/wikios/bot-passwords";
import { getVerifiedWikiLink } from "~/lib/wiki-os/storage";
import {
  createBotPassword,
  deleteBotPassword,
  listBotPasswords,
} from "~/lib/wiki-os/api-compat/bot-passwords";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(wikiosEditingRouter);

const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);
const signedIn = () =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: {
        id: "db1",
        clerkUserId: "user_1",
        wikiUsername: "Linked",
        role: { name: "user", level: 100 },
      },
    }) as never
  );

// the public tier has room unless a row empties it (the folded routers run behind the same limiter)
beforeEach(() => {
  mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
});

describe("wikios.getEditAccess (F35c)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "PUBLISHED" } as never);
    jest.mocked(db.wikiRestriction.findMany).mockResolvedValue([] as never);
    jest.mocked(db.wikiBlock.findMany).mockResolvedValue([] as never);
    mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
  });

  it("allows a signed-in user on an ordinary page", async () => {
    await expect(signedIn().getEditAccess({ title: "Vesperia" })).resolves.toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("refuses a signed-out reader, with the missing right as the reason and no error code in it", async () => {
    const answer = await signedOut().getEditAccess({ title: "Vesperia" });
    expect(answer.allowed).toBe(false);
    expect(answer.reason).toBe('You do not have the "edit" right needed to edit this page.');
  });

  it("asks for the right to create when the page does not exist", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null as never);
    const answer = await signedOut().getEditAccess({ title: "Nowhere" });
    expect(answer).toEqual({
      allowed: false,
      reason: 'You do not have the "edit" right needed to create this page.',
    });
  });

  it("refuses a signed-in user on a page protected above their level", async () => {
    jest
      .mocked(db.wikiRestriction.findMany)
      .mockResolvedValue([{ action: "edit", level: "sysop", expiresAt: null }] as never);
    await expect(signedIn().getEditAccess({ title: "Vesperia" })).resolves.toEqual({
      allowed: false,
      reason: "This page is protected from edit (sysop).",
    });
  });

  it("refuses a blocked user and a namespace their groups cannot write", async () => {
    jest
      .mocked(db.wikiBlock.findMany)
      .mockResolvedValue([{ reason: "spam", expiresAt: null, allowUserTalk: true }] as never);
    const blocked = await signedIn().getEditAccess({ title: "Vesperia" });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("You are blocked from editing");

    jest.mocked(db.wikiBlock.findMany).mockResolvedValue([] as never);
    const template = await signedIn().getEditAccess({ title: "Template:Flag" });
    expect(template.allowed).toBe(false);
  });

  describe("a deleted (ARCHIVED) page", () => {
    const archived = () =>
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "ARCHIVED" } as never);
    const asSysop = () =>
      jest
        .mocked(db.wikiUserGroup.findMany)
        .mockResolvedValue([{ group: "sysop", expiresAt: null }] as never);

    afterEach(() => {
      jest.mocked(db.wikiUserGroup.findMany).mockResolvedValue([] as never);
    });

    it("gives a signed-in user without deletedhistory the answer a missing page gets: the query never reveals a deletion", async () => {
      archived();
      const answerForDeleted = await signedIn().getEditAccess({ title: "Vesperia" });

      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null as never);
      const answerForMissing = await signedIn().getEditAccess({ title: "Vesperia" });

      expect(answerForDeleted).toEqual({ allowed: true, reason: null });
      expect(answerForDeleted).toEqual(answerForMissing);
    });

    it("gives a signed-out reader the same refusal for a deleted page as for a missing one", async () => {
      archived();
      const answerForDeleted = await signedOut().getEditAccess({ title: "Vesperia" });

      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null as never);
      const answerForMissing = await signedOut().getEditAccess({ title: "Vesperia" });

      expect(answerForDeleted).toEqual(answerForMissing);
      expect(answerForDeleted.reason).toBe(
        'You do not have the "edit" right needed to create this page.'
      );
    });

    it("tells an administrator (deletedhistory) that the page was deleted and cannot be edited", async () => {
      archived();
      asSysop();
      await expect(signedIn().getEditAccess({ title: "Vesperia" })).resolves.toEqual({
        allowed: false,
        reason: "This page was deleted; ask an administrator to restore it",
      });
    });
  });

  it("is a bad request for a title MediaWiki refuses, not an answer", async () => {
    await expect(signedIn().getEditAccess({ title: "a[b" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("wikios.getEditAccess rate limit (m6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "PUBLISHED" } as never);
  });

  it("counts against the shared public tier: a caller over it is turned away, not answered", async () => {
    mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
    await signedOut().getEditAccess({ title: "Vesperia" });
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockCheck.mock.calls[0]?.[1]).toBe("public");

    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    await expect(signedOut().getEditAccess({ title: "Vesperia" })).rejects.toThrow(
      /Too many requests/
    );
  });
});

describe("bot passwords", () => {
  const createCaller = createCallerFactory(wikiosBotPasswordsRouter);
  const signedIn = () =>
    createCaller(
      createMockRouterContext({
        auth: { userId: "user_1" },
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
      }) as never
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getVerifiedWikiLink).mockResolvedValue({
      username: "Heku",
      verifiedById: null,
      mwRegisteredAt: null,
      mwEditCount: null,
    });
  });

  describe("wikiosBotPasswordsRouter", () => {
    it("refuses a signed-out caller", async () => {
      const anonymous = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await expect(anonymous.listBotPasswords()).rejects.toThrow(/Authentication required/);
      await expect(anonymous.createBotPassword({ appId: "x", grants: [] })).rejects.toThrow(
        /Authentication required/
      );
      expect(createBotPassword).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("needs a verified wiki link, for every procedure", async () => {
      jest.mocked(getVerifiedWikiLink).mockResolvedValue(null);
      await expect(signedIn().listBotPasswords()).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
      await expect(signedIn().createBotPassword({ appId: "x", grants: [] })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
      await expect(signedIn().deleteBotPassword({ id: "bp1" })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
      expect(createBotPassword).not.toHaveBeenCalled();
    });

    it("lists the caller's bot passwords with the grants on offer and their wiki name", async () => {
      jest.mocked(listBotPasswords).mockResolvedValue([]);
      const result = await signedIn().listBotPasswords();
      expect(listBotPasswords).toHaveBeenCalledWith("db1");
      expect(result.wikiUsername).toBe("Heku");
      expect(result.grants.map((g) => g.grant)).toContain("editpage");
    });

    it("creates one and returns the login name and the password", async () => {
      jest.mocked(createBotPassword).mockResolvedValue({
        summary: {
          id: "bp1",
          appId: "Pywikibot",
          grants: ["basic"],
          createdAt: new Date(),
          lastUsedAt: null,
        },
        password: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      });
      const result = await signedIn().createBotPassword({
        appId: "Pywikibot",
        grants: ["editpage"],
      });
      expect(createBotPassword).toHaveBeenCalledWith("db1", {
        appId: "Pywikibot",
        grants: ["editpage"],
      });
      expect(result).toEqual({
        id: "bp1",
        appId: "Pywikibot",
        loginName: "Heku@Pywikibot",
        password: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      });
    });

    it("rejects an unknown grant at validation and maps a service refusal to a tRPC error", async () => {
      await expect(
        signedIn().createBotPassword({ appId: "x", grants: ["root" as never] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      jest.mocked(createBotPassword).mockRejectedValue(new PageOperationError("CONFLICT", "taken"));
      await expect(signedIn().createBotPassword({ appId: "x", grants: [] })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "taken",
      });
    });

    it("deletes the caller's own bot password", async () => {
      jest.mocked(deleteBotPassword).mockResolvedValue(undefined);
      expect(await signedIn().deleteBotPassword({ id: "bp1" })).toEqual({ success: true });
      expect(deleteBotPassword).toHaveBeenCalledWith("db1", "bp1");
    });
  });
});

describe("the country-profile cache", () => {
  const createCaller = createCallerFactory(wikiCacheRouter);

  function callerAs(id: string | null) {
    return createCaller(
      createMockRouterContext({
        db: createMockPrisma(),
        auth: id ? { userId: `clerk_${id}` } : null,
        user: id ? { id, clerkUserId: `clerk_${id}` } : null,
        rateLimitIdentifier: `${id}_${Math.random()}`,
      }) as never
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("profile and refresh", () => {
    it("serves country profiles publicly", async () => {
      (wikiCacheService.getCountryProfile as jest.Mock).mockResolvedValue({ name: "Caphiria" });
      await expect(callerAs(null).getCountryProfile({ countryName: "Caphiria" })).resolves.toEqual({
        name: "Caphiria",
      });
    });

    it("needs a signed-in user to refresh a country's cache", async () => {
      await expect(callerAs(null).refreshCountryCache({ countryName: "Caphiria" })).rejects.toThrow(
        /Authentication required/
      );
      expect(wikiCacheService.clearCountryCache).not.toHaveBeenCalled();

      await callerAs("u1").refreshCountryCache({ countryName: "Caphiria" });
      expect(wikiCacheService.clearCountryCache).toHaveBeenCalledWith("Caphiria", "ixwiki");

      await callerAs("u1").refreshCountryCache({ countryName: "Afropa", wikiSource: "iiwiki" });
      expect(wikiCacheService.clearCountryCache).toHaveBeenCalledWith("Afropa", "iiwiki");
    });
  });
});
