// `jest` is deliberately NOT imported from "@jest/globals" here — see the note in
// trpc-impersonation.test.ts: the jest.mock() factories below call jest.fn() inline, and
// jest.mock() calls are hoisted above imports, so importing `jest` under that same name would
// shadow the ambient global those hoisted factories rely on.
jest.mock("~/lib/flags/commons-flag-importer", () => ({
  __esModule: true,
  commonsFlagImporter: {
    fetchCategoryMembers: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("~/lib/cards/valuation", () => ({
  __esModule: true,
  recomputeAllCardValues: jest.fn(),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { cardsLegacyAdminRouter as cardsAdminRouter } from "~/server/api/routers/cards/admin-legacy";
import { commonsFlagImporter } from "~/lib/flags/commons-flag-importer";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCardsCaller = createCallerFactory(cardsAdminRouter);

const ordinaryUserCtx = (db: ReturnType<typeof createMockDb>) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    db,
  });

const adminCtx = (db: ReturnType<typeof createMockDb>) =>
  createMockRouterContext({
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    db,
  });

describe("cardsAdminRouter auth (Finding 2)", () => {
  it("rejects an ordinary user calling importCommonsFlags and never touches the DB", async () => {
    const db = createMockDb();
    const caller = createCardsCaller(ordinaryUserCtx(db) as never);

    await expect(
      caller.importCommonsFlags({
        items: [{ cleanTitle: "Flag", fileUrl: "https://example.com/flag.svg", category: "Cat" }],
      })
    ).rejects.toThrow();
    expect(db.card.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an ordinary user calling fetchCommonsCategoryMembers", async () => {
    const db = createMockDb();
    const caller = createCardsCaller(ordinaryUserCtx(db) as never);

    await expect(caller.fetchCommonsCategoryMembers({ category: "Cat" })).rejects.toThrow();
  });

  it("marks a flag already imported from the same Commons category (admin)", async () => {
    const db = createMockDb();
    jest
      .mocked(commonsFlagImporter.fetchCategoryMembers)
      .mockResolvedValueOnce([{ cleanTitle: "Flag" }, { cleanTitle: "Other" }] as never);
    db.card.findMany = jest.fn().mockResolvedValue([{ title: "Flag" }] as never);
    const caller = createCardsCaller(adminCtx(db) as never);

    const result = await caller.fetchCommonsCategoryMembers({ category: "Cat" });

    expect(db.card.findMany).toHaveBeenCalledWith({
      where: {
        cardType: "LORE",
        title: { in: ["Flag", "Other"] },
        metadata: { path: ["commonsCategory"], equals: "Cat" },
      },
      select: { title: true },
    });
    expect(result.items.map((item) => item.isAlreadyImported)).toEqual([true, false]);
  });

  it("does not grant ownership for a pre-existing card (admin, item already imported)", async () => {
    const db = createMockDb();
    db.card.findFirst = jest.fn().mockResolvedValue({ id: "card_existing" } as never);
    const caller = createCardsCaller(adminCtx(db) as never);

    const result = await caller.importCommonsFlags({
      items: [{ cleanTitle: "Flag", fileUrl: "https://example.com/flag.svg", category: "Cat" }],
    });

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db.card.create).not.toHaveBeenCalled();
    expect(db.cardOwnership.create).not.toHaveBeenCalled();
  });

  it("creates a Lore card in Ixnay and gives the importing admin no copy (admin)", async () => {
    const db = createMockDb();
    db.card.findFirst = jest.fn().mockResolvedValue(null as never);
    db.card.create = jest.fn().mockResolvedValue({ id: "card_new" } as never);
    const caller = createCardsCaller(adminCtx(db) as never);

    const result = await caller.importCommonsFlags({
      items: [{ cleanTitle: "Flag", fileUrl: "https://example.com/flag.svg", category: "Cat" }],
    });

    expect(result).toMatchObject({ imported: 1, skipped: 0 });
    expect(db.card.findFirst).toHaveBeenCalledWith({
      where: {
        title: "Flag",
        cardType: "LORE",
        metadata: { path: ["commonsCategory"], equals: "Cat" },
      },
    });
    expect(db.card.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardType: "LORE",
        realmId: "default",
        artwork: "https://example.com/flag.svg",
      }),
    });
    expect(db.cardOwnership.create).not.toHaveBeenCalled();
  });
});
