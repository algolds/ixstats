/**
 * nsImport router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.nsImport.*` is byte-identical to the former monolith — no call sites change.
 * The admin region sync and CTE filter live in the cards admin (`cards.admin.nationstates`).
 *
 * Domains:
 *  - verification: nation ownership verification flow (requestVerification, checkVerification)
 *  - decks:        the verified nation's deck import (importDeck)
 *  - cards:        the verification URL, takedowns (requestSelfServiceTakedown, hideNSCard,
 *                  restoreNSCard, listHiddenNSCards, hideMyCard) and the player's NS cards
 *                  (getMyNSCards)
 */
import { mergeRouters } from "~/server/api/trpc";
import { nsImportVerificationRouter } from "./verification";
import { nsImportDecksRouter } from "./decks";
import { nsImportCardsRouter } from "./cards";

export const nsImportRouter = mergeRouters(
  nsImportVerificationRouter,
  nsImportDecksRouter,
  nsImportCardsRouter
);
