/**
 * Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters keeps every player procedure at the top level (`api.cards.*`); the card admin is the nested
 * `api.cards.admin.<tab>.*` (cards refresh spec §2.4).
 *
 * Domains:
 *  - suggestions: free lore card suggestions
 *  - mine:        the caller's copies (the hub's Mine tab)
 *  - explore:     realm shelves, the catalogue grid, regions
 *  - sheet:       the card sheet and the wiki excerpt
 *  - showcases:   free-form showcases by copy, and the player's display
 *  - mute:        the per-card notice mute
 *  - takedowns:   a player's takedown request for a card not from NationStates
 *  - inscriptions: signing a copy and reporting an inscription
 *  - sheet-economy: your copies' values and actions on the sheet
 *  - admin:       every card admin procedure, one sub-router per admin tab
 */
import { createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { cardsSuggestionsRouter } from "./suggestions";
import { cardsMineRouter } from "./mine";
import { cardsExploreRouter } from "./explore";
import { cardsSheetRouter } from "./sheet";
import { cardsShowcasesRouter } from "./showcases";
import { cardsMuteRouter } from "./mute";
import { cardsTakedownsRouter } from "./takedowns";
import { cardsInscriptionsRouter } from "./inscriptions";
import { cardsSheetEconomyRouter } from "./sheet-economy";
import { cardsAdminRouter } from "./admin";

export const cardsRouter = mergeRouters(
  cardsSuggestionsRouter,
  cardsMineRouter,
  cardsExploreRouter,
  cardsSheetRouter,
  cardsShowcasesRouter,
  cardsMuteRouter,
  cardsTakedownsRouter,
  cardsInscriptionsRouter,
  cardsSheetEconomyRouter,
  createTRPCRouter({ admin: cardsAdminRouter })
);
