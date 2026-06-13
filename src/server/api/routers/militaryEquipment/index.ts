/**
 * Military Equipment router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.militaryEquipment.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - catalog:       equipment catalog queries + admin CRUD + usage increment
 *  - manufacturers: manufacturer queries, admin create/update, and stats
 *  - analytics:     equipment usage statistics
 *  - images:        Wikimedia image resolution (single, batch, cache stats)
 */
import { mergeRouters } from "~/server/api/trpc";
import { militaryEquipmentCatalogRouter } from "./catalog";
import { militaryEquipmentManufacturersRouter } from "./manufacturers";
import { militaryEquipmentAnalyticsRouter } from "./analytics";
import { militaryEquipmentImagesRouter } from "./images";

export const militaryEquipmentRouter = mergeRouters(
  militaryEquipmentCatalogRouter,
  militaryEquipmentManufacturersRouter,
  militaryEquipmentAnalyticsRouter,
  militaryEquipmentImagesRouter
);
