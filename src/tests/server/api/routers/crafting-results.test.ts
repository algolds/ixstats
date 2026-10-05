/**
 * Code audit VT-14: crafting minted a new generic card even when the recipe names its result
 * card, criteria recipes checked only the material count, `successRate` was rolled as 0-100
 * against a 0-1 schema, and ownership ids were built from user + card + Date.now().
 */
jest.mock("~/lib/cards/season", () => ({ getCurrentIxCardSeason: jest.fn().mockResolvedValue(1) }));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));

import { craftingRecipesRouter } from "~/server/api/routers/crafting/recipes";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import {
  materialSlotCount,
  normalizeSuccessRate,
  validateMaterialCriteria,
} from "~/lib/cards/crafting-rules";

const createCaller = createCallerFactory(craftingRecipesRouter);

const material = (id: string, rarity: string, cardType = "NATION") => ({
  id,
  cardId: `card_${id}`,
  ownerId: "user_db_id_1",
  isLocked: false,
  cards: { title: id, rarity, cardType },
});

function makeDb(recipeOver: Record<string, unknown>, owned: any[]) {
  const recipe = {
    id: "r1",
    name: "Fuse",
    isActive: true,
    minLevel: 1,
    ixCreditsCost: 0,
    requiredCardIds: [],
    requiredCount: 1,
    successRate: 1.0,
    collectorXPGain: 0,
    resultRarity: "RARE",
    resultCardId: null,
    ...recipeOver,
  };
  const db: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    myVault: {
      findUnique: jest.fn().mockResolvedValue({ vaultXp: 0, credits: 0 }),
      upsert: jest.fn().mockResolvedValue({ id: "v1", userId: "user_db_id_1", credits: 0 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ collectorLevel: 1 }) },
    craftingRecipe: { findUnique: jest.fn().mockResolvedValue(recipe) },
    cardOwnership: {
      findMany: jest.fn().mockResolvedValue(owned),
      findFirst: jest.fn().mockResolvedValue({ serialNumber: 7 }),
      deleteMany: jest.fn().mockResolvedValue({ count: owned.length }),
      create: jest.fn(async ({ data }: any) => ({ ...data, cards: {} })),
    },
    craftingHistory: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "h1" }),
    },
    card: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === "result_card" ? { id: "result_card", title: "The Result" } : null
      ),
      create: jest.fn().mockResolvedValue({ id: "c_new" }),
    },
  };
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return db;
}

const craft = (db: any, materialCardIds: string[]) =>
  createCaller(createMockRouterContext({ db }) as never).craftCard({
    recipeId: "r1",
    materialCardIds,
  });

beforeEach(() => {
  invalidateVaultConfigCache();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("craftCard result", () => {
  it("grants the recipe's result card instead of minting a new one", async () => {
    const db = makeDb({ resultCardId: "result_card" }, [material("o1", "COMMON")]);
    const result = await craft(db, ["o1"]);
    expect(result.success).toBe(true);
    expect(db.card.create).not.toHaveBeenCalled();
    const data = db.cardOwnership.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ cardId: "result_card", serialNumber: 8, ownerId: "user_db_id_1" });
    expect(data.id).toMatch(/^card_own_\d+_[0-9a-f-]{36}$/);
  });

  it("refuses before spending anything when the result card is gone", async () => {
    const db = makeDb({ resultCardId: "deleted_card" }, [material("o1", "COMMON")]);
    await expect(craft(db, ["o1"])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
  });

  it("marks minted results as crafted so packs skip them", async () => {
    const db = makeDb({}, [material("o1", "COMMON")]);
    await craft(db, ["o1"]);
    expect(db.card.create.mock.calls[0][0].data.metadata).toEqual({
      crafted: true,
      recipeId: "r1",
    });
    expect(db.cardOwnership.create.mock.calls[0][0].data).toMatchObject({
      cardId: "c_new",
      serialNumber: 1,
    });
  });

  it("reads successRate as a 0-1 fraction (0.0 never succeeds)", async () => {
    const db = makeDb({ successRate: 0 }, [material("o1", "COMMON")]);
    const result = await craft(db, ["o1"]);
    expect(result.success).toBe(false);
    expect(db.cardOwnership.create).not.toHaveBeenCalled();
  });

  it("returns successRate normalised to 0-1 for legacy percentage rows", async () => {
    const db = makeDb({ successRate: 95 }, []);
    const caller = createCaller(createMockRouterContext({ db }) as never);
    expect((await caller.getRecipeById({ recipeId: "r1" })).successRate).toBeCloseTo(0.95);
  });
});

describe("craftCard criteria", () => {
  const criteria = [{ rarity: "COMMON", quantity: 2 }];

  it("rejects materials of the wrong rarity", async () => {
    const db = makeDb({ requiredCardIds: criteria, requiredCount: 2 }, [
      material("o1", "COMMON"),
      material("o2", "LEGENDARY"),
    ]);
    await expect(craft(db, ["o1", "o2"])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.cardOwnership.deleteMany).not.toHaveBeenCalled();
  });

  it("accepts materials that meet the criteria", async () => {
    const db = makeDb({ requiredCardIds: criteria, requiredCount: 2 }, [
      material("o1", "COMMON"),
      material("o2", "COMMON"),
    ]);
    await expect(craft(db, ["o1", "o2"])).resolves.toMatchObject({ success: true });
  });
});

describe("crafting rules", () => {
  it("normalises success rates to 0-1", () => {
    expect(normalizeSuccessRate(0.85)).toBe(0.85);
    expect(normalizeSuccessRate(1)).toBe(1);
    expect(normalizeSuccessRate(95)).toBeCloseTo(0.95);
    expect(normalizeSuccessRate(100)).toBe(1);
    expect(normalizeSuccessRate(250)).toBe(1);
    expect(normalizeSuccessRate(-3)).toBe(0);
    expect(normalizeSuccessRate(Number.NaN)).toBe(0);
  });

  it("matches the narrowest criterion first and refuses extras", () => {
    const mats = [
      { cardId: "a", cards: { rarity: "RARE", cardType: "LORE" } },
      { cardId: "b", cards: { rarity: "RARE", cardType: "NATION" } },
    ];
    // The LORE requirement must get card "a" even though it is listed second
    expect(
      validateMaterialCriteria(mats, [
        { rarity: "RARE", quantity: 1 },
        { rarity: "RARE", type: "LORE", quantity: 1 },
      ])
    ).toBeNull();
    expect(validateMaterialCriteria(mats, [{ rarity: "RARE", quantity: 1 }])).toMatch(/extra/);
    expect(validateMaterialCriteria(mats, [{ type: "LORE", quantity: 2 }])).toMatch(/Need 2/);
  });

  it("gives the workbench one slot per consumed card", () => {
    // Seeded "Common Fusion" takes two Commons from one criterion
    expect(materialSlotCount([{ rarity: "COMMON", quantity: 2 }])).toBe(2);
    expect(
      materialSlotCount([
        { rarity: "ULTRA_RARE", quantity: 2 },
        { rarity: "EPIC", quantity: 1 },
      ])
    ).toBe(3);
    expect(materialSlotCount([{ rarity: "RARE" }])).toBe(1);
    expect(materialSlotCount(["card-a", "card-b"])).toBe(2);
    expect(materialSlotCount(null)).toBe(0);
  });
});
