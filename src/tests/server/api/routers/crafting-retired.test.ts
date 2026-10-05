/**
 * Crafting is retired for now (owner decision 2026-10-05): every `crafting.*` procedure refuses
 * with PRECONDITION_FAILED before it reads or writes anything, and the Vault config no longer
 * carries a crafting switch an admin could turn back on.
 */
import { craftingRecipesRouter } from "~/server/api/routers/crafting/recipes";
import { CRAFTING_ENABLED, CRAFTING_RETIRED_MESSAGE } from "~/server/api/routers/crafting/_retired";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";

const createCaller = createCallerFactory(craftingRecipesRouter);

function untouchedDb() {
  const fail = () => {
    throw new Error("crafting must not reach the database while retired");
  };
  return new Proxy(
    {},
    {
      get: (_target, model) =>
        model === "then" ? undefined : new Proxy({}, { get: () => jest.fn(fail) }),
    }
  );
}

describe("crafting retired", () => {
  const caller = () => createCaller(createMockRouterContext({ db: untouchedDb() }) as never);
  const refused = { code: "PRECONDITION_FAILED", message: CRAFTING_RETIRED_MESSAGE };

  it("is switched off", () => {
    expect(CRAFTING_ENABLED).toBe(false);
  });

  it("refuses craftCard", async () => {
    await expect(
      caller().craftCard({ recipeId: "r1", materialCardIds: ["o1"] })
    ).rejects.toMatchObject(refused);
  });

  it("refuses the recipe reads", async () => {
    await expect(caller().getRecipes({})).rejects.toMatchObject(refused);
    await expect(caller().getRecipeById({ recipeId: "r1" })).rejects.toMatchObject(refused);
  });

  it("has no admin crafting switch in the Vault config", () => {
    expect(VAULT_CONFIG_DEFAULTS).not.toHaveProperty("isCraftingEnabled");
  });
});
