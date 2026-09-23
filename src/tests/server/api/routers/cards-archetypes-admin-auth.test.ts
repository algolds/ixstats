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
jest.mock("~/lib/cards/card-service", () => ({
  __esModule: true,
  updateCardStats: jest.fn(),
  transferCard: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminRouter } from "~/server/api/routers/cards/admin";
import { archetypesAdminRouter } from "~/server/api/routers/archetypes/admin";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCardsCaller = createCallerFactory(cardsAdminRouter);
const createArchetypesCaller = createCallerFactory(archetypesAdminRouter);

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

  it("creates the card and grants ownership exactly once for a newly-imported card (admin)", async () => {
    const db = createMockDb();
    db.card.findFirst = jest.fn().mockResolvedValue(null as never);
    db.card.create = jest.fn().mockResolvedValue({ id: "card_new" } as never);
    const caller = createCardsCaller(adminCtx(db) as never);

    const result = await caller.importCommonsFlags({
      items: [{ cleanTitle: "Flag", fileUrl: "https://example.com/flag.svg", category: "Cat" }],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(db.card.create).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.create).toHaveBeenCalledTimes(1);
    // The freshly-created card can't already be owned, so no existing-ownership lookup is needed.
    expect(db.cardOwnership.findFirst).not.toHaveBeenCalled();
  });
});

describe("archetypesAdminRouter auth (Finding 2)", () => {
  it("rejects an ordinary user for every archetype mutation, without touching the DB", async () => {
    const db = createMockDb();
    const caller = createArchetypesCaller(ordinaryUserCtx(db) as never);

    await expect(caller.recalculateArchetypeMatches()).rejects.toThrow();
    await expect(
      caller.createArchetype({
        name: "Test",
        description: "Test archetype",
        categoryId: "cat_1",
        iconName: "Circle",
        color: "#fff",
        gradient: "linear",
        tags: [],
        filterRules: {},
      })
    ).rejects.toThrow();
    await expect(caller.updateArchetype({ id: "arch_1", name: "Renamed" })).rejects.toThrow();
    await expect(caller.deleteArchetype({ id: "arch_1" })).rejects.toThrow();
    await expect(caller.initializeArchetypeSystem()).rejects.toThrow();

    expect(db.country.findMany).not.toHaveBeenCalled();
    expect(db.archetype.create).not.toHaveBeenCalled();
    expect(db.archetype.update).not.toHaveBeenCalled();
    expect(db.archetypeCategory.create).not.toHaveBeenCalled();
  });
});
