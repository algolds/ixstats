/**
 * Small arms equipment router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.smallArmsEquipment.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - query:           public reads (catalog, search, stats) + protected incrementUsage
 *  - equipmentAdmin:  admin CRUD + bulk import for equipment items
 *  - referenceAdmin:  admin CRUD for manufacturers and weapon eras
 */
import { mergeRouters } from "~/server/api/trpc";
import { smallArmsEquipmentQueryRouter } from "./query";
import { smallArmsEquipmentEquipmentAdminRouter } from "./equipmentAdmin";
import { smallArmsEquipmentReferenceAdminRouter } from "./referenceAdmin";

export const smallArmsEquipmentRouter = mergeRouters(
  smallArmsEquipmentQueryRouter,
  smallArmsEquipmentEquipmentAdminRouter,
  smallArmsEquipmentReferenceAdminRouter
);
