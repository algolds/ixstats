/**
 * Card Packs router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cardPacks.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - discovery: pack catalog reads (available packs, single pack, all packs incl. inactive)
 *  - user:      user-facing pack lifecycle (own packs, purchase, open)
 *  - admin:     admin pack CRUD (create, update, deactivate) and admin award
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardPacksDiscoveryRouter } from "./discovery";
import { cardPacksUserRouter } from "./user";
import { cardPacksAdminRouter } from "./admin";

export const cardPacksRouter = mergeRouters(
  cardPacksDiscoveryRouter,
  cardPacksUserRouter,
  cardPacksAdminRouter
);
