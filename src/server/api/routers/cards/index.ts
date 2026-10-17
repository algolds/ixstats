/**
 * Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters keeps every player procedure at the top level (`api.cards.*`); the card admin is the nested
 * `api.cards.admin.<tab>.*` (cards refresh spec §2.4).
 *
 * Domains:
 *  - inventory:   user inventory, the card library and its NationStates stats
 *  - collections: collection CRUD
 *  - suggestions: free lore card suggestions
 *  - mine:        the caller's copies (the hub's Mine tab)
 *  - explore:     realm shelves, the catalogue grid, regions
 *  - sheet:       the card sheet and the wiki excerpt
 *  - admin:       every card admin procedure, one sub-router per admin tab
 */
import { createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { cardsInventoryRouter } from "./inventory";
import { cardsCollectionsRouter } from "./collections";
import { cardsSuggestionsRouter } from "./suggestions";
import { cardsMineRouter } from "./mine";
import { cardsExploreRouter } from "./explore";
import { cardsSheetRouter } from "./sheet";
import { cardsAdminRouter } from "./admin";

export const cardsRouter = mergeRouters(
  cardsInventoryRouter,
  cardsCollectionsRouter,
  cardsSuggestionsRouter,
  cardsMineRouter,
  cardsExploreRouter,
  cardsSheetRouter,
  createTRPCRouter({ admin: cardsAdminRouter })
);
