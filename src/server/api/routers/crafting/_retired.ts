import { TRPCError } from "@trpc/server";

/**
 * Crafting feature flag. Crafting is retired for now (owner decision, 2026-10-05): the
 * workbench, its route and its admin switch are gone, and every `crafting.*` procedure refuses
 * before touching the database. The CraftingRecipe / CraftingHistory tables and their rows stay
 * until the schema-drop decision is made. Bringing crafting back starts by flipping this flag.
 */
export const CRAFTING_ENABLED = false;

export const CRAFTING_RETIRED_MESSAGE = "Crafting is retired for now.";

/** Refuse a crafting call while the feature is retired. */
export function assertCraftingEnabled(): void {
  if (!CRAFTING_ENABLED) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: CRAFTING_RETIRED_MESSAGE });
  }
}
