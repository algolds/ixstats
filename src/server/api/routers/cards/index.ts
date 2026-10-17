/**
 * Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters keeps every player procedure at the top level (`api.cards.*`); the card admin is the nested
 * `api.cards.admin.<tab>.*` (cards refresh spec §2.4).
 *
 * Domains:
 *  - inventory:   user inventory, the card library and its NationStates stats
 *  - collections: collection CRUD + wiki article excerpt lookup
 *  - suggestions: free lore card suggestions
 *  - admin:       every card admin procedure, one sub-router per admin tab
 */
import { createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { cardsInventoryRouter } from "./inventory";
import { cardsCollectionsRouter } from "./collections";
import { cardsSuggestionsRouter } from "./suggestions";
import { cardsAdminRouter } from "./admin";

export const cardsRouter = mergeRouters(
  cardsInventoryRouter,
  cardsCollectionsRouter,
  cardsSuggestionsRouter,
  createTRPCRouter({ admin: cardsAdminRouter })
);
