/**
 * Crafting gate: recipes unlock by Vault level (derived from Vault XP), not by
 * User.collectorLevel, which nothing ever writes. Materials must be unlocked and still owned.
 */
// Crafting is retired (./_retired refuses every call); these tests cover the logic kept for its return.
jest.mock("~/server/api/routers/crafting/_retired", () => ({ assertCraftingEnabled: jest.fn() }));
jest.mock("~/lib/cards/season", () => ({ getCurrentIxCardSeason: jest.fn().mockResolvedValue(1) }));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));

import { craftingRecipesRouter } from "~/server/api/routers/crafting/recipes";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";

const createCaller = createCallerFactory(craftingRecipesRouter);
const recipe = {
  id: "r1",
  name: "Fuse",
  isActive: true,
  minLevel: 3,
  ixCreditsCost: 0,
  requiredCardIds: [],
  requiredCount: 1,
  successRate: 100,
  collectorXPGain: 0,
  resultRarity: "RARE",
  resultCardId: null,
};

function makeDb(over: { vaultXp?: number; owned?: any[]; deleted?: number } = {}) {
  const db: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    myVault: {
      findUnique: jest.fn().mockResolvedValue({ vaultXp: over.vaultXp ?? 0, credits: 0 }),
      upsert: jest.fn().mockResolvedValue({ id: "v1", userId: "user_db_id_1", credits: 0 }),
    },
    // Nothing writes User.collectorLevel; a high value here must not unlock anything
    user: { findUnique: jest.fn().mockResolvedValue({ collectorLevel: 99 }) },
    craftingRecipe: { findUnique: jest.fn().mockResolvedValue(recipe) },
    cardOwnership: {
      findMany: jest.fn().mockResolvedValue(over.owned ?? []),
      deleteMany: jest.fn().mockResolvedValue({ count: over.deleted ?? 1 }),
    },
    craftingHistory: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "h1" }),
    },
    card: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "c_new" }),
    },
  };
  db.cardOwnership.create = jest.fn().mockResolvedValue({ id: "own_new", cards: {} });
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return db;
}

beforeEach(() => {
  invalidateVaultConfigCache();
  // getBalance logs (and falls back) because the mock vault is minimal
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("crafting unlock gate", () => {
  it("locks a recipe until Vault level reaches minLevel, regardless of collectorLevel", async () => {
    const caller = createCaller(createMockRouterContext({ db: makeDb({ vaultXp: 500 }) }) as never);
    const detail = await caller.getRecipeById({ recipeId: "r1" });
    expect(detail.isUnlocked).toBe(false);
    await expect(
      caller.craftCard({ recipeId: "r1", materialCardIds: ["o1"] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("unlocks it once Vault XP gives the level (2,000 XP => level 3)", async () => {
    const caller = createCaller(
      createMockRouterContext({ db: makeDb({ vaultXp: 2000 }) }) as never
    );
    expect((await caller.getRecipeById({ recipeId: "r1" })).isUnlocked).toBe(true);
  });
});

describe("craftCard materials", () => {
  const owned = (isLocked: boolean) => [
    { id: "o1", cardId: "c1", ownerId: "user_db_id_1", isLocked, cards: { title: "Card A" } },
  ];

  it("refuses locked cards as materials", async () => {
    const db = makeDb({ vaultXp: 5000, owned: owned(true) });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await expect(caller.craftCard({ recipeId: "r1", materialCardIds: ["o1"] })).rejects.toThrow(
      /locked/
    );
    expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
  });

  it("rolls back when a concurrent action already removed a material", async () => {
    const db = makeDb({ vaultXp: 5000, owned: owned(false), deleted: 0 });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await expect(
      caller.craftCard({ recipeId: "r1", materialCardIds: ["o1"] })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.card.create).not.toHaveBeenCalled();
    expect(db.cardOwnership.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["o1"] }, ownerId: "user_db_id_1", isLocked: false },
    });
  });
});
