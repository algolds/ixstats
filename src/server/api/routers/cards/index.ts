/**
 * Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters keeps every player procedure at the top level (`api.cards.*`); the card admin is the nested
 * `api.cards.admin.<tab>.*` (cards refresh spec §2.4).
 *
 * Domains:
 *  - inventory:   the caller's cards and a trade partner's tradeable copies
 *  - suggestions: free lore card suggestions
 *  - mine:        the caller's copies (the hub's Mine tab)
 *  - explore:     realm shelves, the catalogue grid, regions
 *  - sheet:       the card sheet and the wiki excerpt
 *  - showcases:   free-form showcases by copy, and the player's display
 *  - mute:        the per-card notice mute
 *  - admin:       every card admin procedure, one sub-router per admin tab
 */
import { createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { cardsInventoryRouter } from "./inventory";
import { cardsSuggestionsRouter } from "./suggestions";
import { cardsMineRouter } from "./mine";
import { cardsExploreRouter } from "./explore";
import { cardsSheetRouter } from "./sheet";
import { cardsShowcasesRouter } from "./showcases";
import { cardsMuteRouter } from "./mute";
import { cardsAdminRouter } from "./admin";

export const cardsRouter = mergeRouters(
  cardsInventoryRouter,
  cardsSuggestionsRouter,
  cardsMineRouter,
  cardsExploreRouter,
  cardsSheetRouter,
  cardsShowcasesRouter,
  cardsMuteRouter,
  createTRPCRouter({ admin: cardsAdminRouter })
);
