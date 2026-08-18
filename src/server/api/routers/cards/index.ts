/**
 * Cards router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cards.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - browse:     card discovery, market, stats, admin utilities, forum search
 *  - inventory:  user inventory, NS-import library, admin updates/transfers, junking
 *  - collections: collection CRUD + wiki article excerpt lookup
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardsBrowseRouter } from "./browse";
import { cardsInventoryRouter } from "./inventory";
import { cardsSettingsRouter } from "./settings";
import { cardsAdminRouter } from "./admin";
import { cardsCollectionsRouter } from "./collections";
import { cardsOperationsRouter } from "./operations";

export const cardsRouter = mergeRouters(
  cardsBrowseRouter,
  cardsInventoryRouter,
  cardsSettingsRouter,
  cardsAdminRouter,
  cardsCollectionsRouter,
  cardsOperationsRouter
);
