/**
 * Lore Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.loreCards.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - gallery: public lore card gallery with filters (rarity, category, season, search, sort)
 *  - wiki:    wiki-backed lore card procedures
 *
 * Players suggest lore cards for free through `api.cards.suggestCard`; admins answer them in the cards admin's
 * Curation tab (`api.cards.admin.curation.*`).
 */
import { mergeRouters } from "~/server/api/trpc";
import { loreCardsGalleryRouter } from "./gallery";
import { loreCardsWikiRouter } from "./wiki";

export const loreCardsRouter = mergeRouters(loreCardsGalleryRouter, loreCardsWikiRouter);
