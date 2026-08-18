/**
 * Lore Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.loreCards.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - user:    user-facing balance check, request submission (pays IxC / token), and request history
 *  - admin:   admin review queue, approve/reject, card generation from approved requests, stats
 *  - gallery: public lore card gallery with filters (rarity, category, season, search, sort)
 */
import { mergeRouters } from "~/server/api/trpc";
import { loreCardsUserRouter } from "./user";
import { loreCardsAdminRouter } from "./admin";
import { loreCardsGalleryRouter } from "./gallery";
import { loreCardsWikiRouter } from "./wiki";
import { loreCardsMaintenanceRouter } from "./maintenance";

export const loreCardsRouter = mergeRouters(
  loreCardsUserRouter,
  loreCardsAdminRouter,
  loreCardsGalleryRouter,
  loreCardsWikiRouter,
  loreCardsMaintenanceRouter
);
