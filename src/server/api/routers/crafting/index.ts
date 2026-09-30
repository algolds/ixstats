/**
 * Crafting router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.crafting.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - recipes: recipe browsing, detail lookup, and the craft-card mutation (fusion/evolution)
 */
import { mergeRouters } from "~/server/api/trpc";
import { craftingRecipesRouter } from "./recipes";

export const craftingRouter = mergeRouters(craftingRecipesRouter);
