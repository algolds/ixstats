/**
 * Diplomatic cultural lifecycle router — split across files by domain (2026-06-13) and
 * recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * (`api.diplomaticCulturalLifecycle.*` / wherever this router is mounted) is byte-identical
 * to the former monolith — no call sites change.
 *
 * Domains:
 *  - participation: participant actions on exchanges (voting on proposals, uploading artifacts)
 *  - management:    host-only management (editing exchange details, cancellation with penalties)
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalLifecycleParticipationRouter } from "./participation";
import { diplomaticCulturalLifecycleManagementRouter } from "./management";

export const diplomaticCulturalLifecycleRouter = mergeRouters(
  diplomaticCulturalLifecycleParticipationRouter,
  diplomaticCulturalLifecycleManagementRouter
);
