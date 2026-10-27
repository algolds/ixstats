/**
 * Small arms equipment router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.smallArmsEquipment.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - query:           public reads (catalog, search, stats) + protected incrementUsage
 */
import { mergeRouters } from "~/server/api/trpc";
import { smallArmsEquipmentQueryRouter } from "./query";

export const smallArmsEquipmentRouter = mergeRouters(smallArmsEquipmentQueryRouter);
