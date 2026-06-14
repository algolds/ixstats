/**
 * Studio router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.studio.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - realm:     realm CRUD (create/list/get/update/delete) for World Studio
 *  - admin:     admin-only realm/world config/user/template management
 *  - generation: procedural world generation and committing to a realm
 */
import { mergeRouters } from "~/server/api/trpc";
import { studioRealmRouter } from "./realm";
import { studioAdminRouter } from "./admin";
import { studioGenerationRouter } from "./generation";

export const studioRouter = mergeRouters(
  studioRealmRouter,
  studioAdminRouter,
  studioGenerationRouter
);
