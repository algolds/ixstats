/**
 * Economic Archetypes router — split across files by access tier (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.economicArchetypes.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - public: read endpoints + usage-count increment (getAllArchetypes, getArchetypeById,
 *            getArchetypesByCategory, incrementArchetypeUsage)
 *  - admin:  CRUD + analytics (createArchetype, updateArchetype, deleteArchetype,
 *            getArchetypeUsageStats)
 */
import { mergeRouters } from "~/server/api/trpc";
import { economicArchetypesPublicRouter } from "./public";
import { economicArchetypesAdminRouter } from "./admin";

export const economicArchetypesRouter = mergeRouters(
  economicArchetypesPublicRouter,
  economicArchetypesAdminRouter
);
