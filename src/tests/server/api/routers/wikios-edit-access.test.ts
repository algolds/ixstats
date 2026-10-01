/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see wikios-edit-conflict.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
/**
 * F35c: `wikios.getEditAccess` answers, before an editor opens, whether the caller's save would pass
 * `assertCanEditArticle`: the same gate, so a refusal there is an answer here.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRestriction: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
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

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { db } from "~/server/db";

const createCaller = createCallerFactory(wikiosEditingRouter);

const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);
const signedIn = () =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", wikiUsername: "Linked", role: { name: "user", level: 100 } },
    }) as never
  );

describe("wikios.getEditAccess (F35c)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "PUBLISHED" } as never);
    jest.mocked(db.wikiRestriction.findMany).mockResolvedValue([] as never);
    jest.mocked(db.wikiBlock.findMany).mockResolvedValue([] as never);
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
      expect(answerForDeleted.reason).toBe('You do not have the "edit" right needed to create this page.');
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
