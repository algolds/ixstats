/**
 * Card Packs router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cardPacks.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - discovery: pack catalog reads (available packs)
 *  - user:      user-facing pack lifecycle (own packs, purchase, open)
 *
 * Packs are edited in `cards.admin.packs` and awarded to players in `cards.admin.tools`.
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardPacksDiscoveryRouter } from "./discovery";
import { cardPacksUserRouter } from "./user";

export const cardPacksRouter = mergeRouters(cardPacksDiscoveryRouter, cardPacksUserRouter);
