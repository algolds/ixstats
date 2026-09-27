/**
 * Studio router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.studio.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - admin:     admin-only realm/world config/user/template management
 */
import { mergeRouters } from "~/server/api/trpc";
import { studioAdminRouter } from "./admin";

export const studioRouter = mergeRouters(studioAdminRouter);
