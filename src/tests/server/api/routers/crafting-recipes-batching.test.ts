import { craftingRecipesRouter } from "~/server/api/routers/crafting/recipes";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("Plan 159: Crafting Recipes Query Batching", () => {
  const createCaller = createCallerFactory(craftingRecipesRouter);

  it("fetches user collector level once and groups crafting history in 1 query", async () => {
    const userFindUniqueMock = jest.fn().mockResolvedValue({ id: "user-1", collectorLevel: 5 });
    const historyGroupByMock = jest.fn().mockResolvedValue([
      { recipeId: "r1", _count: { _all: 3 } },
      { recipeId: "r2", _count: { _all: 1 } },
    ]);
    const historyCountMock = jest.fn();

    const mockDb = {
      craftingRecipe: {
        findMany: jest.fn().mockResolvedValue([
          { id: "r1", name: "Recipe 1", resultRarity: "LEGENDARY", minLevel: 3, isActive: true },
          { id: "r2", name: "Recipe 2", resultRarity: "RARE", minLevel: 5, isActive: true },
          { id: "r3", name: "Recipe 3", resultRarity: "COMMON", minLevel: 10, isActive: true },
        ]),
      },
      user: {
        findUnique: userFindUniqueMock,
      },
      craftingHistory: {
        groupBy: historyGroupByMock,
        count: historyCountMock,
      },
    };

    const ctx = createMockRouterContext({
      db: mockDb,
      auth: { userId: "user-1" },
    });
    const caller = createCaller(ctx as any);

    const result = await (caller as any).getRecipes({ filter: "ALL" });

    // Assert query batching
    expect(userFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(historyGroupByMock).toHaveBeenCalledTimes(1);
    expect(historyCountMock).toHaveBeenCalledTimes(0);

    // Assert correct calculation results
    expect(result.recipes).toHaveLength(3);
    expect(result.recipes[0].isUnlocked).toBe(true);
    expect(result.recipes[0].completedCount).toBe(3);
    expect(result.recipes[0].isCompleted).toBe(true);

    expect(result.recipes[1].isUnlocked).toBe(true);
    expect(result.recipes[1].completedCount).toBe(1);
    expect(result.recipes[1].isCompleted).toBe(true);

    expect(result.recipes[2].isUnlocked).toBe(false);
    expect(result.recipes[2].completedCount).toBe(0);
    expect(result.recipes[2].isCompleted).toBe(false);
  });
});
