// `jest` is deliberately NOT imported from "@jest/globals" here — see the note in
// trpc-impersonation.test.ts: the jest.mock() factories below call jest.fn() inline, and
// jest.mock() calls are hoisted above imports, so importing `jest` under that same name would
// shadow the ambient global those hoisted factories rely on.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiTemplate: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    wikiArticle: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  searchTemplates: jest.fn(),
}));
jest.mock("~/lib/wiki-os/templates/preview-service.server", () => ({
  __esModule: true,
  renderTemplateWithRedisCache: jest.fn(),
}));
jest.mock("~/lib/wiki-os/templates/template-registry", () => ({
  __esModule: true,
  fetchTemplateData: jest.fn(),
  categorizeTemplate: jest.fn(),
  isNoiseTemplate: jest.fn(),
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
jest.mock("~/server/cron/sync-wiki-recentchanges", () => ({
  __esModule: true,
  syncWikiRecentChanges: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosTemplatesRouter } from "~/server/api/routers/wikios/templates";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { syncWikiRecentChanges } from "~/server/cron/sync-wiki-recentchanges";

const createTemplatesCaller = createCallerFactory(wikiosTemplatesRouter);
const createHistoryCaller = createCallerFactory(wikiosHistoryDiffRouter);

const ordinaryUserCtx = () =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
  });

const systemOwnerCtx = () =>
  createMockRouterContext({
    auth: { userId: "system_owner_id" },
    user: { id: "db_owner", clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } },
  });

const anonymousCtx = () => createMockRouterContext({ auth: null, user: null });

describe("WikiOS template auth (Finding 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(db.wikiTemplate, "findUnique").mockResolvedValue(null as never);
    jest.spyOn(db.wikiArticle, "findUnique").mockResolvedValue(null as never);
    jest.spyOn(db.wikiTemplate, "upsert").mockResolvedValue({ id: "tpl1" } as never);
    jest.spyOn(db.wikiArticle, "upsert").mockResolvedValue({ id: "art1" } as never);
    jest.spyOn(db.wikiTemplate, "delete").mockResolvedValue({ id: "tpl1" } as never);
  });

  describe("saveCustomTemplate", () => {
    it("rejects an anonymous caller", async () => {
      const caller = createTemplatesCaller(anonymousCtx() as never);
      await expect(
        caller.saveCustomTemplate({ name: "NewTemplate", params: [] })
      ).rejects.toThrow();
    });

    it("allows a signed-in ordinary user to create a brand-new template", async () => {
      const caller = createTemplatesCaller(ordinaryUserCtx() as never);
      await expect(
        caller.saveCustomTemplate({ name: "BrandNewName", params: [] })
      ).resolves.toMatchObject({ success: true });
    });

    it("forbids an ordinary user from overwriting an existing non-canonical template, without touching wikiArticle.upsert", async () => {
      jest
        .spyOn(db.wikiTemplate, "findUnique")
        .mockResolvedValue({ name: "Existing", isCanonical: false } as never);
      const caller = createTemplatesCaller(ordinaryUserCtx() as never);

      await expect(
        caller.saveCustomTemplate({ name: "Existing", params: [] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.wikiArticle.upsert).not.toHaveBeenCalled();
    });

    it("forbids overwriting a canonical template even for the system owner", async () => {
      jest
        .spyOn(db.wikiTemplate, "findUnique")
        .mockResolvedValue({ name: "Canonical", isCanonical: true } as never);
      const caller = createTemplatesCaller(systemOwnerCtx() as never);

      await expect(
        caller.saveCustomTemplate({ name: "Canonical", params: [] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.wikiArticle.upsert).not.toHaveBeenCalled();
    });
  });

  describe("deleteCustomTemplate", () => {
    it("rejects an anonymous caller", async () => {
      const caller = createTemplatesCaller(anonymousCtx() as never);
      await expect(caller.deleteCustomTemplate({ name: "AnyName" })).rejects.toThrow();
    });

    it("rejects an ordinary signed-in user", async () => {
      const caller = createTemplatesCaller(ordinaryUserCtx() as never);
      await expect(caller.deleteCustomTemplate({ name: "AnyName" })).rejects.toThrow();
    });
  });
});

describe("WikiOS syncRecentChanges (Finding 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an anonymous caller and never invokes the sync job", async () => {
    const caller = createHistoryCaller(anonymousCtx() as never);
    await expect(caller.syncRecentChanges()).rejects.toThrow();
    expect(syncWikiRecentChanges).not.toHaveBeenCalled();
  });

  it("rejects an ordinary signed-in user and never invokes the sync job", async () => {
    const caller = createHistoryCaller(ordinaryUserCtx() as never);
    await expect(caller.syncRecentChanges()).rejects.toThrow();
    expect(syncWikiRecentChanges).not.toHaveBeenCalled();
  });
});
